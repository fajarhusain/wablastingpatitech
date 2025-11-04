#!/usr/bin/env node

/**
 * Script to test WhatsApp session and clear if needed
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 WhatsApp Session Tester');
console.log('==========================');

// Check session directory
const sessionDir = path.join(__dirname, '.wwebjs_auth', 'session-whatsapp-labs-desktop');
const cacheDir = path.join(__dirname, '.wwebjs_cache');

console.log('\n📁 Session Directory:', sessionDir);
console.log('📁 Cache Directory:', cacheDir);

// Check if session exists
if (fs.existsSync(sessionDir)) {
    console.log('✅ Session directory exists');
    
    // Check critical files
    const criticalFiles = [
        'Default/Local Storage/leveldb',
        'Default/IndexedDB/https_web.whatsapp.com_0.indexeddb.leveldb',
        'Default/Cookies'
    ];
    
    console.log('\n🔍 Checking critical session files:');
    let allFilesExist = true;
    
    criticalFiles.forEach(file => {
        const filePath = path.join(sessionDir, file);
        if (fs.existsSync(filePath)) {
            console.log('  ✅', file);
        } else {
            console.log('  ❌', file);
            allFilesExist = false;
        }
    });
    
    if (allFilesExist) {
        console.log('\n🎉 Session appears to be valid!');
        console.log('💡 If you still need to scan QR code, the session might be expired.');
    } else {
        console.log('\n⚠️  Session files are incomplete or corrupted.');
        console.log('💡 You may need to clear the session and scan QR code again.');
    }
    
} else {
    console.log('❌ No session directory found');
    console.log('💡 You need to scan QR code to create a session.');
}

// Check cache
if (fs.existsSync(cacheDir)) {
    console.log('\n📁 Cache directory exists');
    const cacheFiles = fs.readdirSync(cacheDir);
    console.log('📄 Cache files:', cacheFiles.length);
} else {
    console.log('\n📁 No cache directory found');
}

console.log('\n🔧 Commands to clear session if needed:');
console.log('   rm -rf .wwebjs_auth');
console.log('   rm -rf .wwebjs_cache');
console.log('   # or on Windows:');
console.log('   rmdir /s /q .wwebjs_auth');
console.log('   rmdir /s /q .wwebjs_cache');
