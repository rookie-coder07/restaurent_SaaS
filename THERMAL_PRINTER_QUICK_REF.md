# Thermal Printer Width Fix - Quick Reference

## 🎯 What Changed?

**Before:** Hard-coded 25-dash separator lines, causing truncation on physical printers  
**After:** Dynamic separator lines that adapt to printer width (58mm or 80mm)

---

## ⚡ Quick Start (2 minutes)

### Print KOT on 58mm Printer
```javascript
import { printKotInstant } from './utils/thermalPrinter';

printKotInstant({
  ticket: kotTicket,
  order: orderData,
  restaurant: restaurantData,
  printerWidth: '58mm'  // ← Dynamic width
});
```

### Print Bill on 80mm Printer
```javascript
import { printBillInstant } from './utils/thermalPrinter';

printBillInstant({
  order: orderData,
  restaurant: restaurantData,
  invoice: invoiceData,
  cashierName: 'John Doe',
  printerWidth: '80mm'  // ← Default, can omit
});
```

---

## 📊 Key Changes

| Component | Change | Line # |
|-----------|--------|--------|
| **Config** | Added `PRINTER_WIDTHS` object | 8-11 |
| **Utils** | Added 4 utility functions | 12-48 |
| **KOT HTML** | Dynamic separators (4 replaced) | 103-181 |
| **Bill HTML** | Dynamic separators (5 replaced) | 369-699 |
| **Exports** | Updated function signatures | 716-799 |

---

## 🔧 Utility Functions

### Generate Separator
```javascript
import { generateSeparatorLine } from './utils/thermalPrinter';

const line58mm = generateSeparatorLine(30);   // 30 dashes
const line80mm = generateSeparatorLine(46);   // 46 dashes
```

### Set Printer Width Globally
```javascript
import { setPrinterWidth } from './utils/thermalPrinter';

setPrinterWidth('58mm');   // Use 58mm for all subsequent prints
```

### Get Current Printer Width
```javascript
import { getPrinterWidth } from './utils/thermalPrinter';

const width = getPrinterWidth();  // Returns 32 or 48
```

### Align Text (Left/Right)
```javascript
import { alignThermalText } from './utils/thermalPrinter';

const line = alignThermalText('Item Name', '₹99.99', 32);
```

---

## 📐 Printer Specifications

| Size | Chars/Line | Separator Dashes | Parameter |
|------|-----------|-----------------|-----------|
| 58mm | 32 | 30 | `'58mm'` |
| 80mm | 48 | 46 | `'80mm'` |

---

## ✅ Implementation Checklist

### For Each Print Call
- [ ] Determine target printer width (58mm or 80mm)
- [ ] Add `printerWidth` parameter to function call
- [ ] Test output on actual thermal printer
- [ ] Verify no line truncation

### Example Update
```javascript
// ❌ Before (no width specified)
printKotInstant({ ticket, order, restaurant });

// ✅ After (width specified)
printKotInstant({ ticket, order, restaurant, printerWidth: '58mm' });
```

---

## 🐛 Troubleshooting

| Problem | Check | Fix |
|---------|-------|-----|
| Lines still truncated | Is `printerWidth` passed? | Add parameter to function call |
| Lines too short | Is printer really 80mm? | Use `'58mm'` for narrow printers |
| Character rendering wrong | CSS font | Verify `.separator { font-family: 'Courier New' }` |

---

## 📝 Code Locations

**Main File:** `frontend/src/utils/thermalPrinter.js` (799 lines)

| Section | Lines | Purpose |
|---------|-------|---------|
| Printer Config | 8-11 | Width definitions |
| Utilities | 12-48 | Helper functions |
| KOT Generator | 103-181 | Kitchen ticket HTML |
| Bill Generator | 369-699 | Receipt/bill HTML |
| Export Functions | 716-799 | Print API |

---

## 🚀 Real-World Example

```javascript
// Kitchen Order Screen - Kitchen.js
import { printKotInstant } from '../utils/thermalPrinter';

function handlePrintKOT(ticket, order, restaurant) {
  // Get printer width from restaurant settings
  const printerWidth = restaurant.printer_width_mm === 58 ? '58mm' : '80mm';
  
  printKotInstant({
    ticket,
    order,
    restaurant,
    printerWidth  // ← Passes correct width
  });
}
```

---

## 🔄 Backward Compatibility

✅ **All existing code works without changes**
- `printerWidth` has default value `'80mm'`
- Graceful fallback for calls without parameter
- No breaking changes

---

## 📚 Full Documentation

See: [THERMAL_PRINTER_WIDTH_FIX.md](THERMAL_PRINTER_WIDTH_FIX.md)

