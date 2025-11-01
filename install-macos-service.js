const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// macOS LaunchAgent plist content
const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.thermalprinter.service</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>${path.join(__dirname, 'server.js')}</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${__dirname}</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${path.join(__dirname, 'thermal-printer-service.log')}</string>
    <key>StandardErrorPath</key>
    <string>${path.join(__dirname, 'thermal-printer-service-error.log')}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
        <key>PORT</key>
        <string>3001</string>
    </dict>
</dict>
</plist>`;

const launchAgentsDir = path.join(process.env.HOME, 'Library', 'LaunchAgents');
const plistPath = path.join(launchAgentsDir, 'com.thermalprinter.service.plist');

console.log('🔧 Installing Thermal Print Service as macOS LaunchAgent...');
console.log('📋 Service Details:');
console.log(`   Label: com.thermalprinter.service`);
console.log(`   Script: ${path.join(__dirname, 'server.js')}`);
console.log(`   Working Directory: ${__dirname}`);
console.log(`   Port: 3001`);
console.log(`   Plist Location: ${plistPath}`);
console.log('');

try {
    // Ensure LaunchAgents directory exists
    if (!fs.existsSync(launchAgentsDir)) {
        fs.mkdirSync(launchAgentsDir, { recursive: true });
        console.log('📁 Created LaunchAgents directory');
    }

    // Write the plist file
    fs.writeFileSync(plistPath, plistContent);
    console.log('✅ Plist file created successfully');

    // Load the service
    execSync(`launchctl load ${plistPath}`, { stdio: 'inherit' });
    console.log('✅ Service loaded successfully');

    // Start the service
    execSync('launchctl start com.thermalprinter.service', { stdio: 'inherit' });
    console.log('✅ Service started successfully');

    console.log('');
    console.log('🎉 Thermal Print Service installed and started!');
    console.log('📡 Service is now running on http://localhost:3001');
    console.log('');
    console.log('🔧 Service Management Commands:');
    console.log('   Start:   launchctl start com.thermalprinter.service');
    console.log('   Stop:    launchctl stop com.thermalprinter.service');
    console.log('   Restart: launchctl kickstart -k gui/$(id -u)/com.thermalprinter.service');
    console.log('   Status:  launchctl list | grep thermalprinter');
    console.log('');
    console.log('📋 Log Files:');
    console.log(`   Output:  ${path.join(__dirname, 'thermal-printer-service.log')}`);
    console.log(`   Errors:  ${path.join(__dirname, 'thermal-printer-service-error.log')}`);

} catch (error) {
    console.error('❌ Installation failed:', error.message);
    console.log('');
    console.log('💡 Troubleshooting:');
    console.log('   - Make sure you have the correct permissions');
    console.log('   - Try running with sudo if needed');
    console.log('   - Check that Node.js is installed at /usr/local/bin/node');
    console.log('   - You can check Node.js location with: which node');
    process.exit(1);
}
