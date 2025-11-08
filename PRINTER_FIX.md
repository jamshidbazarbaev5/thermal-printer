# Thermal Printer Driver Fix

## Problem
The POS-58-Series thermal printer was failing with error:
```
Exception calling "Print" with "0" argument(s): "The printer driver was not successful"
```

This occurred because the previous implementation used `System.Drawing.Printing.PrintDocument` which relies on GDI (Graphics Device Interface) printing. Many thermal POS printers don't support GDI printing and expect raw ESC/POS commands instead.

## Solution
Updated the `printUsingSystemPrinter` function in `server.js` to use raw printer API calls:

### Primary Method: Raw Printer API
- Uses Windows `winspool.drv` API functions directly
- Opens printer with `OpenPrinter`
- Sends data as "RAW" type using `WritePrinter`
- This bypasses the driver's GDI layer and sends text directly to the printer
- Compatible with thermal POS printers that expect raw data

### Fallback Method: Copy-to-Printer
- Attempts to copy file directly to printer using network path
- For USB printers: `copy /b <file> \\localhost\<printer>`
- Falls back to `Out-Printer` cmdlet if direct copy fails

## Key Changes
1. **Raw printing** - Data type set to "RAW" instead of using PrintDocument
2. **Direct API calls** - Uses P/Invoke to call Windows printer functions
3. **Better fallback** - Multiple methods to ensure printing succeeds

## Testing
After restarting the server, try printing again. The new implementation should work with:
- POS-58-Series printers
- XP-58/XP-80C thermal printers
- Other ESC/POS compatible printers

## Technical Details
The raw printing method:
1. Opens printer handle with `OpenPrinter`
2. Starts print job with `StartDocPrinter` (data type: "RAW")
3. Starts page with `StartPagePrinter`
4. Writes data with `WritePrinter`
5. Closes page and document
6. Closes printer handle

This ensures data goes directly to the printer without any driver transformation.
