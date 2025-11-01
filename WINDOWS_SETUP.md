# H-58C Thermal Printer Setup for Windows

## 📋 Prerequisites

1. **Windows 10/11** (any edition)
2. **Node.js** - Download from [nodejs.org](https://nodejs.org) (choose LTS version)
3. **H-58C Thermal Printer** connected via USB
4. **Administrator privileges** (for service installation)

## 🚀 Quick Setup (5 minutes)

### Step 1: Install Node.js
1. Download Node.js from [nodejs.org](https://nodejs.org)
2. Run the installer (choose all default options)
3. Restart your computer after installation

### Step 2: Download Thermal Service
1. Download the `thermal-printer-service` folder
2. Extract to a permanent location (e.g., `C:\thermal-printer-service`)

### Step 3: Connect H-58C Printer
1. Connect H-58C printer to USB port
2. Power on the printer
3. Windows should automatically detect it
4. Load thermal paper (58mm width)

### Step 4: Install Service
1. **Right-click** on Command Prompt → **Run as Administrator**
2. Navigate to the service folder:
   ```cmd
   cd C:\thermal-printer-service
   ```
3. Install dependencies:
   ```cmd
   npm install
   ```
4. Test the service:
   ```cmd
   npm start
   ```
   - You should see: `✅ H-58C thermal printer initialized`
   - Press `Ctrl+C` to stop

### Step 5: Install as Windows Service (Recommended)
```cmd
npm run install-service
```

**✅ Done!** The service will now start automatically when Windows boots.

## 🔧 Service Management

### Check Service Status
1. Press `Win+R`, type `services.msc`, press Enter
2. Look for **"H58C-Thermal-Print-Service"**
3. Status should be **"Running"**

### Manual Service Control
```cmd
# Start service
net start H58C-Thermal-Print-Service

# Stop service  
net stop H58C-Thermal-Print-Service

# Restart service
net stop H58C-Thermal-Print-Service && net start H58C-Thermal-Print-Service
```

### Uninstall Service
```cmd
npm run uninstall-service
```

## 🧪 Testing

### Test Service Health
1. Open browser
2. Go to: http://localhost:3001/health
3. Should show: `"printer_ready": true`

### Test Print
1. Open browser  
2. Go to: http://localhost:3001/test-print (POST request)
3. Or use the test interface: http://localhost:3001/test-web-serial.html

## 🌐 Web Application Integration

Once the service is running:
1. Open your web application (deployed on Vercel)
2. Navigate to shift closure
3. Close a shift
4. **Receipt will automatically print on your H-58C printer!** 🎉

## 🛠️ Troubleshooting

### Printer Not Detected
- Check USB cable connection
- Try different USB port
- Restart the printer
- Check Windows Device Manager for printer

### Service Won't Start
- Run Command Prompt as Administrator
- Check if port 3001 is available
- Restart Windows
- Reinstall Node.js

### Permission Errors
- Always run Command Prompt as Administrator
- Check Windows Defender/Antivirus settings
- Add thermal-printer-service folder to antivirus exclusions

### Port 3001 Already in Use
1. Find what's using the port:
   ```cmd
   netstat -ano | findstr :3001
   ```
2. Kill the process or change port in `server.js`

## 📞 Support

If you encounter issues:
1. Check the service logs in Windows Event Viewer
2. Ensure H-58C printer is properly connected
3. Verify Node.js installation: `node --version`
4. Test with: `npm start` (manual mode)

## 🔄 Updates

To update the service:
1. Stop the service: `net stop H58C-Thermal-Print-Service`
2. Replace files in the service folder
3. Start the service: `net start H58C-Thermal-Print-Service`
