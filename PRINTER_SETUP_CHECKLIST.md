# Printer Setup Checklist

## 🚨 Fix: Enable Printer Settings (Do This First!)

- [ ] Open Supabase Console: https://app.supabase.com
- [ ] Select your project
- [ ] Click SQL Editor (left sidebar)
- [ ] Copy the migration SQL from `PRINTER_SETUP_GUIDE.md` (Fix section)
- [ ] Paste into SQL Editor and click **Run**
- [ ] Refresh your Settings page
- [ ] Try saving printer settings again

**If error persists:** Check browser console (F12) for error details

---

## 🖨️ Choose Your Printer Provider

### Option A: Browser Mode (SAFE - Start Here)
- ✅ No setup needed
- ✅ Works everywhere
- ❌ Requires manual print dialog click
- ❌ No auto-print to hardware

**Setup:**
- [ ] Settings → Printer Routing
- [ ] Print provider: **Browser**
- [ ] Receipt width: **80mm** (or 58mm)
- [ ] Leave other fields empty
- [ ] Save settings

**Result:** All prints open in browser print dialog

---

### Option B: QZ Tray (RECOMMENDED - Direct Hardware Printing)
- ✅ Direct hardware printing
- ✅ Auto-print to printers
- ✅ Works for KOT & Bills
- ❌ Requires QZ Tray on billing machine
- ❌ Printer names must match EXACTLY

**Setup:**
1. [ ] Install QZ Tray on billing counter machine
   - Download: https://qz.io
   - Keep it running
2. [ ] Get your printer names
   - Windows: Settings → Devices → Printers & Scanners
   - Mac: System Preferences → Printers & Scanners
   - Copy exact names
3. [ ] Settings → Printer Routing
   - [ ] Print provider: **QZ Tray**
   - [ ] Billing printer name: (paste exact name)
   - [ ] Billing printer: Enable ✓
   - [ ] Kitchen Printer 1: (paste exact name)
   - [ ] Kitchen Printer 1: Enable ✓
   - [ ] Receipt width: **80mm**
   - [ ] Auto-print KOT: Enable ✓
   - [ ] Auto-print Bill: Enable ✓
4. [ ] Save settings

**Test:**
- [ ] Create an order in POS
- [ ] Check if KOT prints automatically
- [ ] Settle order and check if bill prints

---

### Option C: Local Service (ADVANCED)
- ✅ Self-hosted
- ✅ Full control
- ❌ Requires Node.js server
- ❌ Complex setup

**Status:** Support available, contact team

---

## 🧪 Test Your Printer Configuration

### Test 1: Save Settings
- [ ] Open Settings
- [ ] Go to Printer Routing
- [ ] Make one small change
- [ ] Click "Save settings"
- [ ] Verify: Message says "Billing and printer settings saved."

### Test 2: Create KOT (if auto-print enabled)
- [ ] Go to POS
- [ ] Add items to order
- [ ] Create order
- [ ] Check: Did KOT print? (or print dialog open?)

### Test 3: Settle Bill (if auto-print enabled)
- [ ] Settle the order entirely
- [ ] Check: Did bill print? (or print dialog open?)

---

## ❌ Troubleshooting

### "Could not save printer settings" Error

**✅ Solution 1:** Run Supabase migration
   - See "Fix" section above
   - Then refresh page and try again

**✅ Solution 2:** Check browser console
   - Press F12 → Console tab
   - Look for red error message
   - Copy and share with support

**✅ Solution 3:** Clear form and try minimal config
   - Set provider to "Browser"
   - Leave all other fields empty
   - Save
   - If that works, add fields one by one

---

### "Could not connect to printer" Error

**For QZ Tray:**
- [ ] Is QZ Tray running on your machine?
- [ ] Is printer powered on?
- [ ] Does printer name match EXACTLY?
  - Copy from System → Printers
  - Paste into Settings (no typos!)
- [ ] Try different printer name format:
  - "Printer Name" (with spaces)
  - "Printer_Name" (with underscores)
- [ ] Restart QZ Tray

**For Local Service:**
- [ ] Is print service running?
- [ ] Is service URL correct?
- [ ] Test URL in browser: `http://[URL]/health`

---

### Printer prints to wrong printer

**Check:**
1. [ ] Printer names are different
   - Billing: "Counter"
   - Kitchen: "Main Kitchen"
2. [ ] Correct printer is assigned? (in Settings)
3. [ ] Is printer in Windows/Mac printers list?

---

### Auto-print not working

**Check:**
1. [ ] Provider is QZ or Local (not Browser)?
2. [ ] ✓ Auto-print KOT enabled?
3. [ ] ✓ Auto-print Bill enabled?
4. [ ] Printer is enabled in Settings?
5. [ ] Printer is powered on and online?

**Test:**
- [ ] Try manual print (Print button in POS)
- [ ] If manual works → troubleshoot auto-print logic
- [ ] If manual fails → troubleshoot printer connection

---

## 📋 Your Current Configuration

After setup, fill this in:

```
Provider: [Browser / QZ Tray / Local Service]
Receipt width: [58mm / 80mm]

Billing printer:
  Name: _________________________
  Enabled: [✓ Yes / No]

Kitchen printers:
  1. Name: _________________________
     Enabled: [✓ Yes / No]
  
  2. Name: _________________________
     Enabled: [✓ Yes / No]

Auto-print KOT: [✓ Yes / No]
Auto-print Bill: [✓ Yes / No]
```

---

## 📞 Support

- Guides: See `PRINTER_SETUP_GUIDE.md`
- Migration issues: Check Supabase SQL Editor for errors
- QZ Tray help: https://qz.io/support
- Local service: Contact support team

---

## ✅ Ready to Go!

Once you complete this checklist:
1. ✅ Migration ran successfully
2. ✅ Printer provider configured
3. ✅ Printer names entered
4. ✅ Settings saved
5. ✅ Test print successful

**You're ready for production printer routing!**
