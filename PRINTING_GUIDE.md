# Receipt Printing Guide - SalesPage

## Issue Fixed
The `sale_id` was not being printed in receipts when printing from SalesPage.

## Changes Made

### 1. **SaleData Interface** (`saleReceiptService.ts`)
Added the `sale_id` field to the `SaleData` interface:
```typescript
export interface SaleData {
  id: number;
  sale_id?: string;  // ← ADDED
  store_read: { ... };
  // ... rest of interface
}
```

### 2. **Server.js Template Variables**
Updated the template variable replacements to prioritize `sale_id`:
```javascript
const replacements = {
  "{{receiptNumber}}": (saleData.sale_id || saleData.id)?.toString() || "",
  "{{sale_id}}": (saleData.sale_id || saleData.id)?.toString() || "",
  "{{returnAmount}}": change.toLocaleString("ru-RU"),
  // ... other variables
};
```

### 3. **Your Template Configuration**
Your template is correctly configured with:
```json
{
  "id": "receipt-info",
  "data": {
    "text": "Чек №: {{sale_id}}\nДата: {{date}} {{time}}\nКассир: {{cashierName}}"
  }
}
```

And:
```json
{
  "id": "payment-info",
  "data": {
    "text": "СПОСОБ ОПЛАТЫ:\n{{payments}}\nВозврат: {{returnAmount}} UZS"
  }
}
```

## How to Test

### 1. **Restart the Thermal Printer Service**
```bash
cd /Users/jamshid/projects/stock-control/thermal-printer-service
npm start
```

### 2. **Test from SalesPage**
1. Open your application
2. Go to **Sales Page** (`/sales`)
3. Find any sale in the list
4. Click the **Print** button (🖨️)
5. The receipt should now print with:
   - ✅ **Чек №: [actual sale_id]** (e.g., "Чек №: 187")
   - ✅ **Возврат: [change amount] UZS** (instead of "Сдача")

### 3. **Verify the Receipt Shows**
- The sale ID from the database (not a static number)
- "Возврат" label for change amount
- All sale items
- Payment methods
- Total amount

## Debugging

If the receipt still doesn't print the sale_id:

1. **Check Browser Console**
   - Open DevTools (F12)
   - Look for printing errors
   - Check if `sale_id` is in the sale data

2. **Check Server Logs**
   ```bash
   # In thermal-printer-service terminal
   # Look for: "Printing sale receipt for Sale ID: XXX"
   ```

3. **Verify Sale Data**
   Add this temporarily to see the data:
   ```typescript
   const handlePrintReceipt = async (sale: Sale) => {
     console.log("Sale data:", sale);  // ← Add this
     console.log("Sale ID:", sale.sale_id);  // ← And this
     // ... rest of function
   }
   ```

## API Data Structure

The sale data from the API should include:
```typescript
{
  id: 123,              // Database ID
  sale_id: "187",       // Display ID (the one shown in receipts)
  store_read: { ... },
  sale_items: [ ... ],
  sale_payments: [ ... ],
  total_amount: "1000.00",
  sold_date: "2025-10-22T...",
  worker_read: { ... }
}
```

## Files Modified
1. `/Users/jamshid/projects/stock-control/stock-control-uz/src/services/saleReceiptService.ts`
2. `/Users/jamshid/projects/stock-control/thermal-printer-service/server.js`

## Next Steps
After restarting the thermal printer service, all receipts printed from SalesPage will:
- ✅ Show the correct `sale_id` number
- ✅ Display "Возврат" instead of "Сдача"
- ✅ Use all the updated template variables

The changes are backward compatible - if `sale_id` is not provided, it will fall back to using `id`.
