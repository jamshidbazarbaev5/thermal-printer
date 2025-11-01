# H-58C Thermal Printer Setup for Users

## Quick Setup Guide

### Prerequisites
- H-58C Thermal Printer connected via USB
- Node.js installed ([Download here](https://nodejs.org))

### Installation Steps

1. **Download the thermal printer service:**
   ```bash
   # Download and extract the thermal-printer-service folder
   cd thermal-printer-service
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Connect your H-58C printer:**
   - Connect via USB
   - Power on the printer
   - Ensure paper is loaded

4. **Start the service:**
   ```bash
   npm start
   ```
   
   You should see: `✅ H-58C thermal printer initialized`

5. **Test printing:**
   - Open: http://localhost:3001/health
   - Should show: `"printer_ready": true`

### Auto-Start Setup (Optional)

**For macOS:**
```bash
npm run install-macos-service
```

**For Windows:**
```bash
npm run install-service
```

### Troubleshooting

- **Printer not detected:** Check USB connection and drivers
- **Port 3001 in use:** Change port in server.js
- **Permission issues:** Run with administrator privileges

### Usage

Once running, the web application will automatically print shift closure receipts to your H-58C thermal printer when you close shifts.

**Service Status:** http://localhost:3001/health
**Test Print:** http://localhost:3001/test-print (POST request)
