# Receipt Modifications Summary

## Changes Made

### 1. Shift Closure Receipt (`CloseShiftPage.tsx`)
**Location**: `src/core/pages/CloseShiftPage.tsx`

The shift closure page already displays `total_debt_amount` in the UI (line 537):
```tsx
<div className="text-lg sm:text-xl md:text-2xl font-bold text-amber-800 truncate">
  {summary.total_debt_amount?.toLocaleString() || '0'}
</div>
```

### 2. Thermal Printer Service Updates (`server.js`)
**Location**: `thermal-printer-service/server.js`

#### Added to Shift Closure Receipt Printing:

1. **Sales Statistics Section** (after cash information, around line 393-402):
   - Added new section showing:
     - Продаж (number of sales)
     - Сумма продаж (total sales amount)
     - **Сумма долгов (total debt amount)** ← NEW

2. **Totals Section** (around line 452-456):
   - Changed "Возврат" to **"Возврат сумма"** 
   - Added **"Сумма долгов"** line with `total_debt_amount`

3. **System Printer Fallback** (around lines 537-538):
   - Updated text content to include "Возврат сумма" and "Сумма долгов"

4. **Test Endpoint** (around lines 1213-1214 and 1240-1241):
   - Updated test data printing to use "Возврат сумма" instead of "Сумма возвратов"
   - Ensured "Сумма долгов" is displayed

#### Sale Receipt Template Variables:

5. **Template Variable Replacements** (around lines 595-603):
   - Added `"{{sale_id}}"` variable mapping to `saleData.id` (for receipt number display)
   - Added `"{{returnAmount}}"` as alias for `"{{change}}"` (for Russian "Возврат сумма")

## Usage

### In Receipt Templates:
- Use `{{sale_id}}` in your receipt template where you want to display: **Чек Nº: {{sale_id}}**
- Use `{{returnAmount}}` where you want to display: **Возврат сумма: {{returnAmount}}**
- The old `{{change}}` still works for backward compatibility

### Example Receipt Template Text:
```
Чек Nº: {{sale_id}}
Дата: {{date}}
Время: {{time}}
...
Итого: {{total}}
Возврат сумма: {{returnAmount}}
```

## Testing

After restarting the thermal printer service:
```bash
cd /Users/jamshid/projects/stock-control/thermal-printer-service
npm start
```

The receipts will now:
1. ✅ Show `total_debt_amount` in shift closure receipts
2. ✅ Display "Возврат сумма" instead of just "Возврат" 
3. ✅ Support `{{sale_id}}` variable in sale receipt templates
4. ✅ Support `{{returnAmount}}` for change amount display

## Files Modified:
- `/Users/jamshid/projects/stock-control/thermal-printer-service/server.js`
