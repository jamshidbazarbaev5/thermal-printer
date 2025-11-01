#!/bin/bash

# Package thermal printer service for distribution to users

echo "📦 Creating thermal printer service package for users..."

# Create distribution directory
mkdir -p dist/thermal-printer-service

# Copy necessary files
cp package.json dist/thermal-printer-service/
cp server.js dist/thermal-printer-service/
cp *.js dist/thermal-printer-service/
cp *.md dist/thermal-printer-service/
cp *.sh dist/thermal-printer-service/
cp *.bat dist/thermal-printer-service/
cp *.html dist/thermal-printer-service/

# Create simple installer script
cat > dist/thermal-printer-service/install.sh << 'EOF'
#!/bin/bash
echo "🖨️ Installing H-58C Thermal Printer Service..."
echo "📋 Installing Node.js dependencies..."
npm install

echo "✅ Installation complete!"
echo ""
echo "🚀 To start the service:"
echo "   npm start"
echo ""
echo "🔧 To install as system service:"
echo "   npm run install-macos-service  (macOS)"
echo "   npm run install-service        (Windows)"
echo ""
echo "📡 Service will run on: http://localhost:3001"
echo "🖨️ Make sure your H-58C printer is connected via USB"
EOF

chmod +x dist/thermal-printer-service/install.sh

# Create Windows installer
cat > dist/thermal-printer-service/install.bat << 'EOF'
@echo off
echo Installing H-58C Thermal Printer Service...
echo Installing Node.js dependencies...
npm install

echo.
echo Installation complete!
echo.
echo To start the service:
echo   npm start
echo.
echo To install as Windows service:
echo   npm run install-service
echo.
echo Service will run on: http://localhost:3001
echo Make sure your H-58C printer is connected via USB
pause
EOF

echo "✅ Package created in dist/thermal-printer-service/"
echo "📋 Users can now:"
echo "   1. Download the dist/thermal-printer-service folder"
echo "   2. Run install.sh (macOS/Linux) or install.bat (Windows)"
echo "   3. Start with: npm start"
