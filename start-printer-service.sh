#!/bin/bash

echo "========================================"
echo "   Thermal Print Service Launcher"
echo "========================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ ERROR: Node.js is not installed or not in PATH"
    echo "Please install Node.js from https://nodejs.org"
    exit 1
fi

echo "✅ Node.js version:"
node --version
echo ""

# Check if we're in the right directory
if [ ! -f "server.js" ]; then
    echo "❌ ERROR: server.js not found in current directory"
    echo "Please run this script from the thermal-printer-service directory"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ ERROR: Failed to install dependencies"
        exit 1
    fi
    echo ""
fi

echo "🚀 Starting Thermal Print Service..."
echo "📡 Service will be available at: http://localhost:3001"
echo ""
echo "📋 Available endpoints:"
echo "   GET  /health - Check service status"
echo "   POST /test-print - Print test receipt"
echo "   POST /print-shift-closure - Print shift closure receipt"
echo ""
echo "💡 Press Ctrl+C to stop the service"
echo "========================================"
echo ""

# Start the service
node server.js

echo ""
echo "🛑 Service stopped."
