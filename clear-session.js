#!/usr/bin/env node

/**
 * Script to clear WhatsApp session data
 * Run this if you're having persistent QR code issues
 */

const fs = require('fs');
const path = require('path');

const sessionDir = path.join(__dirname, 'data', 'whatsapp-session');

console.log('🧹 WhatsApp Session Cleaner');
console.log('==========================');

if (fs.existsSync(sessionDir)) {
    try {
        console.log('📁 Found session directory:', sessionDir);
        
        // List session files
        const sessionFiles = [
            'Default/Local Storage',
            'Default/IndexedDB',
            'Default/Cookies',
            'Default/Login Data',
            'Default/Session Storage',
            'Default/Cache'
        ];
        
        console.log('\n📋 Session files found:');
        sessionFiles.forEach(file => {
            const filePath = path.join(sessionDir, file);
            if (fs.existsSync(filePath)) {
                console.log('  ✅', file);
            } else {
                console.log('  ❌', file);
            }
        });
        
        console.log('\n⚠️  To clear session data, delete the following directory:');
        console.log('   ', sessionDir);
        console.log('\n💡 This will force WhatsApp to request a new QR code scan.');
        console.log('   Make sure to backup any important data first!');
        
    } catch (error) {
        console.error('❌ Error reading session directory:', error.message);
    }
} else {
    console.log('📁 No session directory found at:', sessionDir);
    console.log('💡 This means WhatsApp has never been connected or session was already cleared.');
}

console.log('\n🔧 Manual cleanup commands:');
console.log('   rm -rf "' + sessionDir + '"');
console.log('   # or on Windows:');
console.log('   rmdir /s /q "' + sessionDir + '"');
