# POS Monoblock Printing Fix

## Issue
Printing fails on POS monoblock systems with error:
```
Exception calling 'Print' with '0' argument(s): "The printer is not accepting print jobs"
```

## Root Causes

### 1. **Cyrillic Username Path Encoding** (Primary Issue)
- Windows temp path: `C:\Users\админ\AppData\Local\Temp\`
- PowerShell cannot properly handle Cyrillic characters in file paths
- Causes encoding errors when reading temp files

### 2. **POS Printer Driver Compatibility**
- Many POS thermal printer drivers (like POS-58-Series) don't fully support .NET `PrintDocument` API
- Drivers are optimized for ESC/POS raw commands, not Windows GDI printing
- Some drivers reject print jobs from .NET applications

### 3. **Printer State Issues**
- Printer might be in offline/paused state
- Print spooler might be overwhelmed
- Driver might require specific initialization

## Solution Implemented

### Fix 1: ASCII-Safe Temp Directory
```javascript
// Changed from: os.tmpdir() (contains Cyrillic username)
// Changed to: C:\Temp (ASCII-safe path)
tempDir = 'C:\\Temp';
```

### Fix 2: Printer Status Check
```javascript
// Check if printer is online before attempting to print
const statusCheck = execSync(`powershell -Command "Get-Printer -Name '${printerName}'...`);
```

### Fix 3: Multi-Layer Fallback
1. **Primary**: .NET PrintDocument with validation
2. **Fallback**: PowerShell `Out-Printer` cmdlet (POS-compatible)
3. Automatic retry if printer is busy

### Fix 4: Enhanced Error Handling
- Checks printer validity before printing
- Verifies printer accepts jobs
- Better error messages for diagnostics

## How to Test

1. **Restart the service:**
   ```powershell
   # Stop current service (Ctrl+C if running)
   # Start fresh:
   node server.js
   ```

2. **Look for these messages:**
   ```
   ✅ Print Spooler service is running
   📋 Available Windows Printers:
      - POS-58-Series (3) (POS-58-Series Driver)
   ✅ Detected thermal printer: POS-58-Series (3)
   📊 Printer status: Normal
   ```

3. **Send a test print** from your POS application

4. **Expected output (one of):**
   - `✅ Printed successfully using .NET method`
   - `✅ Printed successfully using POS-compatible method`

## If Still Not Working

### Check Printer Status
```powershell
Get-Printer -Name "POS-58-Series (3)" | Select-Object Name, PrinterStatus, JobCount
```

### Fix Offline Printer
```powershell
# Set printer online
Set-Printer -Name "POS-58-Series (3)" -PrinterStatus Normal

# Clear print queue
Get-PrintJob -PrinterName "POS-58-Series (3)" | Remove-PrintJob
```

### Restart Print Spooler
```powershell
Restart-Service -Name Spooler -Force
```

### Check C:\Temp Permissions
```powershell
# Ensure C:\Temp exists and is writable
New-Item -Path "C:\Temp" -ItemType Directory -Force
icacls "C:\Temp" /grant Users:F
```

## Why It Works on Other Systems

- **Other systems**: May have ASCII usernames (no encoding issues)
- **Other systems**: May have different/newer printer drivers
- **Other systems**: May have different Windows configurations
- **POS monoblocks**: Often have:
  - Cyrillic/non-ASCII usernames (common in regional POS systems)
  - Specialized thermal printer drivers optimized for ESC/POS
  - Locked-down Windows configurations
  - Custom printer port mappings

## Technical Details

### Before Fix
```
User Temp Path → C:\Users\админ\AppData\Local\Temp\
                      ↓
              [Encoding Error]
                      ↓
         PowerShell can't read file
                      ↓
         Print job fails
```

### After Fix
```
ASCII Path → C:\Temp\thermal_receipt.txt
                ↓
    PowerShell reads correctly
                ↓
    Try .NET PrintDocument
                ↓
         If fails → Try Out-Printer
                ↓
         Print succeeds
```

## Additional Notes

- The fix creates `C:\Temp` directory automatically
- Temp files are cleaned up after each print
- Both methods work with POS thermal printers
- No changes needed to your POS application
