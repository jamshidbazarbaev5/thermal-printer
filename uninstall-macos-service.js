const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const launchAgentsDir = path.join(process.env.HOME, 'Library', 'LaunchAgents');
const plistPath = path.join(launchAgentsDir, 'com.thermalprinter.service.plist');

console.log('🛑 Uninstalling Thermal Print Service from macOS...');
console.log('📋 Service Details:');
console.log(`   Label: com.thermalprinter.service`);
console.log(`   Plist Location: ${plistPath}`);
console.log('');

try {
    // Stop the service
    try {
        execSync('launchctl stop com.thermalprinter.service', { stdio: 'inherit' });
        console.log('🛑 Service stopped');
    } catch (error) {
        console.log('⚠️  Service was not running');
    }

    // Unload the service
    try {
        execSync(`launchctl unload ${plistPath}`, { stdio: 'inherit' });
        console.log('📤 Service unloaded');
    } catch (error) {
        console.log('⚠️  Service was not loaded');
    }

    // Remove the plist file
    if (fs.existsSync(plistPath)) {
        fs.unlinkSync(plistPath);
        console.log('🗑️  Plist file removed');
    } else {
        console.log('⚠️  Plist file not found');
    }

    console.log('');
    console.log('✅ Thermal Print Service uninstalled successfully!');
    console.log('🔧 Service has been removed from macOS LaunchAgents');

} catch (error) {
    console.error('❌ Uninstallation failed:', error.message);
    console.log('');
    console.log('💡 Manual cleanup:');
    console.log(`   1. Stop service: launchctl stop com.thermalprinter.service`);
    console.log(`   2. Unload service: launchctl unload ${plistPath}`);
    console.log(`   3. Remove plist: rm ${plistPath}`);
    process.exit(1);
}
