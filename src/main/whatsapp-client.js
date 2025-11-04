const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const EventEmitter = require('events');
const path = require('path');

class WhatsAppClient extends EventEmitter {
    constructor(logger, mainWindow = null) {
        super();
        this.client = null;
        this.isReady = false;
        this.isConnecting = false;
        this.qrCodeData = null;
        this.logger = logger;
        this.messageQueue = [];
        this.sendingMessages = false;
        this.mainWindow = mainWindow;
        this.hasEverConnected = false;
        this.autoConnect = false;
        this.connectionTimeout = null;
        this.isAuthenticated = false;
        
        // Load connection state from storage
        this.loadConnectionState();
        
        this.setupEventHandlers();
    }

    setMainWindow(mainWindow) {
        this.mainWindow = mainWindow;
    }

    setupEventHandlers() {
        this.on('qr', (qr) => {
            this.logger.info('QR code received, generating...');
            this.generateQRCode(qr);
            
            // Set QR code timeout (60 seconds)
            this.qrTimeout = setTimeout(() => {
                this.logger.warn('QR code timeout - no scan detected');
                if (this.mainWindow && this.mainWindow.webContents) {
                    this.mainWindow.webContents.send('whatsapp-qr-timeout', {
                        message: 'QR code expired, please try again',
                        reason: 'No scan detected within 60 seconds'
                    });
                }
            }, 60000); // 60 seconds QR timeout
        });

        this.on('ready', () => {
            this.isReady = true;
            this.isConnecting = false;
            this.isAuthenticated = true;
            this.hasEverConnected = true;
            this.logger.info('WhatsApp client is ready and authenticated');
            
            // Clear connection timeout
            if (this.connectionTimeout) {
                clearTimeout(this.connectionTimeout);
                this.connectionTimeout = null;
                this.logger.info('Connection timeout cleared - connection successful');
            }
            
            // Clear QR timeout
            if (this.qrTimeout) {
                clearTimeout(this.qrTimeout);
                this.qrTimeout = null;
                this.logger.info('QR timeout cleared - connection successful');
            }
            
            // Save connection state to persistent storage
            this.saveConnectionState();
            
            // Emit login success event
            if (this.mainWindow && this.mainWindow.webContents) {
                this.mainWindow.webContents.send('whatsapp-login-success');
                this.mainWindow.webContents.send('whatsapp-status-changed', {
                    isReady: true,
                    isConnecting: false,
                    isAuthenticated: true
                });
            }
            
            // Set auto-connect flag for future sessions
            this.autoConnect = true;
        });

        this.on('authenticated', () => {
            this.logger.info('WhatsApp authenticated successfully');
            this.isAuthenticated = true;
            this.hasEverConnected = true;
            
            // Emit login success event
            if (this.mainWindow && this.mainWindow.webContents) {
                this.mainWindow.webContents.send('whatsapp-login-success');
            }
        });

        this.on('auth_failure', (msg) => {
            this.logger.error('WhatsApp authentication failed:', msg);
            this.isConnecting = false;
            this.isAuthenticated = false;
            this.isReady = false;
            
            // Clear session if authentication fails
            this.clearSession();
            
            // Emit auth failure event
            if (this.mainWindow && this.mainWindow.webContents) {
                this.mainWindow.webContents.send('whatsapp-login-failed', {
                    message: 'Authentication failed',
                    reason: msg
                });
            }
        });

        this.on('disconnected', (reason) => {
            this.logger.warn('WhatsApp client disconnected:', reason);
            this.isReady = false;
            this.isConnecting = false;
            this.isAuthenticated = false;
            
            // Emit disconnected event
            if (this.mainWindow && this.mainWindow.webContents) {
                this.mainWindow.webContents.send('whatsapp-status-changed', {
                    isReady: false,
                    isConnecting: false,
                    isAuthenticated: false
                });
            }
        });

        this.on('loading_screen', (percent, message) => {
            this.logger.info(`WhatsApp loading: ${percent}% - ${message}`);
        });
    }

    async initialize() {
        try {
            this.logger.info('Initializing WhatsApp client...');
            
            const { app } = require('electron');
            const sessionPath = path.join(app.getPath('userData'), '.wwebjs_auth');
            this.logger.info(`Using session path: ${sessionPath}`);
            
            // Check if session directory exists
            const fs = require('fs');
            if (fs.existsSync(sessionPath)) {
                this.logger.info('Session directory exists, using existing session');
            } else {
                this.logger.info('Session directory does not exist, will create new session');
            }

            this.client = new Client({
                authStrategy: new LocalAuth({
                    clientId: "whatsapp-labs-desktop",
                    dataPath: sessionPath
                }),
                puppeteer: {
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-gpu',
                        '--no-first-run',
                        '--disable-web-security',
                        '--disable-features=VizDisplayCompositor',
                        '--disable-background-timer-throttling',
                        '--disable-backgrounding-occluded-windows',
                        '--disable-renderer-backgrounding',
                        '--disable-extensions',
                        '--disable-plugins',
                        '--disable-web-security',
                        '--disable-features=TranslateUI',
                        '--disable-ipc-flooding-protection',
                        '--disable-hang-monitor',
                        '--disable-prompt-on-repost',
                        '--disable-sync',
                        '--disable-default-apps',
                        '--disable-background-networking',
                        '--disable-background-timer-throttling',
                        '--disable-renderer-backgrounding',
                        '--disable-backgrounding-occluded-windows',
                        '--disable-features=TranslateUI,BlinkGenPropertyTrees',
                        '--window-size=1920,1080',
                        '--memory-pressure-off',
                        '--max_old_space_size=4096'
                    ],
                    timeout: 60000,
                    protocolTimeout: 60000
                }
            });

            // Setup client event handlers
            this.client.on('qr', (qr) => {
                this.logger.info('QR code received from WhatsApp client');
                this.emit('qr', qr);
            });

            this.client.on('ready', () => {
                this.emit('ready');
            });

            this.client.on('authenticated', () => {
                this.emit('authenticated');
            });

            this.client.on('auth_failure', (msg) => {
                this.emit('auth_failure', msg);
            });

            this.client.on('disconnected', (reason) => {
                this.emit('disconnected', reason);
            });

            this.client.on('loading_screen', (percent, message) => {
                this.emit('loading_screen', percent, message);
            });

            this.logger.info('WhatsApp client initialized successfully');
            
        } catch (error) {
            this.logger.error('Failed to initialize WhatsApp client:', error);
            throw error;
        }
    }

    async connect() {
        if (this.isConnecting) {
            this.logger.warn('Already connecting, ignoring duplicate request');
            return { success: false, message: 'Already connecting' };
        }

        if (this.isReady && this.isAuthenticated) {
            this.logger.info('Already connected and authenticated');
            return { success: true, message: 'Already connected and authenticated' };
        }

        try {
            this.isConnecting = true;
            this.isReady = false;
            this.isAuthenticated = false;
            this.logger.info('Connecting to WhatsApp...');
            
            // Clear any existing timeout
            if (this.connectionTimeout) {
                clearTimeout(this.connectionTimeout);
                this.connectionTimeout = null;
            }
            
            // Check if we have a valid session first
            const Store = require('electron-store');
            const store = new Store();
            const hasValidSession = store.get('whatsapp.hasEverConnected', false);
            const lastConnected = store.get('whatsapp.lastConnected', null);
            
            if (hasValidSession && lastConnected) {
                const lastConnectedDate = new Date(lastConnected);
                const now = new Date();
                const daysSinceLastConnection = (now - lastConnectedDate) / (1000 * 60 * 60 * 24);
                
                // If last connection was more than 7 days ago, clear session
                if (daysSinceLastConnection > 7) {
                    this.logger.info('Session expired (more than 7 days old), clearing session');
                    this.clearSession();
                }
            }
            
            // Check if session directory has critical files
            const fs = require('fs');
            const { app } = require('electron');
            const sessionDir = path.join(app.getPath('userData'), '.wwebjs_auth', 'session-whatsapp-labs-desktop');
            const criticalFiles = [
                'Default/IndexedDB/https_web.whatsapp.com_0.indexeddb.leveldb',
                'Default/Local Storage/leveldb',
                'Default/Cookies'
            ];
            
            let foundFiles = 0;
            for (const file of criticalFiles) {
                const filePath = path.join(sessionDir, file);
                if (fs.existsSync(filePath)) {
                    foundFiles++;
                    this.logger.info(`Session file found: ${file}`);
                } else {
                    this.logger.warn(`Session file missing: ${file}`);
                }
            }
            
            if (foundFiles < 1) {
                this.logger.warn(`No session files found (${foundFiles}/3), will require QR scan`);
            } else if (foundFiles < 2) {
                this.logger.warn(`Minimal session files found (${foundFiles}/3), may require QR scan`);
            } else {
                this.logger.info(`Session validation passed: ${foundFiles}/3 critical files found`);
            }
            
            // Always initialize fresh client for each connection
            this.logger.info('Initializing WhatsApp client...');
            
            // Add 15 seconds delay before initialization to allow system to stabilize
            this.logger.info('Waiting 15 seconds before initialization...');
            await new Promise(resolve => setTimeout(resolve, 15000));
            
            await this.initialize();

            this.logger.info('Starting WhatsApp client initialization...');
            
            // Add progress logging
            const initStartTime = Date.now();
            this.logger.info('WhatsApp client initialization started at:', new Date().toISOString());
            
            // Send progress update to renderer
            if (this.mainWindow && this.mainWindow.webContents) {
                this.mainWindow.webContents.send('whatsapp-init-progress', {
                    message: 'Initializing WhatsApp client...',
                    progress: 0
                });
            }
            
            try {
                // Add retry logic for initialization
                let retryCount = 0;
                const maxRetries = 2;
                
                while (retryCount <= maxRetries) {
                    try {
                        await this.client.initialize();
                        const initDuration = Date.now() - initStartTime;
                        this.logger.info(`WhatsApp client initialization completed in ${initDuration}ms`);
                        
                        // Send completion update to renderer
                        if (this.mainWindow && this.mainWindow.webContents) {
                            this.mainWindow.webContents.send('whatsapp-init-progress', {
                                message: 'WhatsApp client initialized successfully',
                                progress: 100
                            });
                        }
                        break; // Success, exit retry loop
                    } catch (initError) {
                        retryCount++;
                        if (retryCount <= maxRetries) {
                            this.logger.warn(`Initialization attempt ${retryCount} failed, retrying... (${initError.message})`);
                            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
                        } else {
                            throw initError; // Re-throw if all retries failed
                        }
                    }
                }
            } catch (error) {
                const initDuration = Date.now() - initStartTime;
                this.logger.error(`WhatsApp client initialization failed after ${initDuration}ms:`, error);
                
                // Send error update to renderer
                if (this.mainWindow && this.mainWindow.webContents) {
                    this.mainWindow.webContents.send('whatsapp-init-progress', {
                        message: 'WhatsApp client initialization failed',
                        progress: -1,
                        error: error.message
                    });
                }
                throw error;
            }
            
                // Set timeout for connection (60 seconds for better session recovery)
                this.connectionTimeout = setTimeout(() => {
                    if (this.isConnecting && !this.isReady) {
                        this.logger.warn('Connection timeout after 60 seconds, clearing session and requesting QR code');
                        this.isConnecting = false;
                        this.isReady = false;
                        this.isAuthenticated = false;
                        this.clearSession();
                        
                        // Emit timeout event
                        if (this.mainWindow && this.mainWindow.webContents) {
                            this.mainWindow.webContents.send('whatsapp-login-failed', {
                                message: 'Connection timeout after 60 seconds',
                                reason: 'Cannot connect - please scan QR code again'
                            });
                            this.mainWindow.webContents.send('whatsapp-status-changed', {
                                isReady: false,
                                isConnecting: false,
                                isAuthenticated: false
                            });
                        }
                    }
                }, 60000); // 60 seconds timeout for better session recovery
            
            this.logger.info('WhatsApp client initialization started successfully');
            return { success: true, message: 'Connecting to WhatsApp...' };
            
        } catch (error) {
            this.logger.error('Failed to connect to WhatsApp:', error);
            this.isConnecting = false;
            this.isReady = false;
            this.isAuthenticated = false;
            return { success: false, message: error.message };
        }
    }

    // Add method to check connection health
    async checkConnectionHealth() {
        try {
            if (!this.client) {
                return { healthy: false, reason: 'Client not initialized' };
            }

            // Check if client is ready
            if (!this.isReady) {
                return { healthy: false, reason: 'Client not ready' };
            }

            // Try to get client info to verify connection
            const clientInfo = await this.client.getState();
            if (clientInfo === 'CONNECTED') {
                return { healthy: true, reason: 'Connected and ready' };
            } else {
                return { healthy: false, reason: `Client state: ${clientInfo}` };
            }
        } catch (error) {
            this.logger.error('Connection health check failed:', error);
            return { healthy: false, reason: error.message };
        }
    }


    async disconnect() {
        try {
            if (this.client) {
                // Force destroy the client
                try {
                    await this.client.destroy();
                } catch (destroyError) {
                    this.logger.warn('Error during client destroy:', destroyError);
                }
                
                this.client = null;
                this.isReady = false;
                this.isConnecting = false;
                this.qrCodeData = null;
                this.logger.info('WhatsApp client disconnected');
            }
            
            return { success: true, message: 'Disconnected from WhatsApp' };
            
        } catch (error) {
            this.logger.error('Failed to disconnect from WhatsApp:', error);
            return { success: false, message: error.message };
        }
    }

    loadConnectionState() {
        try {
            const Store = require('electron-store');
            const store = new Store();
            
            // Load connection state from storage
            this.hasEverConnected = store.get('whatsapp.hasEverConnected', false);
            this.isAuthenticated = store.get('whatsapp.isAuthenticated', false);
            this.isReady = store.get('whatsapp.isReady', false);
            this.autoConnect = store.get('whatsapp.autoConnect', false);
            
            this.logger.info('Loaded connection state from storage:', {
                hasEverConnected: this.hasEverConnected,
                isAuthenticated: this.isAuthenticated,
                isReady: this.isReady,
                autoConnect: this.autoConnect
            });
            
        } catch (error) {
            this.logger.error('Error loading connection state:', error);
        }
    }

    saveConnectionState() {
        try {
            const Store = require('electron-store');
            const store = new Store();
            
            // Save connection state
            store.set('whatsapp.hasEverConnected', true);
            store.set('whatsapp.lastConnected', new Date().toISOString());
            store.set('whatsapp.isAuthenticated', true);
            store.set('whatsapp.isReady', true);
            store.set('whatsapp.autoConnect', true);
            
            // Also save to instance variables
            this.hasEverConnected = true;
            this.isReady = true;
            this.isAuthenticated = true;
            
            this.logger.info('Connection state saved to persistent storage');
            this.logger.info('Saved values:', {
                hasEverConnected: store.get('whatsapp.hasEverConnected'),
                lastConnected: store.get('whatsapp.lastConnected'),
                isAuthenticated: store.get('whatsapp.isAuthenticated'),
                isReady: store.get('whatsapp.isReady')
            });
            
        } catch (error) {
            this.logger.error('Error saving connection state:', error);
        }
    }

    checkSessionHealth() {
        try {
            const fs = require('fs');
            const { app } = require('electron');
            const sessionDir = path.join(app.getPath('userData'), '.wwebjs_auth', 'session-whatsapp-labs-desktop');
            
            // Check if session directory exists
            if (!fs.existsSync(sessionDir)) {
                this.logger.warn('Session directory does not exist');
                return false;
            }
            
            const criticalFiles = [
                'Default/IndexedDB/https_web.whatsapp.com_0.indexeddb.leveldb',
                'Default/Local Storage/leveldb',
                'Default/Cookies'
            ];
            
            let foundFiles = 0;
            for (const file of criticalFiles) {
                const filePath = path.join(sessionDir, file);
                if (fs.existsSync(filePath)) {
                    foundFiles++;
                    this.logger.info(`Session health check - file found: ${file}`);
                } else {
                    this.logger.warn(`Session health check - file missing: ${file}`);
                }
            }
            
            // More lenient health check - only need 1 critical file, but prefer 2
            const isHealthy = foundFiles >= 1;
            const isOptimal = foundFiles >= 2;
            this.logger.info(`Session health check: ${foundFiles}/3 critical files found - ${isHealthy ? 'HEALTHY' : 'UNHEALTHY'} ${isOptimal ? '(OPTIMAL)' : '(MINIMAL)'}`);
            return isHealthy;
            
        } catch (error) {
            this.logger.error('Error checking session health:', error);
            return false;
        }
    }

    clearSession() {
        try {
            const fs = require('fs');
            const Store = require('electron-store');
            const store = new Store();
            
            // Clear session directory
            const { app } = require('electron');
            const sessionDir = path.join(app.getPath('userData'), '.wwebjs_auth');
            if (fs.existsSync(sessionDir)) {
                fs.rmSync(sessionDir, { recursive: true, force: true });
                this.logger.info(`Cleared WhatsApp session directory: ${sessionDir}`);
            } else {
                this.logger.info('Session directory does not exist, nothing to clear');
            }
            
            // Clear cache directory
            const cacheDir = path.join(app.getPath('userData'), '.wwebjs_cache');
            if (fs.existsSync(cacheDir)) {
                fs.rmSync(cacheDir, { recursive: true, force: true });
                this.logger.info(`Cleared WhatsApp cache directory: ${cacheDir}`);
            } else {
                this.logger.info('Cache directory does not exist, nothing to clear');
            }
            
            // Clear stored connection state
            store.set('whatsapp.hasEverConnected', false);
            store.set('whatsapp.lastConnected', null);
            store.set('whatsapp.isAuthenticated', false);
            
            // Reset connection status
            this.hasEverConnected = false;
            this.isReady = false;
            this.isConnecting = false;
            this.isAuthenticated = false;
            
            // Clear timeout
            if (this.connectionTimeout) {
                clearTimeout(this.connectionTimeout);
                this.connectionTimeout = null;
            }
            
        } catch (error) {
            this.logger.error('Error clearing session:', error);
        }
    }

    async forceDisconnect() {
        try {
            this.logger.info('Force disconnecting WhatsApp...');
            
            // Clear timeout
            if (this.connectionTimeout) {
                clearTimeout(this.connectionTimeout);
                this.connectionTimeout = null;
            }
            
            // Disconnect client
            await this.disconnect();
            
            // Clear session
            this.clearSession();
            
            // Reset all states
            this.isReady = false;
            this.isConnecting = false;
            this.isAuthenticated = false;
            this.hasEverConnected = false;
            
            this.logger.info('Force disconnect completed');
            return { success: true, message: 'Force disconnected successfully' };
            
        } catch (error) {
            this.logger.error('Error during force disconnect:', error);
            return { success: false, message: error.message };
        }
    }

    async generateQRCode(qr) {
        try {
            this.logger.info('Generating QR code...');
            this.logger.info('QR string length:', qr ? qr.length : 'undefined');
            this.qrCodeData = await QRCode.toDataURL(qr);
            this.logger.info('QR code generated successfully, data length:', this.qrCodeData ? this.qrCodeData.length : 'undefined');
            
            // Emit QR code to renderer
            if (this.mainWindow && this.mainWindow.webContents) {
                this.logger.info('Sending QR code to renderer...');
                this.mainWindow.webContents.send('whatsapp-qr-code', this.qrCodeData);
                this.logger.info('QR code sent to renderer successfully');
            } else {
                this.logger.warn('Main window not available, cannot send QR code');
                this.logger.warn('Main window exists:', !!this.mainWindow);
                this.logger.warn('WebContents exists:', !!(this.mainWindow && this.mainWindow.webContents));
            }
            
            // Clear connection timeout since QR code is generated
            if (this.connectionTimeout) {
                clearTimeout(this.connectionTimeout);
                this.connectionTimeout = null;
                this.logger.info('Connection timeout cleared - QR code generated');
            }
            
        } catch (error) {
            this.logger.error('Failed to generate QR code:', error);
        }
    }

    async sendMessage(data) {
        if (!this.isReady || !this.client) {
            return { success: false, message: 'WhatsApp client is not ready' };
        }

        try {
            const { phoneNumber, message, media } = data;
            
            // Format phone number
            const formattedPhone = this.formatPhoneNumber(phoneNumber);
            
            let messageOptions = {};
            
            // Handle media if provided
            if (media && media.type && media.data) {
                const mediaObj = new MessageMedia(media.type, media.data, media.filename);
                messageOptions.media = mediaObj;
            }
            
            // Send message
            await this.client.sendMessage(formattedPhone, message, messageOptions);
            
            this.logger.info(`Message sent to ${phoneNumber}`);
            
            return { 
                success: true, 
                message: 'Message sent successfully',
                phoneNumber: formattedPhone
            };
            
        } catch (error) {
            this.logger.error('Failed to send message:', error);
            return { success: false, message: error.message };
        }
    }

    async sendBulkMessages(data) {
        if (!this.isReady || !this.client) {
            return { success: false, message: 'WhatsApp client is not ready' };
        }

        if (this.sendingMessages) {
            return { success: false, message: 'Bulk sending already in progress' };
        }

        try {
            this.sendingMessages = true;
            const { contacts, template, rules, delay = 3000, media } = data;
            
            const results = {
                total: contacts.length,
                success: 0,
                failed: 0,
                errors: []
            };

            this.logger.info(`Starting bulk message sending to ${contacts.length} contacts`);

            for (let i = 0; i < contacts.length; i++) {
                const contact = contacts[i];
                
                try {
                    // Apply rules if any
                    if (rules && rules.length > 0) {
                        let shouldSend = true;
                        
                        for (const rule of rules) {
                            const fieldValue = contact[rule.field];
                            const condition = rule.condition;
                            const value = rule.value;
                            
                            switch (condition) {
                                case 'equals':
                                    if (fieldValue !== value) shouldSend = false;
                                    break;
                                case 'contains':
                                    if (!fieldValue || !fieldValue.toString().includes(value)) shouldSend = false;
                                    break;
                                case 'not_empty':
                                    if (!fieldValue || fieldValue.toString().trim() === '') shouldSend = false;
                                    break;
                                case 'greater_than':
                                    if (parseFloat(fieldValue) <= parseFloat(value)) shouldSend = false;
                                    break;
                            }
                        }
                        
                        if (!shouldSend) {
                            results.failed++;
                            results.errors.push({
                                contact: contact,
                                error: 'Filtered out by rules'
                            });
                            continue;
                        }
                    }

                    // Format message with contact data
                    let message = template;
                    if (typeof template !== 'string') {
                        this.logger.error('Template is not a string:', typeof template);
                        throw new Error('Template must be a string');
                    }
                    
                    if (!contact || typeof contact !== 'object') {
                        this.logger.error('Contact is not a valid object:', contact);
                        throw new Error('Contact must be a valid object');
                    }
                    
                    Object.keys(contact).forEach(key => {
                        const placeholder = `{${key}}`;
                        const value = contact[key] || '';
                        message = message.replace(new RegExp(placeholder, 'g'), String(value));
                    });

                    // Format phone number - try multiple field names
                    const phoneNumber = contact.phone || contact.number || contact.telepon || contact.phoneNumber;
                    this.logger.info(`Contact phone fields - phone: ${contact.phone}, number: ${contact.number}, telepon: ${contact.telepon}, phoneNumber: ${contact.phoneNumber}`);
                    
                    if (!phoneNumber || typeof phoneNumber !== 'string') {
                        this.logger.error('Invalid phone number for contact:', contact);
                        this.logger.error('Available fields:', Object.keys(contact));
                        throw new Error(`Phone number is required and must be a string. Contact: ${contact.name || 'Unknown'}, Available fields: ${Object.keys(contact).join(', ')}`);
                    }
                    
                    const formattedPhone = this.formatPhoneNumber(phoneNumber);

                    // Emit progress update before sending
                    if (this.mainWindow && this.mainWindow.webContents) {
                        this.mainWindow.webContents.send('whatsapp-progress-update', {
                            currentContact: contact,
                            progress: i + 1,
                            total: contacts.length
                        });
                    }

                    // Prepare message data
                    const messageData = {
                        phoneNumber: phoneNumber,
                        message: message,
                        media: media
                    };

                    // Send message
                    const result = await this.sendMessage(messageData);
                    
                    if (result.success) {
                        results.success++;
                        this.logger.info(`Message sent to ${contact.name || phoneNumber} (${i + 1}/${contacts.length})`);
                        
                        // Emit progress update
                        if (this.mainWindow && this.mainWindow.webContents) {
                            this.mainWindow.webContents.send('whatsapp-message-sent', {
                                contact: contact,
                                progress: i + 1,
                                total: contacts.length
                            });
                        }
                    } else {
                        results.failed++;
                        results.errors.push({
                            contact: contact,
                            error: result.message
                        });
                        
                        // Emit error update
                        if (this.mainWindow && this.mainWindow.webContents) {
                            this.mainWindow.webContents.send('whatsapp-message-failed', {
                                contact: contact,
                                error: result.message,
                                progress: i + 1,
                                total: contacts.length
                            });
                        }
                    }
                    
                    // Delay between messages
                    if (i < contacts.length - 1) {
                        let actualDelay = delay;
                        
                        // Handle random delay
                        if (typeof delay === 'object' && delay.type === 'random') {
                            actualDelay = Math.floor(Math.random() * (delay.max - delay.min + 1)) + delay.min;
                        }
                        
                        await new Promise(resolve => setTimeout(resolve, actualDelay));
                    }
                    
                } catch (error) {
                    results.failed++;
                    results.errors.push({
                        contact: contact,
                        error: error.message
                    });
                    
                    this.logger.error(`Failed to send message to ${contact.name || contact.phone || 'Unknown'}:`, error);
                    
                    // Emit error update
                    if (this.mainWindow && this.mainWindow.webContents) {
                        this.mainWindow.webContents.send('whatsapp-message-failed', {
                            contact: contact,
                            error: error.message,
                            progress: i + 1,
                            total: contacts.length
                        });
                    }
                }
            }

            this.logger.info(`Bulk sending completed. Success: ${results.success}, Failed: ${results.failed}`);
            
            // Emit completion event
            if (this.mainWindow && this.mainWindow.webContents) {
                this.mainWindow.webContents.send('whatsapp-bulk-completed', results);
            }

            return { success: true, results: results };
            
        } catch (error) {
            this.logger.error('Failed to send bulk messages:', error);
            return { success: false, message: error.message };
        } finally {
            this.sendingMessages = false;
        }
    }

    formatPhoneNumber(phone) {
        try {
            if (!phone || typeof phone !== 'string') {
                throw new Error('Phone number is required and must be a string');
            }
            
            // Remove all non-digit characters
            let cleaned = phone.replace(/\D/g, '');
            
            if (!cleaned || cleaned.length < 8) {
                throw new Error('Phone number is too short or invalid');
            }
            
            // Add country code if not present (assuming Indonesia +62)
            if (cleaned.startsWith('0')) {
                cleaned = '62' + cleaned.substring(1);
            } else if (!cleaned.startsWith('62')) {
                cleaned = '62' + cleaned;
            }
            
            return cleaned + '@c.us';
            
        } catch (error) {
            this.logger.error('Error formatting phone number:', error);
            throw new Error(`Invalid phone number: ${phone}`);
        }
    }

    getStatus() {
        return {
            isReady: this.isReady,
            isConnecting: this.isConnecting,
            isAuthenticated: this.isAuthenticated,
            qrCode: this.qrCodeData,
            sendingMessages: this.sendingMessages,
            hasEverConnected: this.hasEverConnected || false,
            autoConnect: this.autoConnect || false
        };
    }

    async getChats() {
        if (!this.isReady || !this.client) {
            return [];
        }

        try {
            const chats = await this.client.getChats();
            return chats;
        } catch (error) {
            this.logger.error('Failed to get chats:', error);
            return [];
        }
    }

    async getContacts() {
        if (!this.isReady || !this.client) {
            return [];
        }

        try {
            const contacts = await this.client.getContacts();
            return contacts;
        } catch (error) {
            this.logger.error('Failed to get contacts:', error);
            return [];
        }
    }

    async sendMedia(phoneNumber, mediaPath, caption = '') {
        if (!this.isReady || !this.client) {
            return { success: false, message: 'WhatsApp client is not ready' };
        }

        try {
            const formattedPhone = this.formatPhoneNumber(phoneNumber);
            const media = MessageMedia.fromFilePath(mediaPath);
            
            if (caption) {
                media.caption = caption;
            }
            
            await this.client.sendMessage(formattedPhone, media);
            
            this.logger.info(`Media sent to ${phoneNumber}`);
            
            return { success: true, message: 'Media sent successfully' };
            
        } catch (error) {
            this.logger.error('Failed to send media:', error);
            return { success: false, message: error.message };
        }
    }
}

module.exports = { WhatsAppClient };
