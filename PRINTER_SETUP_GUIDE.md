# Printer Routing & Setup Guide

## Status: "Could not save printer settings" Error

This error occurs because the printer settings database columns haven't been created yet. You need to run migrations on Supabase.

---

## Fix: Run Supabase Migrations

### Step 1: Access Supabase Console

1. Go to https://app.supabase.com
2. Select your project
3. Click **SQL Editor** (left sidebar)

### Step 2: Run Migration Script

Copy and paste the SQL below into the SQL Editor and click **Run**:

```sql
-- Add printer settings columns to restaurants table
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS print_provider VARCHAR(50) DEFAULT 'browser',
ADD COLUMN IF NOT EXISTS print_service_url TEXT,
ADD COLUMN IF NOT EXISTS receipt_width_mm INTEGER DEFAULT 80,
ADD COLUMN IF NOT EXISTS auto_print_kot BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_print_bill BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS bill_printer JSONB DEFAULT '{"name":"","enabled":false}'::jsonb,
ADD COLUMN IF NOT EXISTS kot_printers JSONB DEFAULT '[]'::jsonb;

-- Set defaults for existing records
UPDATE public.restaurants
SET
  print_provider = COALESCE(print_provider, 'browser'),
  receipt_width_mm = CASE
    WHEN receipt_width_mm IN (58, 80) THEN receipt_width_mm
    ELSE 80
  END,
  auto_print_kot = COALESCE(auto_print_kot, false),
  auto_print_bill = COALESCE(auto_print_bill, false),
  bill_printer = COALESCE(bill_printer, '{"name":"","enabled":false}'::jsonb),
  kot_printers = COALESCE(kot_printers, '[]'::jsonb)
WHERE
  print_provider IS NULL
  OR receipt_width_mm IS NULL
  OR auto_print_kot IS NULL
  OR auto_print_bill IS NULL
  OR bill_printer IS NULL
  OR kot_printers IS NULL;
```

✅ **Done!** Now refresh your Settings page and try saving again.

---

## Printer Routing Architecture

### 📊 System Diagram

```
User creates KOT / Bill
        ↓
   [Auto-Print?]
        ↓         
    [Provider Check]
    ↙    ↓    ↘
Browser  QZ   Local Service
  ↓      ↓        ↓
 [Fallback if unavailable]
        ↓
 Browser Print Dialog
```

---

## Print Providers

### 1️⃣ **Browser Mode** (Default - Safe Fallback)

- ✅ Always works  
- ✅ No installation needed
- ✅ Uses browser print dialog
- ❌ Requires manual interaction
- ❌ Can't auto-print directly to hardware printer

**When to use:** Dev/testing, any setup

---

### 2️⃣ **QZ Tray** (Windows/Mac - Direct Hardware Printing)

Sends print jobs directly to any network or USB printer.

#### Requirements:
- QZ Tray installed on **billing machine** only: https://qz.io
- Port 8181 open on that machine
- Printer names must match EXACTLY

#### Setup:
1. Install QZ Tray on your billing counter machine
2. Open QZ Tray Settings
3. Copy printer name from **Printers** section
4. In Settings → Printer routing:
   - Select: **QZ Tray**
   - Billing Printer name: `Billing Counter Printer` (exact match)
   - Kitchen Printer 1: `Kitchen Printer 1` (exact match)
   - Enable checkboxes for each

#### Get Printer Name:
1. **Windows**: Settings → Devices → Printers & Scanners (copy exact name)
2. **Mac**: System Preferences → Printers & Scanners (copy exact name)
3. **QZ Tray**: See real printer names in QZ settings

**Example:**
- Printer installed as: `Epson TM-T88V`
- QZ name: `Epson TM-T88V` ← **Use this exactly**
- In Settings: Enter `Epson TM-T88V`

---

### 3️⃣ **Local Service** (Self-hosted Print Bridge)

Runs a print server on your machine and sends jobs via HTTP.

#### Requirements:
- Node.js print service running locally
- Service URL configured (e.g., `http://192.168.1.100:5000`)

#### Setup:
1. Deploy print service: See [Local Print Service Setup](#local-print-service-setup)
2. In Settings:
   - Select: **Local Service**
   - Service URL: `http://192.168.1.100:5000` (your machine IP:port)
   - Configure printer names as they appear on your system

---

## Configuration UI

### Printer Routing Section

```
┌─ Printer routing
│  Help text depends on selected provider
│
├─ Print provider dropdown
│  • Browser (default, safe fallback)
│  • QZ Tray (direct hardware printing)
│  • Local Service (custom print bridge)
│
├─ [✓] Auto-print KOT
│  Send each new KOT to every enabled kitchen printer
│
├─ [✓] Auto-print bill
│  Send settled bills directly to the billing printer
│
├─ Receipt width: 80mm (or 58mm)
│
├─ Service URL (only for Local Service)
│
├─ Billing printer (single printer for bills only)
│  Name: "Billing Counter Printer"
│  [✓] Enabled
│
└─ Kitchen printers (multiple printers, all get KOT)
   Kitchen Printer 1: "Epson TM-T88V"      [✓]
   Kitchen Printer 2: "Brother HL-L8360..  [✓]
   [+ Add printer]
```

---

## Step-by-Step Setup

### For First Time (Browser Mode - SAFE)

1. **Settings** → **Printer Routing**
2. Provider: **Browser** ← Already selected by default
3. Receipt width: **80mm** (or 58mm for thermal)
4. Leave other fields empty
5. Click **Save settings**
6. ✅ All prints now go to browser dialog (safe fallback)

### To Enable QZ Tray (Direct Printing)

**Prerequisites:**
- QZ installed on billing machine
- Printer names obtained from system

**Steps:**
1. Get your printer names:
   - Windows: Settings → Devices → Printers & Scanners → copy name
   - Mac: System Preferences → Printers & Scanners → select printer → copy name
2. Settings → Printer Routing
3. Provider: Select **QZ Tray**
4. Billing printer:
   - Name: `[Your Billing Printer Name]` (paste exact name)
   - ✓ Enable
5. Kitchen Printer 1:
   - Name: `[Your Kitchen Printer Name]`
   - ✓ Enable
6. ✓ Auto-print KOT (sends KOT to all enabled kitchen printers)
7. ✓ Auto-print Bill (sends bill to billing printer)
8. Click **Save settings**

### To Enable Local Service (Custom)

See section below.

---

## Auto-Print Rules

### ✓ Auto-print KOT

```
When: Kitchen ticket created (after waiter approves order)
    ↓
Send to: ALL enabled kitchen printers
    ↓
Behavior:
  - QZ/Local: Sends directly to print queue
  - Browser: Opens print dialog (user confirms)
```

### ✓ Auto-print Bill

```
When: Order settled (payment received)
    ↓
Send to: Billing printer ONLY
    ↓
Behavior:
  - QZ/Local: Sends directly to print queue
  - Browser: Opens print dialog (user confirms)
```

---

## Print Flow Examples

### Example 1: Restaurant with QZ + Auto-print enabled

```
Waiter creates order
    ↓
Waiter approves → KOT generated
    ↓
[Auto-print KOT enabled?] YES
    ↓
Send KOT to ALL kitchen printers:
  - Kitchen Printer 1 (Epson) ✓
  - Kitchen Printer 2 (Brother) ✓
    ↓
Both printers print simultaneously
    ↓
Manager settles bill
    ↓
[Auto-print Bill enabled?] YES
    ↓
Send bill to Billing printer only ✓
```

### Example 2: Restaurant with Browser mode

```
Waiter creates order
    ↓
Waiter approves → KOT generated
    ↓
[Auto-print KOT enabled?] YES
    ↓
[Provider = Browser?] YES
    ↓
Opens browser print dialog in background
User must click "Print" ← MANUAL STEP
    ↓
Kitchen prints manually
```

---

## Troubleshooting

### "Could not save printer settings"

**Solution:** Run the Supabase migration (see "Fix" section above)

### Printer name not found

**QZ Tray:**
1. Ensure QZ is running on the machine
2. Get exact printer name from: QZ Settings → Printers
3. Match EXACTLY (case-sensitive, spaces matter)
4. Test: Print from QZ → confirm printer works

**Windows:**
1. Control Panel → Devices and Printers
2. Right-click printer → Printer properties
3. Copy exact name shown

### KOT prints to billing printer

**Cause:** Kitchen and billing printer names are same

**Solution:**
1. Set **different** names for each printer
2. Or: Set kitchen printer as "disabled" if not needed

### Bill doesn't auto-print

**Check:**
1. ✓ Auto-print Bill enabled?
2. ✓ Billing printer is enabled?
3. ✓ Billing printer name matches system?
4. Provider: QZ/Local (Browser mode requires manual click)

---

## Local Print Service Setup

### For advanced users wanting self-hosted solution

Coming soon. Contact support for custom print bridge deployment.

---

## Multi-Restaurant Setup

Each restaurant has **own** printer configuration:

```
Restaurant A:
  - Billing printer: "Counter" 
  - Kitchen: ["Main Kitchen", "Prep"]

Restaurant B:
  - Billing printer: "Bar Counter"
  - Kitchen: ["Bar", "Grill"]
```

No cross-restaurant print jobs. Isolated by `restaurant_id`.

---

## FAQ

**Q: Can I use same printer for bills and KOT?**  
A: Not recommended. Use different printer names/devices.

**Q: What if printer is unavailable?**  
A: Falls back to browser print dialog automatically.

**Q: Do I need QZ Tray on every machine?**  
A: Only on the **billing counter machine**. Kitchen printers can be:
- Network printers (connected via hostname)
- Local USB (on same machine as QZ)
- Remote QZ instances (advanced)

**Q: Can I add 10 kitchen printers?**  
A: Maximum 10 printers per restaurant. Each enabled printer gets every KOT.

**Q: Does auto-print work offline?**  
A: No. Requires network connection to print server/QZ.

---

## Next Steps

1. ✅ Run Supabase migration
2. ✅ Choose printer provider (Browser = safe)
3. ✅ Get printer names from your system
4. ✅ Configure in Settings → Printer Routing
5. ✅ Test printing from POS
6. ✅ Enable auto-print when ready
