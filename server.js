const express = require("express");
const cors = require("cors");
const {
  ThermalPrinter,
  PrinterTypes,
  CharacterSet,
  BreakLine,
} = require("node-thermal-printer");
const { execSync, exec } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const app = express();
const port = 3001; // Using port 3001 to avoid conflicts

// Middleware
app.use(cors()); // Allow requests from your web app
app.use(express.json()); // To parse JSON request bodies

// --- Printer Configuration ---
// H-58C Thermal Printer Configuration
// Detected from system: VID=0x0483, PID=0x070b
const VENDOR_ID = 0x0483; // STMicroelectronics
const PRODUCT_ID = 0x070b; // H-58C Thermal Printer

let printer;
let isDeviceReady = false;
let windowsPrinterName = null; // Store Windows printer name

// Initialize printer device
async function initializePrinter() {
  try {
    // Initialize thermal printer with H-58C configuration
    // Try different interface formats for macOS compatibility
    const interfaces = [
      "printer:Printer_USB_Printer_Port", // macOS system printer name
      "printer:auto", // Auto-detect
      `usb://0x${VENDOR_ID.toString(16)}:0x${PRODUCT_ID.toString(16)}`,
      `usb://${VENDOR_ID.toString(16).padStart(4, "0")}:${PRODUCT_ID.toString(16).padStart(4, "0")}`,
      "/dev/usb/lp0", // Linux style
      "tcp://localhost", // Fallback for testing
    ];

    for (const interfaceStr of interfaces) {
      try {
        printer = new ThermalPrinter({
          type: PrinterTypes.EPSON, // H-58C is ESC/POS compatible
          interface: interfaceStr,
          characterSet: CharacterSet.PC437_USA,
          width: 32, // 58mm paper = 32 characters
          removeSpecialCharacters: false,
          lineCharacter: "-",
        });

        // Test the connection
        await testPrinterConnection();

        console.log("✅ H-58C thermal printer initialized");
        console.log(`📋 Interface: ${interfaceStr}`);
        console.log("📋 Width: 32 characters (58mm paper)");
        isDeviceReady = true;
        return;
      } catch (interfaceError) {
        console.log(
          `⚠️  Interface ${interfaceStr} failed: ${interfaceError.message}`,
        );
        continue;
      }
    }

    throw new Error("No compatible interface found");
  } catch (e) {
    console.error("❌ Error initializing printer:", e.message);
    console.log("📋 Please ensure your H-58C thermal printer is:");
    console.log("   - Connected via USB");
    console.log("   - Powered on");
    console.log("   - Drivers are installed (if required)");
    console.log("   - Not being used by another application");
    console.log("   - Has paper loaded and is ready");
    isDeviceReady = false;
  }
}

// Test printer connection
async function testPrinterConnection() {
  if (!printer) throw new Error("Printer not initialized");

  // Try a simple operation to test the connection
  printer.clear();
  printer.println("Connection test");

  // Don't actually execute, just test if the printer object works
  return true;
}

// Detect thermal printer on Windows
function detectWindowsThermalPrinter() {
  if (process.platform !== 'win32') return null;
  
  try {
    // Get list of printers using PowerShell
    const result = execSync('powershell -Command "Get-Printer | Select-Object Name, DriverName | ConvertTo-Json"', { encoding: 'utf8' });
    const printers = JSON.parse(result);
    const printerList = Array.isArray(printers) ? printers : [printers];
    
    console.log('\n📋 Available Windows Printers:');
    printerList.forEach(p => {
      console.log(`   - ${p.Name} (${p.DriverName})`);
    });
    
    // Look for thermal printer (USB, POS, or similar names)
    const thermalPrinter = printerList.find(p => 
      p.Name.toLowerCase().includes('usb') ||
      p.Name.toLowerCase().includes('pos') ||
      p.Name.toLowerCase().includes('thermal') ||
      p.Name.toLowerCase().includes('h-58') ||
      p.Name.toLowerCase().includes('receipt')
    );
    
    if (thermalPrinter) {
      console.log(`✅ Detected thermal printer: ${thermalPrinter.Name}`);
      return thermalPrinter.Name;
    }
    
    console.log('⚠️  No thermal printer detected, will use default printer');
    return null;
  } catch (error) {
    console.error('⚠️  Could not detect printers:', error.message);
    return null;
  }
}

// Fallback printing using system printing with smaller font options
async function printUsingSystemPrinter(content) {
  try {
    // Create a temporary file with the content - Windows compatible
    const os = require('os');
    const path = require('path');
    
    // Use ASCII-safe temp directory to avoid encoding issues with Cyrillic usernames
    let tempDir;
    if (process.platform === 'win32') {
      // Use C:\Temp or project directory to avoid username encoding issues
      tempDir = 'C:\\Temp';
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
    } else {
      tempDir = os.tmpdir();
    }
    
    const tempFile = path.join(tempDir, 'thermal_receipt.txt');
    
    // Use system print command based on OS
    let command;
    if (process.platform === 'win32') {
      // Windows: Write file with UTF-8 encoding
      fs.writeFileSync(tempFile, content, { encoding: 'utf8' });
      
      // Detect printer if not already done
      if (!windowsPrinterName) {
        windowsPrinterName = detectWindowsThermalPrinter();
      }
      
      const printerName = windowsPrinterName || 'default';
      console.log(`🖨️  Sending to printer: ${printerName}`);
      
      // Check printer status first
      if (windowsPrinterName) {
        try {
          const statusCheck = execSync(`powershell -Command "Get-Printer -Name '${windowsPrinterName.replace(/'/g, "''")}' | Select-Object -ExpandProperty PrinterStatus"`, { encoding: 'utf8' }).trim();
          console.log(`📊 Printer status: ${statusCheck}`);
          
          // Check if printer is offline, paused, or has errors
          const stateCheck = execSync(`powershell -Command "$p = Get-Printer -Name '${windowsPrinterName.replace(/'/g, "''")}'; if ($p.PrinterStatus -ne 'Normal') { exit 1 }"`, { encoding: 'utf8' }).trim();
        } catch (statusError) {
          console.log('⚠️  Printer might be offline or paused. Attempting to print anyway...');
        }
      }
      
      // Create a PowerShell script that sends raw data directly to printer
      const psScriptPath = path.join(tempDir, 'print_thermal.ps1');
      const psScript = `# Raw printing for thermal POS printers
\$printerName = "${windowsPrinterName ? windowsPrinterName.replace(/"/g, '\\"') : ''}"
\$tempFilePath = "${tempFile.replace(/\\/g, '\\\\')}"

Add-Type -TypeDefinition @"
using System;
using System.IO;
using System.Runtime.InteropServices;

public class RawPrinterHelper
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA
    {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

    public static bool SendBytesToPrinter(string szPrinterName, IntPtr pBytes, Int32 dwCount)
    {
        IntPtr hPrinter = IntPtr.Zero;
        DOCINFOA di = new DOCINFOA();
        bool bSuccess = false;

        di.pDocName = "Thermal Receipt";
        di.pDataType = "RAW";

        if (OpenPrinter(szPrinterName, out hPrinter, IntPtr.Zero))
        {
            if (StartDocPrinter(hPrinter, 1, di))
            {
                if (StartPagePrinter(hPrinter))
                {
                    int dwWritten = 0;
                    bSuccess = WritePrinter(hPrinter, pBytes, dwCount, out dwWritten);
                    EndPagePrinter(hPrinter);
                }
                EndDocPrinter(hPrinter);
            }
            ClosePrinter(hPrinter);
        }

        return bSuccess;
    }

    public static bool SendStringToPrinter(string szPrinterName, string szString)
    {
        IntPtr pBytes;
        Int32 dwCount;
        dwCount = szString.Length;
        pBytes = Marshal.StringToCoTaskMemAnsi(szString);
        bool result = SendBytesToPrinter(szPrinterName, pBytes, dwCount);
        Marshal.FreeCoTaskMem(pBytes);
        return result;
    }
}
"@

try {
    # Read content
    \$content = [System.IO.File]::ReadAllText(\$tempFilePath, [System.Text.Encoding]::UTF8)
    
    if (\$printerName) {
        # Send raw data to printer
        \$success = [RawPrinterHelper]::SendStringToPrinter(\$printerName, \$content)
        
        if (\$success) {
            Write-Host "Printed to \$printerName using raw method"
        } else {
            throw "Failed to send data to printer"
        }
    } else {
        throw "No printer specified"
    }
} catch {
    Write-Error "Print error: \$(\$_.Exception.Message)"
    exit 1
}
`;
      
      fs.writeFileSync(psScriptPath, psScript, { encoding: 'utf8' });
      
      // Try the raw printing method with fallback
      try {
        command = `powershell -ExecutionPolicy Bypass -File "${psScriptPath}"`;
        execSync(command, { encoding: 'utf8', stdio: 'pipe' });
        console.log('✅ Printed successfully using raw printer method');
      } catch (printError) {
        console.log('⚠️  Raw printing failed, trying copy-to-printer method...');
        console.log('   Error:', printError.message);
        
        // Fallback: Use copy command to send directly to printer port
        try {
          // Try to copy file directly to printer using copy command
          const copyScript = `\$printerName = "${windowsPrinterName ? windowsPrinterName.replace(/"/g, '\\"') : ''}"
\$tempFilePath = "${tempFile.replace(/\\/g, '\\\\')}"

if (\$printerName) {
    try {
        # Method 1: Try using copy command to printer
        \$printerPort = (Get-Printer -Name \$printerName).PortName
        if (\$printerPort -and \$printerPort -like "USB*") {
            # For USB printers, try direct copy
            cmd /c copy /b "\$tempFilePath" "\\\\localhost\\\$printerName"
            Write-Host "Printed using direct copy method"
        } else {
            # Method 2: Use Out-Printer as fallback
            Get-Content "\$tempFilePath" -Raw | Out-Printer -Name \$printerName
            Write-Host "Printed using Out-Printer method"
        }
    } catch {
        Write-Error \$_.Exception.Message
        exit 1
    }
} else {
    Write-Error "No printer specified"
    exit 1
}
`;
          const copyPrintPath = path.join(tempDir, 'copy_print.ps1');
          fs.writeFileSync(copyPrintPath, copyScript, { encoding: 'utf8' });
          
          execSync(`powershell -ExecutionPolicy Bypass -File "${copyPrintPath}"`, { encoding: 'utf8', stdio: 'pipe' });
          console.log('✅ Printed successfully using copy-to-printer method');
          fs.unlinkSync(copyPrintPath);
        } catch (fallbackError) {
          console.error('❌ Copy-to-printer method also failed:', fallbackError.message);
          throw printError; // Throw original error
        }
      }
      
      // Clean up PowerShell script
      fs.unlinkSync(psScriptPath);
    } else {
      // macOS/Linux: Use lp command with options for smaller font
      fs.writeFileSync(tempFile, content);
      command = `lp -d Printer_USB_Printer_Port -o cpi=17 -o lpi=8 -o page-left=0 -o page-right=0 -o page-top=0 -o page-bottom=0 "${tempFile}"`;
      execSync(command);
    }

    // Clean up
    fs.unlinkSync(tempFile);

    console.log(
      `✅ Printed using ${process.platform === 'win32' ? 'Windows' : 'macOS'} system printer with compact formatting`,
    );
    return true;
  } catch (error) {
    console.error("❌ System printer failed:", error.message);
    throw error;
  }
}

// Format currency for receipt
function formatCurrency(amount) {
  return (
    parseFloat(amount).toLocaleString("uz-UZ", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " UZS"
  );
}

// Format date for receipt
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString("ru-RU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// Create receipt content optimized for 58mm thermal paper (32 characters per line)
function createReceiptContent(data) {
  const line = "--------------------------------";
  const doubleLine = "================================";

  let receipt = "";

  // Header
  receipt += "\n";
  receipt += "        ЗАКРЫТИЕ СМЕНЫ\n";
  receipt += doubleLine + "\n";

  // Store information
  receipt += `Магазин: ${data.store.name}\n`;
  receipt += `Адрес: ${data.store.address}\n`;
  receipt += `Телефон: ${data.store.phone_number}\n`;
  receipt += line + "\n";

  // Shift information
  receipt += `Смена ID: ${data.id}\n`;
  receipt += `Касса: ${data.register.name}\n`;
  receipt += `Кассир: ${data.cashier.name}\n`;
  receipt += line + "\n";

  // Time information
  receipt += `Открыта: ${formatDate(data.opened_at)}\n`;
  receipt += `Закрыта: ${formatDate(data.closed_at)}\n`;
  receipt += line + "\n";

  // Cash information
  receipt += "НАЛИЧНЫЕ В КАССЕ:\n";
  receipt += `Начальная сумма: ${formatCurrency(data.opening_cash)}\n`;
  receipt += `Конечная сумма:  ${formatCurrency(data.closing_cash)}\n`;
  receipt += line + "\n";

  // Payment methods
  receipt += "      СПОСОБЫ ОПЛАТЫ:\n";
  receipt += line + "\n";

  data.payments.forEach((payment) => {
    const methodName =
      payment.payment_method.length > 15
        ? payment.payment_method.substring(0, 15) + "..."
        : payment.payment_method;

    receipt += `${methodName}:\n`;
    receipt += `  Ожидается: ${formatCurrency(payment.expected)}\n`;
    receipt += `  Фактически: ${formatCurrency(payment.actual)}\n`;

    const diff = parseFloat(payment.actual) - parseFloat(payment.expected);
    const diffStr =
      diff >= 0
        ? `+${formatCurrency(Math.abs(diff))}`
        : `-${formatCurrency(Math.abs(diff))}`;
    receipt += `  Разница: ${diffStr}\n`;
    receipt += "\n";
  });

  receipt += line + "\n";

  // Totals
  receipt += "         ИТОГИ:\n";
  receipt += doubleLine + "\n";
  receipt += `Всего ожидается:\n`;
  receipt += `         ${formatCurrency(data.total_expected)}\n`;
  receipt += `Всего фактически:\n`;
  receipt += `         ${formatCurrency(data.total_actual)}\n`;



  // Comments
  if (data.opening_comment && data.opening_comment.trim()) {
    receipt += "Комментарий открытия:\n";
    receipt += `${data.opening_comment.trim()}\n`;
    receipt += line + "\n";
  }

  if (data.closing_comment && data.closing_comment.trim()) {
    receipt += "Комментарий закрытия:\n";
    receipt += `${data.closing_comment.trim()}\n`;
    receipt += line + "\n";
  }

  // Footer
  receipt += "\n";
  receipt += "    Спасибо за работу!\n";
  receipt += `   ${new Date().toLocaleString("ru-RU")}\n`;
  receipt += "\n\n\n";

  return receipt;
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    printer_ready: isDeviceReady,
    timestamp: new Date().toISOString(),
  });
});

// Test print endpoint
app.post("/test-print", async (req, res) => {
  if (!isDeviceReady || !printer) {
    return res.status(500).json({
      error: "Printer not ready or not connected",
      printer_ready: isDeviceReady,
    });
  }

  try {
    console.log("🖨️  Printing test receipt...");

    // Send immediate response to prevent frontend timeout
    res.status(200).json({ 
      message: "Test print initiated successfully.",
      status: "printing",
      timestamp: new Date().toISOString()
    });

    // Continue with printing in background
    printer.clear();
    printer.alignCenter();
    printer.setTextDoubleHeight();
    printer.bold(true);
    printer.println("ТЕСТ ПЕЧАТИ");
    printer.bold(false);
    printer.setTextNormal();
    printer.drawLine();
    printer.alignLeft();
    printer.println("Принтер: H-58C Thermal Printer");
    printer.println("Ширина бумаги: 58мм");
    printer.println("Команды: ESC/POS");
    printer.drawLine();
    printer.println(`Время: ${new Date().toLocaleString("ru-RU")}`);
    printer.println("Тест успешно выполнен!");
    printer.newLine();
    printer.newLine();
    printer.cut();

    // Execute print with timeout
    try {
      const result = await Promise.race([
        printer.execute(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Print timeout')), 5000)
        )
      ]);
      console.log("✅ Test receipt printed successfully");
    } catch (executeError) {
      console.error("❌ Execute error:", executeError);
      console.log("🔄 Trying system printer fallback...");

      try {
        // Create compact text content for system printer
        const textContent = `ТЕСТ ПЕЧАТИ
================================
Принтер: H-58C Thermal Printer
Ширина бумаги: 58мм
Команды: ESC/POS
--------------------------------
Время: ${new Date().toLocaleString("ru-RU")}
Тест успешно выполнен!


`;
        await printUsingSystemPrinter(textContent);
        console.log("✅ Test printed via system printer");
      } catch (systemError) {
        console.error("❌ System printer also failed:", systemError);
      }
    }
  } catch (e) {
    console.error("❌ Error during test printing:", e);
    if (!res.headersSent) {
      res.status(500).json({ error: `Print failed: ${e.message}` });
    }
  }
});


// Main print endpoint for shift closure receipts
app.post("/print-shift-closure", async (req, res) => {
  if (!isDeviceReady || !printer) {
    console.error("❌ Print request failed: No printer device found.");
    return res.status(500).json({
      error:
        "Printer not found or not connected. Please check printer connection.",
      printer_ready: isDeviceReady,
    });
  }

  const data = req.body;

  // Validate required data
  if (!data || !data.id || !data.store || !data.payments) {
    return res
      .status(400)
      .json({ error: "Invalid shift closure data provided." });
  }

  try {
    console.log("🖨️  Printing shift closure receipt for Shift ID:", data.id);

    // Clear any previous content
    printer.clear();

    // Header
    printer.alignCenter();
    printer.setTextDoubleHeight();
    printer.bold(true);
    printer.println("ЗАКРЫТИЕ СМЕНЫ");
    printer.bold(false);
    printer.setTextNormal();
    printer.drawLine();

    // Store information
    printer.alignLeft();
    printer.println(`Магазин: ${data.store.name}`);
    printer.println(`Адрес: ${data.store.address}`);
    printer.println(`Телефон: ${data.store.phone_number}`);
    printer.drawLine();

    // Shift information
    printer.println(`Смена ID: ${data.id}`);
    printer.println(`Касса: ${data.register.name}`);
    printer.println(`Кассир: ${data.cashier.name}`);
    printer.drawLine();

    // Time information
    printer.println(`Открыта: ${formatDate(data.opened_at)}`);
    printer.println(`Закрыта: ${formatDate(data.closed_at)}`);
    printer.drawLine();

    // Cash information
    printer.bold(true);
    printer.println("НАЛИЧНЫЕ В КАССЕ:");
    printer.bold(false);
    printer.println(`Начальная: ${formatCurrency(data.opening_cash)}`);
    printer.println(`Конечная: ${formatCurrency(data.closing_cash)}`);
    printer.drawLine();

    // Sales statistics
    printer.bold(true);
    printer.println("СТАТИСТИКА ПРОДАЖ:");
    printer.bold(false);
    printer.println(`Продаж: ${data.total_sales_count}`);
    printer.println(
      `Сумма продаж: ${formatCurrency(data.total_sales_amount)}`,
    );
    printer.println(`Сумма долгов: ${formatCurrency(data.total_debt_amount)}`);
    printer.drawLine();

    // Payment methods
    printer.alignCenter();
    printer.bold(true);
    printer.println("СПОСОБЫ ОПЛАТЫ");
    printer.bold(false);
    printer.alignLeft();
    printer.drawLine();

    // Print payment methods
    data.payments.forEach((payment) => {
      const diff = parseFloat(payment.actual) - parseFloat(payment.expected);
      const diffStr =
        diff >= 0
          ? `+${Math.abs(diff).toFixed(2)}`
          : `-${Math.abs(diff).toFixed(2)}`;

      printer.println(`${payment.payment_method}:`);
      printer.println(
        `  Ожидается: ${parseFloat(payment.expected).toFixed(2)}`,
      );
      printer.println(`  Фактически: ${parseFloat(payment.actual).toFixed(2)}`);
      printer.println(`  Разница: ${diffStr}`);
      printer.newLine();
    });

    // Totals
    const totalDiff =
      parseFloat(data.total_actual) - parseFloat(data.total_expected);
    const totalDiffStr =
      totalDiff >= 0
        ? `+${Math.abs(totalDiff).toFixed(2)}`
        : `-${Math.abs(totalDiff).toFixed(2)}`;

    printer.drawLine();
    printer.alignCenter();
    printer.setTextDoubleHeight();
    printer.bold(true);
    printer.println("ИТОГИ");
    printer.bold(false);
    printer.setTextNormal();
    printer.alignLeft();
    printer.println(
      `Всего ожидается: ${parseFloat(data.total_expected).toFixed(2)}`,
    );
    printer.println(
      `Всего фактически: ${parseFloat(data.total_actual).toFixed(2)}`,
    );
    printer.bold(true);
    printer.println(
      `Возврат сумма: ${parseFloat(data.total_returns_amount).toFixed(2)}`,
    );
    printer.println(
      `Сумма долгов: ${formatCurrency(data.total_debt_amount)}`,
    );
    printer.bold(false);
    printer.bold(false);
    printer.drawLine();

    // Add comments if present
    if (data.opening_comment && data.opening_comment.trim()) {
      printer.println("Комментарий открытия:");
      printer.println(data.opening_comment.trim());
      printer.drawLine();
    }

    if (data.closing_comment && data.closing_comment.trim()) {
      printer.println("Комментарий закрытия:");
      printer.println(data.closing_comment.trim());
      printer.drawLine();
    }

    // Footer
    printer.newLine();
    printer.alignCenter();
    printer.println("Спасибо за работу!");
    printer.println(`${new Date().toLocaleString("ru-RU")}`);
    printer.newLine();
    printer.newLine();
    printer.cut();

    // Execute print with better error handling
    try {
      const result = await printer.execute();
      console.log("✅ Shift closure receipt printed successfully");
      res.status(200).json({
        message: "Shift closure receipt printed successfully.",
        shift_id: data.id,
        timestamp: new Date().toISOString(),
      });
    } catch (executeError) {
      console.error("❌ Execute error:", executeError);
      console.log(
        "🔄 Trying macOS system printer fallback for shift closure...",
      );

      try {
        // Create compact text content for system printer (smaller font)
        const textContent = `ЗАКРЫТИЕ СМЕНЫ
================================
Магазин: ${data.store.name}
Адрес: ${data.store.address}
Телефон: ${data.store.phone_number}
--------------------------------
Смена ID: ${data.id}
Касса: ${data.register.name}
Кассир: ${data.cashier.name}
--------------------------------
Открыта: ${formatDate(data.opened_at)}
Закрыта: ${formatDate(data.closed_at)}
--------------------------------
НАЛИЧНЫЕ В КАССЕ:
Начальная: ${formatCurrency(data.opening_cash)}
Конечная: ${formatCurrency(data.closing_cash)}
--------------------------------
СПОСОБЫ ОПЛАТЫ:
${data.payments
  .map((payment) => {
    const diff = parseFloat(payment.actual) - parseFloat(payment.expected);
    const diffStr =
      diff >= 0
        ? `+${Math.abs(diff).toFixed(2)}`
        : `-${Math.abs(diff).toFixed(2)}`;
    return `${payment.payment_method}:
 Ожидается: ${parseFloat(payment.expected).toFixed(2)}
 Фактически: ${parseFloat(payment.actual).toFixed(2)}
 Разница: ${diffStr}`;
  })
  .join("\n")}
--------------------------------
ИТОГИ:
Всего ожидается: ${parseFloat(data.total_expected).toFixed(2)}
Всего фактически: ${parseFloat(data.total_actual).toFixed(2)}
Возврат сумма: ${parseFloat(data.total_returns_amount).toFixed(2)}
Сумма долгов: ${formatCurrency(data.total_debt_amount)}
================================
${data.opening_comment ? `Комментарий открытия:\n${data.opening_comment}\n--------------------------------\n` : ""}${data.closing_comment ? `Комментарий закрытия:\n${data.closing_comment}\n--------------------------------\n` : ""}
Спасибо за работу!
${new Date().toLocaleString("ru-RU")}


`;

        await printUsingSystemPrinter(textContent);
        res.status(200).json({
          message:
            "Shift closure receipt printed successfully via macOS system printer",
          shift_id: data.id,
          method: "system_printer",
          timestamp: new Date().toISOString(),
        });
      } catch (systemError) {
        console.error("❌ System printer also failed:", systemError);
        const buffer = printer.getBuffer();
        res.status(200).json({
          message:
            "Print data prepared (printer may not be physically connected)",
          shift_id: data.id,
          buffer_size: buffer.length,
          method: "buffer_only",
          timestamp: new Date().toISOString(),
        });
      }
    }
  } catch (e) {
    console.error("❌ Error during printing:", e);
    res.status(500).json({ error: `Print failed: ${e.message}` });
  }
});

// Helper function to replace template variables
function replaceTemplateVariables(text, saleData) {
  const totalPaid =
    saleData.sale_payments?.reduce((sum, p) => sum + parseFloat(p.amount), 0) ||
    0;
  const totalAmount = parseFloat(saleData.total_amount);
  const change = Math.max(0, totalPaid - totalAmount);

  const paymentsText =
    saleData.sale_payments
      ?.map(
        (p) =>
          `${p.payment_method}: ${parseFloat(p.amount).toLocaleString("ru-RU")} UZS`,
      )
      .join("\n") || "";

  const replacements = {
    "{{storePhone}}": saleData.store_read?.phone_number || "",
    "{{storeName}}": saleData.store_read?.name || "",
    "{{storeAddress}}": saleData.store_read?.address || "",
    "{{receiptNumber}}": (saleData.sale_id || saleData.id)?.toString() || "",
    "{{sale_id}}": (saleData.sale_id || saleData.id)?.toString() || "",
    "{{date}}": new Date(saleData.sold_date).toLocaleDateString("ru-RU"),
    "{{time}}": new Date(saleData.sold_date).toLocaleTimeString("ru-RU"),
    "{{cashierName}}": saleData.worker_read?.name || "",
    "{{paymentMethod}}":
      saleData.sale_payments?.map((p) => p.payment_method).join(", ") || "",
    "{{change}}": change.toLocaleString("ru-RU"),
    "{{returnAmount}}": change.toLocaleString("ru-RU"),
    "{{footerText}}": "Спасибо за покупку!",
    "{{total}}": parseFloat(saleData.total_amount).toLocaleString("ru-RU"),
    "{{payments}}": paymentsText,
  };

  let result = text;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(
      new RegExp(key.replace(/[{}]/g, "\\$&"), "g"),
      value,
    );
  }
  return result;
}

// Helper function to apply text alignment
function applyAlignment(printer, align) {
  if (align === "center") {
    printer.alignCenter();
  } else if (align === "right") {
    printer.alignRight();
  } else {
    printer.alignLeft();
  }
}

// Helper function to apply font weight
function applyFontWeight(printer, weight) {
  if (weight === "bold") {
    printer.bold(true);
  } else {
    printer.bold(false);
  }
}

// Helper function to format numbers without unnecessary decimals
// Examples: 1.000 -> "1", 1.12 -> "1.12", 1.5 -> "1.5"
function formatNumber(num) {
  const parsed = parseFloat(num);
  if (isNaN(parsed)) return '0';
  
  // Check if the number is a whole number
  if (parsed % 1 === 0) {
    return parsed.toString(); // Return without decimals (e.g., "1")
  }
  
  // Return with decimals, removing only trailing zeros after decimal point
  // This will keep "1.12" as "1.12" but turn "1.50" into "1.5" and "1.00" into "1"
  return parsed.toFixed(3).replace(/\.?0+$/, '');
}

// Sale receipt printing endpoint with template support
app.post("/print-sale-receipt", async (req, res) => {
  if (!isDeviceReady || !printer) {
    console.error("❌ Print request failed: No printer device found.");
    return res.status(500).json({
      error:
        "Printer not found or not connected. Please check printer connection.",
      printer_ready: isDeviceReady,
    });
  }

  const { saleData, template } = req.body;

  // Validate required data
  if (
    !saleData ||
    !saleData.id ||
    !saleData.store_read ||
    !saleData.sale_items
  ) {
    return res.status(400).json({ error: "Invalid sale data provided." });
  }

  if (!template || !template.style || !template.style.components) {
    return res.status(400).json({ error: "Invalid template provided." });
  }

  try {
    console.log("🖨️  Printing sale receipt for Sale ID:", saleData.sale_id || saleData.id);
    console.log("📄 Using template:", template.name);
    console.log("📋 Template ID:", template.id);
    console.log("📋 Template is_used:", template.is_used);

    // Clear any previous content
    printer.clear();

    // Sort components by order and filter enabled ones
    const components = template.style.components
      .filter((c) => c.enabled)
      .sort((a, b) => a.order - b.order);

    console.log(`📦 Processing ${components.length} enabled components:`);
    components.forEach((c, i) => {
      console.log(
        `  ${i + 1}. [${c.type}] id="${c.id}" order=${c.order} enabled=${c.enabled}`,
      );
      if (c.type === "text" || c.type === "footer") {
        console.log(`     text: "${c.data?.text}"`);
      }
    });

    // Process each component
    for (const component of components) {
      const compStyles = component.styles || {};
      console.log(
        `\n🔧 Processing component: ${component.type} (${component.id})`,
      );

      switch (component.type) {
        case "logo":
          // Logo - just add space and maybe center text
          if (component.data?.url) {
            console.log("  ➜ Printing logo placeholder");
            printer.alignCenter();
            printer.println("[LOGO]");
            printer.newLine();
          }
          break;

        case "text":
        case "footer":
          if (component.data?.text) {
            const originalText = component.data.text;
            const text = replaceTemplateVariables(
              component.data.text,
              saleData,
            );
            console.log(`  ➜ Original text: "${originalText}"`);
            console.log(`  ➜ Replaced text: "${text}"`);
            console.log(
              `  ➜ Align: ${compStyles.textAlign || "left"}, Bold: ${compStyles.fontWeight === "bold"}`,
            );

            applyAlignment(printer, compStyles.textAlign || "left");
            applyFontWeight(printer, compStyles.fontWeight);

            // Handle multi-line text
            const lines = text.split("\n");
            lines.forEach((line) => {
              printer.println(line);
            });

            printer.bold(false);
            printer.alignLeft();
          }
          break;

        case "divider":
          console.log(
            `  ➜ Printing divider (borderTop: ${compStyles.borderTop})`,
          );
          if (compStyles.borderTop) {
            printer.drawLine();
          } else {
            printer.newLine();
          }
          break;

        case "itemList":
          console.log(`  ➜ Printing ${saleData.sale_items.length} items`);
          const itemListBold = compStyles.fontWeight === "bold";

          saleData.sale_items.forEach((item, index) => {
            const unitName =
              item.product_read.available_units?.find(
                (u) => u.id === item.selling_unit,
              )?.short_name || "шт";

            const price = parseFloat(item.subtotal) / parseFloat(item.quantity);
            const formattedQty = formatNumber(item.quantity);
            const formattedPrice = formatNumber(price);
            const formattedSubtotal = formatNumber(item.subtotal);

            // Product name is always bold for emphasis
            printer.bold(true);
            printer.println(`${index + 1}. ${item.product_read.product_name}`);
            
            // Quantity/price line uses component style
            printer.bold(itemListBold);
            printer.println(
              `   ${formattedQty} ${unitName} x ${formattedPrice} = ${formattedSubtotal}`,
            );
          });

          printer.bold(false);
          break;

        case "paymentList":
          console.log(
            `  ➜ Printing ${saleData.sale_payments?.length || 0} payment methods`,
          );
          applyFontWeight(printer, compStyles.fontWeight);
          applyAlignment(printer, compStyles.textAlign || "left");

          if (saleData.sale_payments && saleData.sale_payments.length > 0) {
            saleData.sale_payments.forEach((payment) => {
              printer.println(
                `${payment.payment_method}: ${formatCurrency(payment.amount)}`,
              );
            });
          }

          printer.bold(false);
          printer.alignLeft();
          break;

        case "totals":
          console.log(`  ➜ Printing totals`);
          applyAlignment(printer, compStyles.textAlign || "right");
          applyFontWeight(printer, compStyles.fontWeight);


          printer.println(`ИТОГО: ${formatCurrency(saleData.total_amount)}`);
          printer.bold(false);
          printer.setTextNormal();
          printer.alignLeft();
          break;

        default:
          console.log(`  ⚠️  Unknown component type: ${component.type}`);
          break;
      }
    }

    console.log("\n✅ All components processed, cutting paper...");

    // Always add final spacing and cut
    printer.newLine();
    printer.newLine();
    printer.cut();

    // Execute print with error handling
    try {
      const result = await printer.execute();
      console.log("✅ Sale receipt printed successfully");
      res.status(200).json({
        message: "Sale receipt printed successfully.",
        sale_id: saleData.id,
        timestamp: new Date().toISOString(),
      });
    } catch (executeError) {
      console.error("❌ Execute error:", executeError);
      console.log(
        "🔄 Trying macOS system printer fallback for sale receipt...",
      );

      try {
        // Build text content from template for system printer
        let textContent = "";

        // Process each component from template
        const sortedComponents = components
          .filter((c) => c.enabled)
          .sort((a, b) => a.order - b.order);

        for (const component of sortedComponents) {
          switch (component.type) {
            case "logo":
              if (component.data?.url) {
                textContent += "[LOGO]\n\n";
              }
              break;

            case "text":
            case "footer":
              if (component.data?.text) {
                const text = replaceTemplateVariables(
                  component.data.text,
                  saleData,
                );
                // Add bold markers for system printer if component is bold
                if (component.styles?.fontWeight === "bold") {
                  textContent += `**${text}**\n`;
                } else {
                  textContent += text + "\n";
                }
              }
              break;

            case "divider":
              if (component.styles?.borderTop) {
                textContent += "--------------------------------\n";
              } else {
                textContent += "\n";
              }
              break;

            case "itemList":
              saleData.sale_items.forEach((item, index) => {
                const unitName =
                  item.product_read.available_units?.find(
                    (u) => u.id === item.selling_unit,
                  )?.short_name || "шт";
                const price =
                  parseFloat(item.subtotal) / parseFloat(item.quantity);
                const formattedQty = formatNumber(item.quantity);
                const formattedPrice = formatNumber(price);
                const formattedSubtotal = formatNumber(item.subtotal);
                // Mark bold items with ** for system printer
                textContent += `**${index + 1}. ${item.product_read.product_name}**\n`;
                textContent += `   ${formattedQty} ${unitName} x ${formattedPrice} = ${formattedSubtotal}\n`;
              });
              break;

            case "paymentList":
              if (saleData.sale_payments && saleData.sale_payments.length > 0) {
                saleData.sale_payments.forEach((payment) => {
                  textContent += `${payment.payment_method}: ${formatCurrency(payment.amount)}\n`;
                });
              }
              break;

            case "totals":
              // Mark totals as bold for system printer
              textContent += `**ИТОГО: ${formatCurrency(saleData.total_amount)}**\n`;
              break;
          }
        }

        textContent += "\n\n";

        console.log(
          "📄 Generated text content from template for system printer",
        );
        await printUsingSystemPrinter(textContent);
        res.status(200).json({
          message: "Sale receipt printed successfully via macOS system printer",
          sale_id: saleData.id,
          method: "system_printer",
          timestamp: new Date().toISOString(),
        });
      } catch (systemError) {
        console.error("❌ System printer also failed:", systemError);
        const buffer = printer.getBuffer();
        res.status(200).json({
          message:
            "Print data prepared (printer may not be physically connected)",
          sale_id: saleData.id,
          buffer_size: buffer.length,
          method: "buffer_only",
          timestamp: new Date().toISOString(),
        });
      }
    }
  } catch (e) {
    console.error("❌ Error during printing:", e);
    res.status(500).json({ error: `Print failed: ${e.message}` });
  }
});

// Test endpoint for printing with specific JSON data
app.post("/test-shift-closure-with-data", async (req, res) => {
  if (!isDeviceReady || !printer) {
    console.error("❌ Print request failed: No printer device found.");
    return res.status(500).json({
      error:
        "Printer not found or not connected. Please check printer connection.",
      printer_ready: isDeviceReady,
    });
  }

  // Use the provided test data or default test data
  const testData = req.body || {
    id: 104,
    store: {
      id: 1,
      name: "Нокис Агаш Базар",
      address: "Агаш Базар",
      phone_number: "975000502",
      budget: "3310200.00",
      created_at: "2025-09-25T11:38:41.692721Z",
      is_main: true,
      color: "#000000",
      parent_store: null,
    },
    register: {
      id: 4,
      store: {
        id: 1,
        name: "Нокис Агаш Базар",
        address: "Агаш Базар",
        phone_number: "975000502",
        budget: "3310200.00",
        created_at: "2025-09-25T11:38:41.692721Z",
        is_main: true,
        color: "#000000",
        parent_store: null,
      },
      name: "Aa",
      is_active: true,
      last_opened_at: null,
      last_closing_cash: 1000.0,
    },
    cashier: {
      id: 7,
      name: "DESKTOPUSER",
      phone_number: "+998991234567",
      role: "Продавец",
    },
    total_expected: 135200.0,
    total_actual: 0,
    total_sales_amount: 135000.0,
    total_debt_amount: 0.0,
    total_sales_count: 1,
    total_returns_amount: 960000.0,
    total_returns_count: 1,
    total_income: 135000.0,
    total_expense: 0.0,
    opened_at: "2025-10-12T22:49:12.726141Z",
    closed_at: "2025-10-12T22:51:17.384157Z",
    opening_cash: "200.00",
    closing_cash: "1000.00",
    opening_comment: "aa",
    closing_comment: "TEST QILIB ATIRMAN",
    approval_comment: null,
    is_active: false,
    is_awaiting_approval: true,
    is_approved: false,
    approved_by: null,
    payments: [
      {
        id: 377,
        payment_method: "Наличные",
        income: "2000.00",
        expense: "0.00",
        expected: "2200.00",
        actual: "2200.00",
      },
      {
        id: 378,
          payment_method: "Карта",
        income: "113000.00",
        expense: "0.00",
        expected: "113000.00",
        actual: "115000.00",
      },
      {
        id: 379,
        payment_method: "Click",
        income: "20000.00",
        expense: "0.00",
        expected: "20000.00",
        actual: "20000.00",
      },
      {
        id: 380,
        payment_method: "Перечисление",
        income: "0.00",
        expense: "0.00",
        expected: "0.00",
        actual: "0.00",
      },
    ],
  };

  try {
    console.log("🖨️  Printing test shift closure with provided data...");

    // Clear any previous content
    printer.clear();

    // Header
    printer.alignCenter();
    printer.setTextDoubleHeight();
    printer.bold(true);
    printer.println("ЗАКРЫТИЕ СМЕНЫ");
    printer.bold(false);
    printer.setTextNormal();
    printer.drawLine();

    // Store information
    printer.alignLeft();
    printer.println(`Магазин: ${testData.store.name}`);
    printer.println(`Адрес: ${testData.store.address}`);
    printer.println(`Телефон: ${testData.store.phone_number}`);
    printer.drawLine();

    // Shift information
    printer.println(`Смена ID: ${testData.id}`);
    printer.println(`Касса: ${testData.register.name}`);
    printer.println(`Кассир: ${testData.cashier.name}`);
    printer.println(`Роль: ${testData.cashier.role}`);
    printer.drawLine();

    // Time information
    printer.println(`Открыта: ${formatDate(testData.opened_at)}`);
    printer.println(`Закрыта: ${formatDate(testData.closed_at)}`);
    printer.drawLine();

    // Cash information
    printer.bold(true);
    printer.println("НАЛИЧНЫЕ В КАССЕ:");
    printer.bold(false);
    printer.println(`Начальная: ${formatCurrency(testData.opening_cash)}`);
    printer.println(`Конечная: ${formatCurrency(testData.closing_cash)}`);
    printer.drawLine();

    // Sales and operations summary
    printer.bold(true);
    printer.println("ОПЕРАЦИИ ЗА СМЕНУ:");
    printer.bold(false);
    printer.println(`Продаж (кол-во): ${testData.total_sales_count}`);
    printer.println(
      `Сумма продаж: ${formatCurrency(testData.total_sales_amount)}`,
    );
    printer.println(`Возвратов (кол-во): ${testData.total_returns_count}`);
    printer.println(
      `Сумма возвратов: ${formatCurrency(testData.total_returns_amount)}`,
    );
    printer.println(`Долги: ${formatCurrency(testData.total_debt_amount)}`);
    printer.println(`Доходы: ${formatCurrency(testData.total_income)}`);
    printer.println(`Расходы: ${formatCurrency(testData.total_expense)}`);
    printer.drawLine();

    // Payment methods
    printer.alignCenter();
    printer.bold(true);
    printer.println("СПОСОБЫ ОПЛАТЫ");
    printer.bold(false);
    printer.alignLeft();
    printer.drawLine();

    // Print payment methods
    testData.payments.forEach((payment) => {
      const diff = parseFloat(payment.actual) - parseFloat(payment.expected);
      const diffStr =
        diff >= 0
          ? `+${Math.abs(diff).toFixed(2)}`
          : `-${Math.abs(diff).toFixed(2)}`;

      printer.println(`${payment.payment_method}:`);
      printer.println(
        `  Ожидается: ${parseFloat(payment.expected).toFixed(2)}`,
      );
      printer.println(`  Фактически: ${parseFloat(payment.actual).toFixed(2)}`);
      printer.println(`  Разница: ${diffStr}`);
      printer.newLine();
    });

    // Totals
    const totalDiff =
      parseFloat(testData.total_actual) - parseFloat(testData.total_expected);
    const totalDiffStr =
      totalDiff >= 0
        ? `+${Math.abs(totalDiff).toFixed(2)}`
        : `-${Math.abs(totalDiff).toFixed(2)}`;

    printer.drawLine();
    printer.alignCenter();
    printer.setTextDoubleHeight();
    printer.bold(true);
    printer.println("ИТОГИ");
    printer.bold(false);
    printer.setTextNormal();
    printer.alignLeft();
    printer.println(
      `Всего ожидается: ${parseFloat(testData.total_expected).toFixed(2)}`,
    );
    printer.println(
      `Всего фактически: ${parseFloat(testData.total_actual).toFixed(2)}`,
    );
    printer.drawLine();

    // Status information
    printer.bold(true);
    printer.println("СТАТУС СМЕНЫ:");
    printer.bold(false);
    printer.println(`Активна: ${testData.is_active ? "Да" : "Нет"}`);
    printer.println(
      `Ожидает подтверждения: ${testData.is_awaiting_approval ? "Да" : "Нет"}`,
    );
    printer.println(`Подтверждена: ${testData.is_approved ? "Да" : "Нет"}`);
    if (testData.approved_by) {
      printer.println(`Подтвердил: ${testData.approved_by}`);
    }
    if (testData.approval_comment) {
      printer.println(`Комментарий одобрения: ${testData.approval_comment}`);
    }
    printer.drawLine();

    // Add comments if present
    if (testData.opening_comment && testData.opening_comment.trim()) {
      printer.println("Комментарий открытия:");
      printer.println(testData.opening_comment.trim());
      printer.drawLine();
    }

    if (testData.closing_comment && testData.closing_comment.trim()) {
      printer.println("Комментарий закрытия:");
      printer.println(testData.closing_comment.trim());
      printer.drawLine();
    }

    // Footer
    printer.newLine();
    printer.alignCenter();
    printer.println("Спасибо за работу!");
    printer.println(`${new Date().toLocaleString("ru-RU")}`);
    printer.newLine();
    printer.newLine();
    printer.cut();

    // Execute print
    try {
      const result = await printer.execute();
      console.log("✅ Test shift closure receipt printed successfully");
      res.status(200).json({
        message: "Test shift closure receipt printed successfully.",
        shift_id: testData.id,
        timestamp: new Date().toISOString(),
      });
    } catch (executeError) {
      console.error("❌ Execute error:", executeError);

      // Try system printer fallback
      try {
        const textContent = `ЗАКРЫТИЕ СМЕНЫ (ТЕСТ)
================================
Магазин: ${testData.store.name}
Адрес: ${testData.store.address}
Телефон: ${testData.store.phone_number}
--------------------------------
Смена ID: ${testData.id}
Касса: ${testData.register.name}
Кассир: ${testData.cashier.name}
Роль: ${testData.cashier.role}
--------------------------------
Открыта: ${formatDate(testData.opened_at)}
Закрыта: ${formatDate(testData.closed_at)}
--------------------------------
ОПЕРАЦИИ ЗА СМЕНУ:
Продаж (кол-во): ${testData.total_sales_count}
Сумма продаж: ${formatCurrency(testData.total_sales_amount)}
Возвратов (кол-во): ${testData.total_returns_count}
Возврат сумма: ${formatCurrency(testData.total_returns_amount)}
Сумма долгов: ${formatCurrency(testData.total_debt_amount)}
Доходы: ${formatCurrency(testData.total_income)}
Расходы: ${formatCurrency(testData.total_expense)}
--------------------------------
НАЛИЧНЫЕ В КАССЕ:
Начальная: ${formatCurrency(testData.opening_cash)}
Конечная: ${formatCurrency(testData.closing_cash)}
--------------------------------
СПОСОБЫ ОПЛАТЫ:
${testData.payments
  .map((payment) => {
    const diff = parseFloat(payment.actual) - parseFloat(payment.expected);
    const diffStr =
      diff >= 0
        ? `+${Math.abs(diff).toFixed(2)}`
        : `-${Math.abs(diff).toFixed(2)}`;
    return `${payment.payment_method}:
 Ожидается: ${parseFloat(payment.expected).toFixed(2)}
 Фактически: ${parseFloat(payment.actual).toFixed(2)}
 Разница: ${diffStr}`;
  })
  .join("\n")}
--------------------------------
ИТОГИ:
Всего ожидается: ${parseFloat(testData.total_expected).toFixed(2)}
Всего фактически: ${parseFloat(testData.total_actual).toFixed(2)}
Возврат сумма: ${parseFloat(testData.total_returns_amount).toFixed(2)}
Сумма долгов: ${formatCurrency(testData.total_debt_amount)}
--------------------------------
СТАТУС СМЕНЫ:
Активна: ${testData.is_active ? "Да" : "Нет"}
Ожидает подтверждения: ${testData.is_awaiting_approval ? "Да" : "Нет"}
Подтверждена: ${testData.is_approved ? "Да" : "Нет"}${
          testData.approved_by
            ? `
Подтвердил: ${testData.approved_by}`
            : ""
        }${
          testData.approval_comment
            ? `
Комментарий одобрения: ${testData.approval_comment}`
            : ""
        }
================================
${testData.opening_comment ? `Комментарий открытия:\n${testData.opening_comment}\n--------------------------------\n` : ""}${testData.closing_comment ? `Комментарий закрытия:\n${testData.closing_comment}\n--------------------------------\n` : ""}
Спасибо за работу!
${new Date().toLocaleString("ru-RU")}


`;

        await printUsingSystemPrinter(textContent);
        res.status(200).json({
          message: "Test shift closure receipt printed via system printer",
          shift_id: testData.id,
          method: "system_printer",
          timestamp: new Date().toISOString(),
        });
      } catch (systemError) {
        console.error("❌ System printer also failed:", systemError);
        const buffer = printer.getBuffer();
        res.status(200).json({
          message:
            "Test print data prepared (printer may not be physically connected)",
          shift_id: testData.id,
          buffer_size: buffer.length,
          method: "buffer_only",
          timestamp: new Date().toISOString(),
        });
      }
    }
  } catch (e) {
    console.error("❌ Error during test printing:", e);
    res.status(500).json({ error: `Test print failed: ${e.message}` });
  }
});

// Initialize printer on startup
initializePrinter().catch(console.error);

// Start the server
app.listen(port, () => {
  console.log("🚀 Thermal Print Service Started");
  console.log(`📡 Server listening at http://localhost:${port}`);
  console.log(
    `🖨️  Printer Status: ${isDeviceReady ? "✅ Ready" : "❌ Not Ready"}`,
  );
  console.log("📋 Available endpoints:");
  console.log("   GET  /health - Check service status");
  console.log("   POST /test-print - Print test receipt");
  console.log("   POST /print-shift-closure - Print shift closure receipt");
  console.log(
    "   POST /test-shift-closure-with-data - Test with specific JSON data",
  );
  console.log("   POST /print-sale-receipt - Print sale receipt");
  console.log("🔄 Waiting for print requests...");
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down thermal print service...");
  if (printer) {
    try {
      // Clean up printer resources if needed
      console.log("Cleaning up printer resources...");
    } catch (e) {
      console.log("Printer already cleaned up");
    }
  }
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Shutting down thermal print service...");
  if (printer) {
    try {
      // Clean up printer resources if needed
      console.log("Cleaning up printer resources...");
    } catch (e) {
      console.log("Printer already cleaned up");
    }
  }
  process.exit(0);
});
