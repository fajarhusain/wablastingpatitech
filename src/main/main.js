const { app, BrowserWindow, BrowserView, ipcMain, dialog, Menu, shell, Tray, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { WhatsAppClient } = require('./whatsapp-client');
const { DatabaseManager } = require('./database');
const { Logger } = require('./logger');
const { Scheduler } = require('./scheduler');
const { CSVParser } = require('./csv-parser');
const Store = require('electron-store');
const { autoUpdater } = require('electron-updater');

class WhatsAppLabsDesktop {
    constructor() {
        this.mainWindow = null;
        this.tray = null;
        this.whatsappClient = null;
        this.database = null;
        this.logger = null;
        this.scheduler = null;
        this.store = new Store();
        this.isQuitting = false;
        this.waBrowserView = null;

        
        this.initializeApp();
    }

    initializeApp() {
        // Initialize logger
        this.logger = new Logger();
        
        // Initialize database
        this.database = new DatabaseManager();
        
        // Initialize WhatsApp client
        this.whatsappClient = new WhatsAppClient(this.logger);
        
        // Initialize scheduler
        this.scheduler = new Scheduler(this.whatsappClient, this.database, this.logger);
        
        // Initialize CSV parser
        this.csvParser = new CSVParser();
        
        // Setup app event listeners
        this.setupAppEvents();
        
        // Setup IPC handlers
        this.setupIpcHandlers();
        
        // Setup menu
        this.createMenu();
    }

    setupAppEvents() {
        app.whenReady().then(() => {
            this.createMainWindow();

            this.createTray();
            this.setupAutoUpdater();
            
            // Check for existing session and auto-reconnect if available
            this.attemptAutoReconnect();
        });

        app.on('window-all-closed', () => {
            // Force quit on all platforms when all windows are closed
            this.logger.info('All windows closed, quitting application...');
            app.quit();
        });

        // Handle force quit
        app.on('will-quit', (event) => {
            if (!this.isQuitting) {
                event.preventDefault();
                this.isQuitting = true;
                app.quit();
            }
        });

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                this.createMainWindow();
            } else {
                // Focus existing window
                this.mainWindow.focus();
                this.mainWindow.show();
            }
        });

        app.on('before-quit', async (event) => {
            if (this.isQuitting) {
                return;
            }
            
            this.isQuitting = true;
            this.logger.info('Application is shutting down...');
            
            // Cleanup WhatsApp client
            if (this.whatsappClient) {
                try {
                    await this.whatsappClient.disconnect();
                    this.logger.info('WhatsApp client cleaned up');
                } catch (error) {
                    this.logger.error('Error cleaning up WhatsApp client:', error);
                }
            }
            
            // Cleanup scheduler
            if (this.scheduler) {
                try {
                    this.scheduler.stopScheduler();
                    this.logger.info('Scheduler stopped');
                } catch (error) {
                    this.logger.error('Error stopping scheduler:', error);
                }
            }
            
            // Cleanup database connections
            if (this.database) {
                try {
                    this.database.close();
                    this.logger.info('Database connections closed');
                } catch (error) {
                    this.logger.error('Error closing database:', error);
                }
            }
            
            // Cleanup tray
            if (this.tray) {
                try {
                    this.tray.destroy();
                    this.tray = null;
                    this.logger.info('Tray cleaned up');
                } catch (error) {
                    this.logger.error('Error cleaning up tray:', error);
                }
            }
            
            // Force quit immediately
            this.logger.info('Forcing application exit...');
            app.exit(0);
        });

        // Handle protocol for deep linking
        app.setAsDefaultProtocolClient('whatsapp-labs');
        
        // Handle process exit
        process.on('exit', (code) => {
            this.logger.info(`Application process exiting with code: ${code}`);
            process.exit(code);
        });
        
        process.on('SIGINT', () => {
            this.logger.info('SIGINT received, shutting down gracefully');
            this.isQuitting = true;
            app.quit();
            process.exit(0);
        });
        
        process.on('SIGTERM', () => {
            this.logger.info('SIGTERM received, shutting down gracefully');
            this.isQuitting = true;
            app.quit();
            process.exit(0);
        });

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            this.logger.error('Uncaught Exception:', error);
            app.quit();
            process.exit(1);
        });

        process.on('unhandledRejection', (reason, promise) => {
            this.logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
            app.quit();
            process.exit(1);
        });
    }

    createMainWindow() {
        this.mainWindow = new BrowserWindow({
            width: 1400,
            height: 900,
            minWidth: 1200,
            minHeight: 800,
            show: false,
            center: true,
            icon: path.join(__dirname, '../assets/icon.png'),
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                enableRemoteModule: false,
                preload: path.join(__dirname, 'preload.js')
            },
            titleBarStyle: 'default',
            title: 'WA Blast PATITECH Desktop',
            frame: true,
            resizable: true,
            movable: true,
            minimizable: true,
            maximizable: true,
            closable: true
        });

        // Load the renderer
        this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

        // Show window when ready
        this.mainWindow.once('ready-to-show', () => {
            this.mainWindow.show();
            this.mainWindow.focus();
            this.mainWindow.moveTop();
            
            // Focus on the window
            if (process.platform === 'darwin') {
                app.dock.show();
            }
        });

        // Handle window closed
        this.mainWindow.on('close', (event) => {
            if (!this.isQuitting) {
                event.preventDefault();
                this.mainWindow.hide();
                
                // Show notification
                if (this.tray) {
                    this.tray.displayBalloon({
                        title: 'WA Blast PATITECH',
                        content: 'Application minimized to tray'
                    });
                }
            } else {
                // If quitting, allow the window to close
                this.mainWindow = null;
            }
        });

        // Handle window closed - force quit on close
        this.mainWindow.on('closed', () => {
            this.mainWindow = null;
            // Force quit the application
            app.quit();
        });

        // Handle external links
        this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
            shell.openExternal(url);
            return { action: 'deny' };
        });

        // Focus window when activated
        this.mainWindow.on('focus', () => {
            this.mainWindow.focus();
        });

        // Focus window when shown
        this.mainWindow.on('show', () => {
            this.mainWindow.focus();
        });

        // Development tools
        if (process.argv.includes('--dev')) {
            this.mainWindow.webContents.openDevTools();
        }

        // Set main window reference in WhatsApp client
        this.whatsappClient.setMainWindow(this.mainWindow);
        
        // Setup WhatsApp event handlers
        this.setupWhatsAppEventHandlers();
    }

    createLiveWhatsAppView() {
    if (this.waBrowserView) return;

    this.waBrowserView = new BrowserView({
        webPreferences: {
            partition: 'persist:wa-session', // biar sesi login tersimpan
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    this.mainWindow.setBrowserView(this.waBrowserView);
    this.resizeLiveWhatsAppView();

    // Muat WhatsApp Web
    this.waBrowserView.webContents.loadURL('https://web.whatsapp.com');
    
    this.logger.info('Live WhatsApp View dimuat.');

    // Jika user resize window, otomatis sesuaikan
    this.mainWindow.on('resize', () => {
        this.resizeLiveWhatsAppView();
    });
}

resizeLiveWhatsAppView() {
    if (!this.mainWindow || !this.waBrowserView) return;
    const bounds = this.mainWindow.getBounds();

    // Sesuaikan dengan area konten utama
    this.waBrowserView.setBounds({
        x: 260,  // lebar sidebar
        y: 80,   // tinggi header
        width: bounds.width - 280,
        height: bounds.height - 100
    });
}

destroyLiveWhatsAppView() {
    try {
        if (this.waBrowserView) {
            this.logger.info('Menghapus Live WhatsApp View...');
            this.mainWindow.removeBrowserView(this.waBrowserView);

            if (this.waBrowserView.webContents && !this.waBrowserView.webContents.isDestroyed()) {
                this.waBrowserView.webContents.destroy();
            }

            this.waBrowserView = null;
            this.logger.info('Live WhatsApp View berhasil dihentikan.');
        }
    } catch (error) {
        this.logger.error('Gagal menghentikan Live WhatsApp View:', error);
    }
}



    setupWhatsAppEventHandlers() {
        // WhatsApp client events
        // Note: QR code handling is already done in whatsapp-client.js
        // No need to duplicate the event handler here

        this.whatsappClient.on('ready', () => {
            this.logger.info('WhatsApp client is ready');
            this.mainWindow.webContents.send('whatsapp-status-changed', { 
                isReady: true, 
                isConnecting: false 
            });
            
            // Save that user has ever connected
            this.store.set('whatsapp.hasEverConnected', true);
            
            // Show success notification
            this.mainWindow.webContents.send('whatsapp-login-success', {
                message: 'WhatsApp berhasil terhubung!',
                timestamp: new Date().toISOString()
            });
        });

        this.whatsappClient.on('authenticated', () => {
            this.logger.info('WhatsApp client authenticated');
            
            // Show authentication success notification
            this.mainWindow.webContents.send('whatsapp-login-success', {
                message: 'WhatsApp berhasil diautentikasi!',
                timestamp: new Date().toISOString()
            });
        });

        this.whatsappClient.on('auth_failure', (msg) => {
            this.logger.error('WhatsApp authentication failed:', msg);
            this.mainWindow.webContents.send('whatsapp-status-changed', { 
                isReady: false, 
                isConnecting: false,
                error: 'Authentication failed'
            });
            
            // Show authentication failure notification
            this.mainWindow.webContents.send('whatsapp-login-failed', {
                message: 'Gagal mengautentikasi WhatsApp. Silakan coba lagi.',
                timestamp: new Date().toISOString()
            });
        });

        this.whatsappClient.on('disconnected', (reason) => {
            this.logger.warn('WhatsApp client disconnected:', reason);
            this.mainWindow.webContents.send('whatsapp-status-changed', { 
                isReady: false, 
                isConnecting: false 
            });
        });

        this.whatsappClient.on('loading_screen', (percent, message) => {
            this.logger.info(`WhatsApp loading: ${percent}% - ${message}`);
        });
    }

    createTray() {
        const iconPath = path.join(__dirname, '../assets/tray-icon.png');
        const trayIcon = nativeImage.createFromPath(iconPath);
        
        this.tray = new Tray(trayIcon);
        
        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Show WA Blast PATITECH',
                click: () => {
                    this.mainWindow.show();
                    this.mainWindow.focus();
                }
            },
            {
                label: 'WhatsApp Status',
                submenu: [
                    {
                        label: 'Connected',
                        type: 'checkbox',
                        checked: false,
                        id: 'status-connected'
                    },
                    {
                        label: 'Disconnected',
                        type: 'checkbox',
                        checked: true,
                        id: 'status-disconnected'
                    }
                ]
            },
            { type: 'separator' },
            {
                label: 'Quit',
                click: () => {
                    this.isQuitting = true;
                    app.quit();
                }
            }
        ]);
        
        this.tray.setContextMenu(contextMenu);
        this.tray.setToolTip('WA Blast PATITECH Desktop');
        
        this.tray.on('double-click', () => {
            this.mainWindow.show();
            this.mainWindow.focus();
        });
    }

    async attemptAutoReconnect() {
        try {
            this.logger.info('Checking for existing WhatsApp session...');
            
            // Check if auto-reconnect is disabled
            const autoReconnectDisabled = this.store.get('whatsapp.autoReconnectDisabled', false);
            if (autoReconnectDisabled) {
                this.logger.info('Auto-reconnect is disabled by user');
                return;
            }
            
            // Check if user has ever connected before
            const hasEverConnected = this.store.get('whatsapp.hasEverConnected', false);
            if (!hasEverConnected) {
                this.logger.info('No previous connection found, skipping auto-reconnect');
                return;
            }
            
            // Check if session files actually exist and are valid
            const sessionDir = path.join(app.getPath('userData'), '.wwebjs_auth', 'session-whatsapp-labs-desktop');
            const criticalFiles = [
                'Default/IndexedDB/https_web.whatsapp.com_0.indexeddb.leveldb',
                'Default/Local Storage/leveldb',
                'Default/Cookies'
            ];
            
            let hasValidSession = true;
            let foundFiles = 0;
            
            for (const file of criticalFiles) {
                const filePath = path.join(sessionDir, file);
                if (!fs.existsSync(filePath)) {
                    this.logger.warn(`Critical session file missing: ${file}`);
                } else {
                    this.logger.info(`Session file found: ${file}`);
                    foundFiles++;
                }
            }
            
            // Require at least 2 critical files to be present
            if (foundFiles < 2) {
                this.logger.warn(`Insufficient session files found (${foundFiles}/3), skipping auto-reconnect`);
                hasValidSession = false;
            } else {
                this.logger.info(`Session validation passed: ${foundFiles}/3 critical files found`);
            }
            
            if (!hasValidSession) {
                this.logger.info('Session files incomplete or corrupted, skipping auto-reconnect');
                return;
            }
            
            this.logger.info('Valid session found, attempting auto-reconnect...');
            this.logger.info(`Session directory: ${sessionDir}`);
            this.logger.info(`Session validation passed: ${foundFiles}/3 critical files found`);
            this.logger.info('WhatsApp session is ready for auto-reconnect');
            
            // Wait a bit for the window to be ready
            setTimeout(async () => {
                try {
                    this.logger.info('Waiting 15 seconds before auto-reconnect...');
                    await new Promise(resolve => setTimeout(resolve, 15000));
                    
                    this.logger.info('Attempting auto-reconnect...');
                    
                    // Check session health before connecting
                    const sessionHealth = this.whatsappClient.checkSessionHealth();
                    if (!sessionHealth) {
                        this.logger.warn('Session health check failed, skipping auto-reconnect');
                        return;
                    }
                    
                    const result = await this.whatsappClient.connect();
                    if (result.success) {
                        this.logger.info('Auto-reconnect initiated successfully');
                        
                        // Wait longer to see if connection succeeds (60 seconds)
                        setTimeout(async () => {
                            const status = this.whatsappClient.getStatus();
                            if (status.isReady && status.isAuthenticated) {
                                this.logger.info('Auto-reconnect successful!');
                                this.store.set('whatsapp.hasEverConnected', true);
                                this.store.set('whatsapp.lastConnected', new Date().toISOString());
                            } else {
                                this.logger.warn('Auto-reconnect failed, session may have expired');
                                // Clear session if auto-reconnect fails
                                this.whatsappClient.clearSession();
                                this.store.set('whatsapp.hasEverConnected', false);
                                this.store.set('whatsapp.lastConnected', null);
                            }
                        }, 60000); // Wait 60 seconds for connection
                        setTimeout(() => {
                            const status = this.whatsappClient.getStatus();
                            if (status.isReady && status.isAuthenticated) {
                                this.logger.info('Auto-reconnect successful - WhatsApp is ready');
                            } else if (status.isConnecting) {
                                this.logger.warn('Auto-reconnect still connecting, may need QR code');
                            } else {
                                this.logger.warn('Auto-reconnect failed - session may be expired');
                                // Clear session if auto-reconnect fails
                                this.whatsappClient.clearSession();
                            }
                        }, 20000); // Wait 20 seconds
                    } else {
                        this.logger.warn('Auto-reconnect failed:', result.message);
                        // Clear session if auto-reconnect fails
                        this.whatsappClient.clearSession();
                    }
                } catch (error) {
                    this.logger.error('Auto-reconnect error:', error);
                    // Clear session on error
                    this.whatsappClient.clearSession();
                }
            }, 3000); // Wait 3 seconds
            
        } catch (error) {
            this.logger.error('Error during auto-reconnect check:', error);
        }
    }

    createMenu() {
        const template = [
            {
                label: 'File',
                submenu: [
                    {
                        label: 'Import Contacts',
                        accelerator: 'CmdOrCtrl+I',
                        click: () => {
                            this.importContacts();
                        }
                    },
                    {
                        label: 'Export Data',
                        accelerator: 'CmdOrCtrl+E',
                        click: () => {
                            this.exportData();
                        }
                    },
                    { type: 'separator' },
                    {
                        label: 'Settings',
                        accelerator: 'CmdOrCtrl+,',
                        click: () => {
                            this.openSettings();
                        }
                    },
                    { type: 'separator' },
                    {
                        label: 'Quit',
                        accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
                        click: () => {
                            this.isQuitting = true;
                            app.quit();
                        }
                    }
                ]
            },
            {
                label: 'WhatsApp',
                submenu: [
                    {
                        label: 'Connect',
                        click: () => {
                            this.whatsappClient.connect();
                        }
                    },
                    {
                        label: 'Disconnect',
                        click: () => {
                            this.whatsappClient.disconnect();
                        }
                    },
                    { type: 'separator' },
                    {
                        label: 'Show QR Code',
                        click: () => {
                            this.mainWindow.webContents.send('show-qr-code');
                        }
                    }
                ]
            },
            {
                label: 'Tools',
                submenu: [
                    {
                        label: 'Message Templates',
                        click: () => {
                            this.mainWindow.webContents.send('open-templates');
                        }
                    },
                    {
                        label: 'Scheduled Messages',
                        click: () => {
                            this.mainWindow.webContents.send('open-scheduler');
                        }
                    },
                    {
                        label: 'Analytics',
                        click: () => {
                            this.mainWindow.webContents.send('open-analytics');
                        }
                    }
                ]
            },
            {
                label: 'Help',
                submenu: [
                    {
                        label: 'Documentation',
                        click: () => {
                            shell.openExternal('https://github.com/whatsapp-labs/desktop');
                        }
                    },
                    {
                        label: 'Report Issue',
                        click: () => {
                            shell.openExternal('https://github.com/whatsapp-labs/desktop/issues');
                        }
                    },
                    { type: 'separator' },
                    {
                        label: 'About',
                        click: () => {
                            this.showAbout();
                        }
                    }
                ]
            }
        ];

        const menu = Menu.buildFromTemplate(template);
        Menu.setApplicationMenu(menu);
    }

    setupIpcHandlers() {
        // WhatsApp client events
        ipcMain.handle('whatsapp-connect', () => {
            return this.whatsappClient.connect();
        });

        ipcMain.handle('whatsapp-disconnect', () => {
            return this.whatsappClient.disconnect();
        });

        ipcMain.handle('whatsapp-force-disconnect', () => {
            return this.whatsappClient.forceDisconnect();
        });

        ipcMain.handle('whatsapp-get-status', () => {
            return this.whatsappClient.getStatus();
        });

        ipcMain.handle('whatsapp-check-health', async () => {
            return await this.whatsappClient.checkConnectionHealth();
        });

        ipcMain.handle('whatsapp-send-message', async (event, data) => {
            return await this.whatsappClient.sendMessage(data);
        });

        ipcMain.handle('whatsapp-send-bulk', async (event, data) => {
            return await this.whatsappClient.sendBulkMessages(data);
        });

        // CSV and Contact operations
        ipcMain.handle('csv-upload', async (event) => {
            try {
                const result = await dialog.showOpenDialog(this.mainWindow, {
                    title: 'Select CSV File',
                    filters: [
                        { name: 'CSV Files', extensions: ['csv'] },
                        { name: 'All Files', extensions: ['*'] }
                    ],
                    properties: ['openFile']
                });

                if (result.canceled || result.filePaths.length === 0) {
                    return { success: false, message: 'No file selected' };
                }

                const filePath = result.filePaths[0];
                const csvData = await this.csvParser.parseCSV(filePath);
                const validation = await this.csvParser.validateContacts(csvData.contacts);

                return {
                    success: true,
                    data: {
                        filePath,
                        headers: csvData.headers,
                        totalContacts: csvData.totalContacts,
                        validContacts: validation.validContacts,
                        invalidContacts: validation.invalidContacts,
                        totalValid: validation.totalValid,
                        totalInvalid: validation.totalInvalid
                    }
                };
            } catch (error) {
                this.logger.error('CSV upload error:', error);
                return { success: false, message: error.message };
            }
        });

        ipcMain.handle('csv-save-contacts', async (event, contacts) => {
            try {
                const result = await this.database.saveContacts(contacts);
                return { success: true, data: result };
            } catch (error) {
                this.logger.error('Save contacts error:', error);
                return { success: false, message: error.message };
            }
        });

        ipcMain.handle('contact-add', async (event, contact) => {
            try {
                const result = await this.database.saveContact(contact);
                return { success: true, data: result };
            } catch (error) {
                this.logger.error('Add contact error:', error);
                return { success: false, message: error.message };
            }
        });

        ipcMain.handle('contact-update', async (event, contact) => {
            try {
                const result = await this.database.saveContact(contact);
                return { success: true, data: result };
            } catch (error) {
                this.logger.error('Update contact error:', error);
                return { success: false, message: error.message };
            }
        });

        ipcMain.handle('contact-delete', async (event, id) => {
            try {
                const result = await this.database.deleteContact(id);
                return { success: true, data: result };
            } catch (error) {
                this.logger.error('Delete contact error:', error);
                return { success: false, message: error.message };
            }
        });

        ipcMain.handle('template-add', async (event, template) => {
            try {
                const result = await this.database.saveTemplate(template);
                return { success: true, data: result };
            } catch (error) {
                this.logger.error('Add template error:', error);
                return { success: false, message: error.message };
            }
        });

        ipcMain.handle('template-update', async (event, template) => {
            try {
                const result = await this.database.saveTemplate(template);
                return { success: true, data: result };
            } catch (error) {
                this.logger.error('Update template error:', error);
                return { success: false, message: error.message };
            }
        });

        ipcMain.handle('template-delete', async (event, id) => {
            try {
                const result = await this.database.deleteTemplate(id);
                return { success: true, data: result };
            } catch (error) {
                this.logger.error('Delete template error:', error);
                return { success: false, message: error.message };
            }
        });

        // Contact Groups operations
        ipcMain.handle('contact-group-add', async (event, group) => {
            try {
                const result = await this.database.saveContactGroup(group);
                return { success: true, data: result };
            } catch (error) {
                this.logger.error('Add contact group error:', error);
                return { success: false, message: error.message };
            }
        });

        ipcMain.handle('contact-group-update', async (event, group) => {
            try {
                const result = await this.database.saveContactGroup(group);
                return { success: true, data: result };
            } catch (error) {
                this.logger.error('Update contact group error:', error);
                return { success: false, message: error.message };
            }
        });

        ipcMain.handle('contact-group-delete', async (event, id) => {
            try {
                const result = await this.database.deleteContactGroup(id);
                return { success: true, data: result };
            } catch (error) {
                this.logger.error('Delete contact group error:', error);
                return { success: false, message: error.message };
            }
        });

        ipcMain.handle('contact-group-get-all', async (event) => {
            try {
                const groups = await this.database.getContactGroups();
                return { success: true, data: groups };
            } catch (error) {
                this.logger.error('Get contact groups error:', error);
                return { success: false, message: error.message };
            }
        });

        ipcMain.handle('contact-assign-group', async (event, contactId, groupId) => {
            try {
                const result = await this.database.assignContactToGroup(contactId, groupId);
                return { success: true, data: result };
            } catch (error) {
                this.logger.error('Assign contact to group error:', error);
                return { success: false, message: error.message };
            }
        });

        ipcMain.handle('contact-group-get-contacts', async (event, groupId) => {
            try {
                console.log(`IPC: Getting contacts for group ${groupId}`);
                const contacts = await this.database.getContactsByGroup(groupId);
                console.log(`IPC: Returning ${contacts.length} contacts for group ${groupId}`);
                return { success: true, data: contacts };
            } catch (error) {
                this.logger.error('Get contacts by group error:', error);
                return { success: false, message: error.message };
            }
        });

        // Additional IPC handlers for get operations
        ipcMain.handle('contact-group-get', async (event, id) => {
            try {
                const result = await this.database.getContactGroup(id);
                return { success: true, data: result };
            } catch (error) {
                this.logger.error('Get contact group error:', error);
                return { success: false, message: error.message };
            }
        });

        ipcMain.handle('contact-get', async (event, id) => {
            try {
                const result = await this.database.getContact(id);
                return { success: true, data: result };
            } catch (error) {
                this.logger.error('Get contact error:', error);
                return { success: false, message: error.message };
            }
        });

        ipcMain.handle('template-get', async (event, id) => {
            try {
                const result = await this.database.getTemplate(id);
                return { success: true, data: result };
            } catch (error) {
                this.logger.error('Get template error:', error);
                return { success: false, message: error.message };
            }
        });

        // Database operations
        ipcMain.handle('db-get-contacts', () => {
            return this.database.getContacts();
        });

        ipcMain.handle('db-save-contacts', (event, contacts) => {
            return this.database.saveContacts(contacts);
        });

        ipcMain.handle('db-get-templates', async () => {
            try {
                const templates = await this.database.getTemplates();
                console.log('Retrieved templates:', templates);
                return templates;
            } catch (error) {
                console.error('Error getting templates:', error);
                return [];
            }
        });

        ipcMain.handle('db-save-template', (event, template) => {
            return this.database.saveTemplate(template);
        });

        ipcMain.handle('db-delete-template', (event, id) => {
            return this.database.deleteTemplate(id);
        });

        // File operations
        ipcMain.handle('file-import-csv', async () => {
            const result = await dialog.showOpenDialog(this.mainWindow, {
                properties: ['openFile'],
                filters: [
                    { name: 'CSV Files', extensions: ['csv'] },
                    { name: 'All Files', extensions: ['*'] }
                ]
            });

            if (!result.canceled && result.filePaths.length > 0) {
                const filePath = result.filePaths[0];
                const content = fs.readFileSync(filePath, 'utf-8');
                return { success: true, content, filePath };
            }

            return { success: false };
        });

        ipcMain.handle('file-export-data', async (event, data) => {
            const result = await dialog.showSaveDialog(this.mainWindow, {
                defaultPath: 'whatsapp-labs-export.json',
                filters: [
                    { name: 'JSON Files', extensions: ['json'] },
                    { name: 'All Files', extensions: ['*'] }
                ]
            });

            if (!result.canceled) {
                fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2));
                return { success: true, path: result.filePath };
            }

            return { success: false };
        });

        // Settings
        ipcMain.handle('settings-get', () => {
            return this.store.store;
        });

        ipcMain.handle('settings-set', (event, key, value) => {
            this.store.set(key, value);
            return true;
        });

        // Scheduler
        ipcMain.handle('scheduler-get-tasks', () => {
            return this.scheduler.getTasks();
        });

        ipcMain.handle('scheduler-add-task', (event, task) => {
            return this.scheduler.addTask(task);
        });

        ipcMain.handle('scheduler-remove-task', (event, id) => {
            return this.scheduler.removeTask(id);
        });

        // Analytics
        ipcMain.handle('analytics-get-stats', () => {
            return this.database.getAnalytics();
        });

        // Message Logs
        ipcMain.handle('message-logs-get-all', async () => {
            try {
                const logs = await this.database.getMessageLogs();
                return { success: true, data: logs };
            } catch (error) {
                this.logger.error('Get message logs error:', error);
                return { success: false, message: error.message };
            }
        });

        ipcMain.handle('message-logs-add', async (event, log) => {
            try {
                const result = await this.database.addMessageLog(log);
                return { success: true, data: result };
            } catch (error) {
                this.logger.error('Add message log error:', error);
                return { success: false, message: error.message };
            }
        });

        ipcMain.handle('message-logs-update', async (event, id, log) => {
            try {
                const result = await this.database.updateMessageLog(id, log);
                return { success: true, data: result };
            } catch (error) {
                this.logger.error('Update message log error:', error);
                return { success: false, message: error.message };
            }
        });

        ipcMain.handle('message-logs-delete', async (event, id) => {
            try {
                const result = await this.database.deleteMessageLog(id);
                return { success: true, data: result };
            } catch (error) {
                this.logger.error('Delete message log error:', error);
                return { success: false, message: error.message };
            }
        });
        ipcMain.on('open-live-whatsapp', () => {
    this.createLiveWhatsAppView();
});

ipcMain.on('close-live-whatsapp', () => {
    this.destroyLiveWhatsAppView();
});

    }

    setupAutoUpdater() {
        autoUpdater.checkForUpdatesAndNotify();
        
        autoUpdater.on('update-available', () => {
            this.mainWindow.webContents.send('update-available');
        });

        autoUpdater.on('update-downloaded', () => {
            this.mainWindow.webContents.send('update-downloaded');
        });
    }

    async importContacts() {
        const result = await dialog.showOpenDialog(this.mainWindow, {
            properties: ['openFile'],
            filters: [
                { name: 'CSV Files', extensions: ['csv'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });

        if (!result.canceled && result.filePaths.length > 0) {
            const filePath = result.filePaths[0];
            // Process the CSV file
            this.mainWindow.webContents.send('import-contacts', filePath);
        }
    }

    async exportData() {
        const result = await dialog.showSaveDialog(this.mainWindow, {
            defaultPath: 'whatsapp-labs-export.json',
            filters: [
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });

        if (!result.canceled) {
            // Export data
            this.mainWindow.webContents.send('export-data', result.filePath);
        }
    }

    openSettings() {
        this.mainWindow.webContents.send('open-settings');
    }

    showAbout() {
        dialog.showMessageBox(this.mainWindow, {
            type: 'info',
            title: 'About WA Blast PATITECH Desktop',
            message: 'WA Blast PATITECH Desktop v2.0.0',
            detail: 'Professional WhatsApp Bulk Message Sender\n\nBuilt with Electron and love ❤️',
            buttons: ['OK']
        });
    }

    updateTrayStatus(connected) {
        if (this.tray) {
            const contextMenu = Menu.buildFromTemplate([
                {
                    label: 'Show WA Blast PATITECH',
                    click: () => {
                        this.mainWindow.show();
                        this.mainWindow.focus();
                    }
                },
                {
                    label: 'WhatsApp Status',
                    submenu: [
                        {
                            label: 'Connected',
                            type: 'checkbox',
                            checked: connected,
                            id: 'status-connected'
                        },
                        {
                            label: 'Disconnected',
                            type: 'checkbox',
                            checked: !connected,
                            id: 'status-disconnected'
                        }
                    ]
                },
                { type: 'separator' },
                {
                    label: 'Quit',
                    click: () => {
                        this.isQuitting = true;
                        app.quit();
                    }
                }
            ]);
            
            this.tray.setContextMenu(contextMenu);
        }
    }
}

// Create the application instance
const whatsappLabsDesktop = new WhatsAppLabsDesktop();
