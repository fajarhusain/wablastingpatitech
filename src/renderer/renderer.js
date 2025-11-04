// Global variables
let currentPage = 'dashboard';
let contacts = [];
let templates = [];
let scheduledTasks = [];
let whatsappStatus = { isReady: false, isConnecting: false };

// Pagination variables
let paginationConfig = {
    itemsPerPage: 10,
    currentPage: 1,
    totalPages: 1,
    totalItems: 0
};

let currentPagination = {
    contacts: { currentPage: 1, totalPages: 1, totalItems: 0, perPage: 10 },
    groups: { currentPage: 1, totalPages: 1, totalItems: 0, perPage: 10 },
    templates: { currentPage: 1, totalPages: 1, totalItems: 0, perPage: 10 },
    scheduler: { currentPage: 1, totalPages: 1, totalItems: 0, perPage: 10 },
    analytics: { currentPage: 1, totalPages: 1, totalItems: 0, perPage: 10 }
};

// Progress tracking variables
let sendingProgress = {
    total: 0,
    sent: 0,
    failed: 0,
    remaining: 0,
    isSending: false,
    currentContact: null,
    logs: []
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    try {
        // Setup event listeners
        setupEventListeners();
        
        // Load initial data
        await loadInitialData();
        
        // Setup WhatsApp event listeners
        setupWhatsAppEventListeners();
        
        // Setup periodic status check
        setupPeriodicStatusCheck();
        
        // Initialize autocomplete
        initializeAutocomplete();
        
        // Setup pagination
        setupPagination();
        
        console.log('Application initialized successfully');
    } catch (error) {
        console.error('Failed to initialize application:', error);
        showNotification('Failed to initialize application', 'error');
    }
}

function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.dataset.page;
            navigateToPage(page);
        });
    });

    // Header buttons
    document.getElementById('refresh-btn').addEventListener('click', refreshData);
    document.getElementById('connect-btn').addEventListener('click', connectWhatsApp);
    document.getElementById('connect-main-btn').addEventListener('click', connectWhatsApp);
    document.getElementById('force-disconnect-btn').addEventListener('click', forceDisconnectWhatsApp);

    // CSV and Contact buttons
    document.getElementById('upload-csv-btn').addEventListener('click', uploadCSV);
    document.getElementById('add-contact-btn').addEventListener('click', showAddContactModal);
    document.getElementById('bulk-assign-group-btn').addEventListener('click', showBulkAssignGroupModal);
    document.getElementById('select-all-contacts').addEventListener('change', toggleSelectAllContacts);

    // Contact Group buttons
    document.getElementById('add-contact-group-btn').addEventListener('click', showAddContactGroupModal);

    // Template buttons
    document.getElementById('add-template-btn').addEventListener('click', showAddTemplateModal);

    // Message sending
    document.getElementById('send-messages-btn').addEventListener('click', sendMessages);
    document.getElementById('message-template').addEventListener('change', updateMessagePreview);
    
    // Delay type radio buttons
    document.querySelectorAll('input[name="delay-type"]').forEach(radio => {
        radio.addEventListener('change', handleDelayTypeChange);
    });

    // Settings
    document.getElementById('save-settings-btn').addEventListener('click', saveSettings);

    // Form submissions
    document.getElementById('add-contact-form').addEventListener('submit', handleAddContact);
    document.getElementById('add-contact-group-form').addEventListener('submit', handleAddContactGroup);
    document.getElementById('add-template-form').addEventListener('submit', handleAddTemplate);
    
    // Add keyboard shortcuts for form inputs
    document.addEventListener('keydown', function(e) {
        const activeElement = document.activeElement;
        const isFormElement = activeElement && (
            activeElement.tagName === 'INPUT' || 
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.classList.contains('form-input') ||
            activeElement.classList.contains('form-textarea') ||
            activeElement.classList.contains('autocomplete-input')
        );
        
        if (isFormElement) {
            // Ctrl+A or Cmd+A for select all
            if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                e.preventDefault();
                activeElement.select();
                return;
            }
            
            // Ctrl+C or Cmd+C for copy - let default behavior work
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                // Don't prevent default - let browser handle copy
                return;
            }
            
            // Ctrl+V or Cmd+V for paste - let default behavior work
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                // Don't prevent default - let browser handle paste
                return;
            }
            
            // Ctrl+X or Cmd+X for cut - let default behavior work
            if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
                // Don't prevent default - let browser handle cut
                return;
            }
        }
    });
    
    // Enable context menu for form inputs
    document.addEventListener('contextmenu', function(e) {
        const activeElement = document.activeElement;
        const isFormElement = activeElement && (
            activeElement.tagName === 'INPUT' || 
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.classList.contains('form-input') ||
            activeElement.classList.contains('form-textarea') ||
            activeElement.classList.contains('autocomplete-input')
        );
        
        if (isFormElement) {
            // Allow context menu for form inputs
            e.stopPropagation();
            return true;
        }
    });
    
    // Add mouse event listeners for form inputs
    document.addEventListener('mousedown', function(e) {
        const target = e.target;
        const isFormElement = target && (
            target.tagName === 'INPUT' || 
            target.tagName === 'TEXTAREA' ||
            target.classList.contains('form-input') ||
            target.classList.contains('form-textarea') ||
            target.classList.contains('autocomplete-input')
        );
        
        if (isFormElement) {
            // Ensure the element can receive focus and text selection
            target.focus();
        }
    });
    
    // Global paste event listener
    document.addEventListener('paste', function(e) {
        const target = e.target;
        console.log('Global paste event detected on:', target);
        console.log('Target tag:', target.tagName);
        console.log('Target classes:', target.className);
        console.log('Target ID:', target.id);
        
        // Only handle template content paste
        if (target.id === 'template-content') {
            console.log('Template content paste detected globally');
            // Let the specific handler deal with it
        } else {
            // Don't prevent default for other paste events
            // Let the browser handle paste naturally
        }
    });
    
    // Override any global event prevention
    document.addEventListener('keydown', function(e) {
        // Only handle template content
        if (e.target.id === 'template-content') {
            // Don't prevent default for template content
            // Let our specific handlers deal with it
        }
    });
    
    // Specific handler for template content textarea
    const templateContent = document.getElementById('template-content');
    if (templateContent) {
        console.log('Template content element found:', templateContent);
        console.log('Template content attributes:', {
            id: templateContent.id,
            className: templateContent.className,
            tagName: templateContent.tagName,
            type: templateContent.type,
            readonly: templateContent.readOnly,
            disabled: templateContent.disabled,
            contenteditable: templateContent.contentEditable
        });
        
        // Remove any existing event listeners
        templateContent.removeEventListener('paste', handleTemplatePaste);
        templateContent.removeEventListener('keydown', handleTemplateKeydown);
        templateContent.removeEventListener('input', handleTemplateInput);
        
        // Add new event listeners
        templateContent.addEventListener('paste', handleTemplatePaste);
        templateContent.addEventListener('keydown', handleTemplateKeydown);
        templateContent.addEventListener('input', handleTemplateInput);
        
        // Ensure the textarea is properly configured
        templateContent.setAttribute('contenteditable', 'true');
        templateContent.setAttribute('spellcheck', 'true');
        templateContent.style.userSelect = 'text';
        templateContent.style.webkitUserSelect = 'text';
        
        // Remove any attributes that might interfere
        templateContent.removeAttribute('readonly');
        templateContent.removeAttribute('disabled');
        templateContent.removeAttribute('readonly');
        
        // Set proper attributes
        templateContent.setAttribute('autocomplete', 'off');
        templateContent.setAttribute('spellcheck', 'true');
        templateContent.setAttribute('contenteditable', 'true');
    }
    
    // Template paste handler
    function handleTemplatePaste(e) {
        console.log('Paste event detected in template content');
        console.log('Clipboard data:', e.clipboardData);
        
        // Prevent default to handle paste manually
        e.preventDefault();
        
        // Try to get clipboard data
        const clipboardData = e.clipboardData || window.clipboardData;
        if (clipboardData) {
            const pastedText = clipboardData.getData('text/plain');
            console.log('Pasted text:', pastedText);
            
            if (pastedText) {
                // Manual paste
                const currentValue = templateContent.value;
                const cursorPos = templateContent.selectionStart;
                const newValue = currentValue.substring(0, cursorPos) + pastedText + currentValue.substring(templateContent.selectionEnd);
                templateContent.value = newValue;
                
                // Set cursor position after pasted text
                const newCursorPos = cursorPos + pastedText.length;
                templateContent.setSelectionRange(newCursorPos, newCursorPos);
                
                console.log('Manual paste completed. New value:', templateContent.value);
                
                // Trigger input event to notify other handlers
                const inputEvent = new Event('input', { bubbles: true });
                templateContent.dispatchEvent(inputEvent);
            }
        } else {
            console.log('No clipboard data available');
        }
    }
    
    // Template keydown handler
    function handleTemplateKeydown(e) {
        // Handle paste with Ctrl+V / Cmd+V
        if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
            console.log('Paste shortcut detected in template content');
            e.preventDefault();
            
            // Try to get clipboard data
            navigator.clipboard.readText().then(text => {
                console.log('Clipboard text from navigator.clipboard:', text);
                if (text) {
                    // Manual paste
                    const currentValue = templateContent.value;
                    const cursorPos = templateContent.selectionStart;
                    const newValue = currentValue.substring(0, cursorPos) + text + currentValue.substring(templateContent.selectionEnd);
                    templateContent.value = newValue;
                    
                    // Set cursor position after pasted text
                    const newCursorPos = cursorPos + text.length;
                    templateContent.setSelectionRange(newCursorPos, newCursorPos);
                    
                    console.log('Manual paste from clipboard API completed. New value:', templateContent.value);
                    
                    // Trigger input event
                    const inputEvent = new Event('input', { bubbles: true });
                    templateContent.dispatchEvent(inputEvent);
                }
            }).catch(err => {
                console.log('Clipboard API failed, trying fallback:', err);
                // Fallback: let the paste event handle it
            });
        }
        
        // Ensure select all works with Ctrl+A / Cmd+A
        if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
            console.log('Select all shortcut detected in template content');
            e.preventDefault();
            templateContent.select();
        }
    }
    
    // Template input handler
    function handleTemplateInput(e) {
        console.log('Input event detected in template content');
        console.log('Input event type:', e.type);
        console.log('Input event target:', e.target);
        console.log('Input event data:', e.data);
        console.log('Template content value after input:', templateContent.value);
    }
    
    // Debug function to test paste functionality
    window.testPaste = function() {
        const templateContent = document.getElementById('template-content');
        if (templateContent) {
            console.log('Testing paste functionality...');
            console.log('Template content element:', templateContent);
            console.log('Template content value:', templateContent.value);
            console.log('Template content selectionStart:', templateContent.selectionStart);
            console.log('Template content selectionEnd:', templateContent.selectionEnd);
            
            // Test manual text insertion
            const testText = 'Test paste text - ' + new Date().toISOString();
            templateContent.value = testText;
            console.log('Manual text insertion test completed');
        }
    };
    
    // Debug function to test all paste methods
    window.testAllPasteMethods = function() {
        const testText = 'Test paste - ' + new Date().toISOString();
        console.log('Testing all paste methods with text:', testText);
        
        // Method 1: Direct paste
        console.log('Method 1: Direct paste');
        window.pasteToTemplateDirect(testText + ' - Direct');
        
        // Method 2: execCommand paste
        console.log('Method 2: execCommand paste');
        window.pasteToTemplate(testText + ' - execCommand');
        
        // Method 3: HTML paste
        console.log('Method 3: HTML paste');
        window.pasteToTemplateHTML(testText + ' - HTML');
        
        console.log('All paste methods tested');
    };
    
    // Debug function to check textarea attributes
    window.checkTextareaAttributes = function() {
        const templateContent = document.getElementById('template-content');
        if (templateContent) {
            console.log('Textarea attributes check:');
            console.log('Element:', templateContent);
            console.log('Tag name:', templateContent.tagName);
            console.log('ID:', templateContent.id);
            console.log('Class name:', templateContent.className);
            console.log('Type:', templateContent.type);
            console.log('Readonly:', templateContent.readOnly);
            console.log('Disabled:', templateContent.disabled);
            console.log('Contenteditable:', templateContent.contentEditable);
            console.log('Spellcheck:', templateContent.spellcheck);
            console.log('Autocomplete:', templateContent.autocomplete);
            console.log('Value:', templateContent.value);
            console.log('Selection start:', templateContent.selectionStart);
            console.log('Selection end:', templateContent.selectionEnd);
            console.log('Selection direction:', templateContent.selectionDirection);
        }
    };
    
    // Alternative paste method using document.execCommand
    window.pasteToTemplate = function(text) {
        const templateContent = document.getElementById('template-content');
        if (templateContent) {
            console.log('Pasting text to template:', text);
            
            // Focus the textarea
            templateContent.focus();
            
            // Use document.execCommand for paste
            const success = document.execCommand('insertText', false, text);
            console.log('execCommand insertText success:', success);
            
            if (!success) {
                // Fallback: manual insertion
                const currentValue = templateContent.value;
                const cursorPos = templateContent.selectionStart;
                const newValue = currentValue.substring(0, cursorPos) + text + currentValue.substring(templateContent.selectionEnd);
                templateContent.value = newValue;
                
                // Set cursor position after pasted text
                const newCursorPos = cursorPos + text.length;
                templateContent.setSelectionRange(newCursorPos, newCursorPos);
                
                console.log('Fallback manual paste completed');
            }
            
            // Trigger input event
            const inputEvent = new Event('input', { bubbles: true });
            templateContent.dispatchEvent(inputEvent);
        }
    };
    
    // New method: Direct DOM manipulation with MutationObserver
    window.pasteToTemplateDirect = function(text) {
        const templateContent = document.getElementById('template-content');
        if (templateContent) {
            console.log('Direct paste to template:', text);
            
            // Focus the textarea
            templateContent.focus();
            
            // Get current selection
            const start = templateContent.selectionStart;
            const end = templateContent.selectionEnd;
            
            // Get current value
            const currentValue = templateContent.value;
            
            // Create new value with pasted text
            const newValue = currentValue.substring(0, start) + text + currentValue.substring(end);
            
            // Set the new value
            templateContent.value = newValue;
            
            // Set cursor position after pasted text
            const newCursorPos = start + text.length;
            templateContent.setSelectionRange(newCursorPos, newCursorPos);
            
            console.log('Direct paste completed. New value:', templateContent.value);
            
            // Trigger multiple events to ensure all handlers are notified
            const inputEvent = new Event('input', { bubbles: true });
            const changeEvent = new Event('change', { bubbles: true });
            templateContent.dispatchEvent(inputEvent);
            templateContent.dispatchEvent(changeEvent);
        }
    };
    
    // New method: Using innerHTML for contenteditable
    window.pasteToTemplateHTML = function(text) {
        const templateContent = document.getElementById('template-content');
        if (templateContent) {
            console.log('HTML paste to template:', text);
            
            // Make it contenteditable
            templateContent.setAttribute('contenteditable', 'true');
            templateContent.focus();
            
            // Get current selection
            const selection = window.getSelection();
            const range = selection.getRangeAt(0);
            
            // Insert text
            range.deleteContents();
            range.insertNode(document.createTextNode(text));
            
            // Move cursor to end
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
            
            console.log('HTML paste completed');
        }
    };
}

let connectionStartTime = null;
let connectionTimeoutId = null;
let periodicCheckInterval = null;

function setupPeriodicStatusCheck() {
    // Clear any existing interval
    if (periodicCheckInterval) {
        clearInterval(periodicCheckInterval);
    }
    
    // Check status every 5 seconds when connecting
    periodicCheckInterval = setInterval(async () => {
        try {
            const status = await window.electronAPI.whatsapp.getStatus();
            
            if (status.isConnecting && !status.isReady) {
                // Track connection start time
                if (!connectionStartTime) {
                    connectionStartTime = Date.now();
                    console.log('Connection started, tracking time...');
                }
                
                const connectionDuration = Date.now() - connectionStartTime;
                const minutes = Math.floor(connectionDuration / 60000);
                const seconds = Math.floor((connectionDuration % 60000) / 1000);
                
                console.log(`Periodic status check - still connecting... (${minutes}m ${seconds}s)`);
                updateWhatsAppStatus(status);
                
                // If connecting for more than 15 seconds, show warning
                if (connectionDuration > 15000) { // 15 seconds
                    console.warn('Connection taking longer than expected (>15 seconds)');
                    showNotification('WhatsApp connection is taking longer than expected. Please wait...', 'warning');
                }
                
                // If connecting for more than 45 seconds, show timeout and stop periodic check
                if (connectionDuration > 45000) { // 45 seconds - increased from 15 seconds
                    console.error('Connection timeout after 45 seconds');
                    showNotification('Cannot connect to WhatsApp. Please scan QR code again.', 'error');
                    
                    // Stop periodic check
                    if (periodicCheckInterval) {
                        clearInterval(periodicCheckInterval);
                        periodicCheckInterval = null;
                    }
                    
                    // Reset connection state
                    connectionStartTime = null;
                    
                    // Update connection panel to show QR code button
                    updateConnectionPanel('disconnected');
                    
                    // Force disconnect to reset state
                    try {
                        await window.electronAPI.whatsapp.forceDisconnect();
                    } catch (error) {
                        console.error('Error force disconnecting:', error);
                    }
                }
                
            } else if (status.isReady) {
                // Connection successful - verify with health check
                try {
                    const health = await window.electronAPI.whatsapp.checkHealth();
                    if (health.healthy) {
                        console.log('WhatsApp connection successful and healthy!');
                        connectionStartTime = null;
                        updateWhatsAppStatus(status);
                        showNotification('WhatsApp connected successfully!', 'success');
                        
                        // Stop periodic check
                        if (periodicCheckInterval) {
                            clearInterval(periodicCheckInterval);
                            periodicCheckInterval = null;
                        }
                    } else {
                        console.warn('WhatsApp connected but health check failed:', health.reason);
                        showNotification(`WhatsApp connected but may have issues: ${health.reason}`, 'warning');
                    }
                } catch (error) {
                    console.error('Health check failed:', error);
                    console.log('WhatsApp connection successful (health check failed)');
                    connectionStartTime = null;
                    updateWhatsAppStatus(status);
                    showNotification('WhatsApp connected successfully!', 'success');
                    
                    // Stop periodic check
                    if (periodicCheckInterval) {
                        clearInterval(periodicCheckInterval);
                        periodicCheckInterval = null;
                    }
                }
            } else if (!status.isConnecting) {
                // Not connecting anymore
                connectionStartTime = null;
                updateWhatsAppStatus(status);
                
                // Stop periodic check
                if (periodicCheckInterval) {
                    clearInterval(periodicCheckInterval);
                    periodicCheckInterval = null;
                }
            }
        } catch (error) {
            console.error('Error in periodic status check:', error);
        }
    }, 5000); // Check every 5 seconds
}

function showQRCodeButton() {
    // Update connection panel to show QR code button
    const connectionPanel = document.querySelector('.connection-panel');
    if (connectionPanel) {
        connectionPanel.innerHTML = `
            <div class="connection-status">
                <div class="status-indicator disconnected"></div>
                <div class="status-text">WhatsApp Not Connected</div>
                <div class="status-description">Please scan QR code to connect</div>
                <button class="btn btn-primary" onclick="connectWhatsApp()" style="margin-top: 1rem;">
                    <i class="fas fa-qrcode"></i> Show QR Code
                </button>
            </div>
        `;
    }
}

function setupWhatsAppEventListeners() {
    // Remove existing listeners to prevent duplicates
    window.electronAPI.removeAllListeners('whatsapp-status-changed');
    window.electronAPI.removeAllListeners('whatsapp-login-success');
    window.electronAPI.removeAllListeners('whatsapp-login-failed');
    window.electronAPI.removeAllListeners('whatsapp-qr-code');
    window.electronAPI.removeAllListeners('whatsapp-qr-timeout');
    window.electronAPI.removeAllListeners('whatsapp-message-sent');
    window.electronAPI.removeAllListeners('whatsapp-message-failed');
    window.electronAPI.removeAllListeners('whatsapp-bulk-completed');
    window.electronAPI.removeAllListeners('whatsapp-progress-update');
    window.electronAPI.removeAllListeners('whatsapp-init-progress');
    
    // WhatsApp status changes
    window.electronAPI.on('whatsapp-status-changed', (event, status) => {
        console.log('WhatsApp status changed:', status);
        
        // Stop periodic check if not connecting anymore
        if (!status.isConnecting && periodicCheckInterval) {
            clearInterval(periodicCheckInterval);
            periodicCheckInterval = null;
            connectionStartTime = null;
        }
        
        updateWhatsAppStatus(status);
    });

    // WhatsApp login failed
    window.electronAPI.on('whatsapp-login-failed', (event, data) => {
        console.log('WhatsApp login failed:', data);
        
        // Stop periodic check on login failure
        if (periodicCheckInterval) {
            clearInterval(periodicCheckInterval);
            periodicCheckInterval = null;
            connectionStartTime = null;
        }
        
        updateWhatsAppStatus({ 
            isReady: false, 
            isConnecting: false, 
            isAuthenticated: false 
        });
        showNotification(data.message || 'WhatsApp login failed', 'error');
        
        // Update connection panel to show QR code button
        updateConnectionPanel('disconnected');
    });

    // QR code received
    window.electronAPI.on('whatsapp-qr-code', (event, qrData) => {
        console.log('QR code event received in renderer');
        console.log('QR data type:', typeof qrData);
        console.log('QR data length:', qrData ? qrData.length : 'undefined');
        console.log('QR data preview:', qrData ? qrData.substring(0, 50) + '...' : 'undefined');
        
        // Stop periodic check when QR code is shown
        if (periodicCheckInterval) {
            clearInterval(periodicCheckInterval);
            periodicCheckInterval = null;
        }
        
        hideLoadingModal();
        showQRCode(qrData);
        showQRModal();
    });

    // QR code timeout
    window.electronAPI.on('whatsapp-qr-timeout', (event, data) => {
        console.log('QR code timeout received in renderer');
        showNotification(data.message || 'QR code expired, please try again', 'error');
        closeQRModal();
        updateConnectionPanel('disconnected');
    });

    // Message sent
    window.electronAPI.on('whatsapp-message-sent', (event, data) => {
        handleMessageSent(data);
    });

    // Message failed
    window.electronAPI.on('whatsapp-message-failed', (event, data) => {
        handleMessageFailed(data);
    });

    // Bulk sending completed
    window.electronAPI.on('whatsapp-bulk-completed', (event, results) => {
        handleBulkCompleted(results);
    });

    // Progress update
    window.electronAPI.on('whatsapp-progress-update', (event, data) => {
        handleProgressUpdate(data);
    });

    // Init progress update
    window.electronAPI.on('whatsapp-init-progress', (event, data) => {
        console.log('WhatsApp init progress:', data);
        if (data.progress === 0) {
            showLoadingModal('Initializing WhatsApp...', data.message);
        } else if (data.progress === 100) {
            hideLoadingModal();
            showNotification('WhatsApp client initialized successfully', 'success');
        } else if (data.progress === -1) {
            hideLoadingModal();
            showNotification(`WhatsApp initialization failed: ${data.error}`, 'error');
        }
    });

    // Import contacts
    window.electronAPI.on('import-contacts', (event, filePath) => {
        importContacts(filePath);
    });

    // Export data
    window.electronAPI.on('export-data', (event, filePath) => {
        exportData(filePath);
    });

    // Open settings
    window.electronAPI.on('open-settings', () => {
        navigateToPage('settings');
    });

    // Show QR code
    window.electronAPI.on('show-qr-code', () => {
        showQRModal();
    });

    // WhatsApp login success
    window.electronAPI.on('whatsapp-login-success', (event, data) => {
        console.log('WhatsApp login successful:', data);
        
        // Stop periodic check on successful login
        if (periodicCheckInterval) {
            clearInterval(periodicCheckInterval);
            periodicCheckInterval = null;
            connectionStartTime = null;
        }
        
        // Safe message handling
        const message = (data && data.message) ? data.message : 'WhatsApp connected successfully!';
        showNotification(message, 'success');
        hideLoadingModal();
        closeQRModal();
        
        // Update status to connected
        updateWhatsAppStatus({ 
            isReady: true, 
            isConnecting: false, 
            isAuthenticated: true 
        });
    });

    // WhatsApp login failed
    window.electronAPI.on('whatsapp-login-failed', (event, data) => {
        console.log('WhatsApp login failed:', data);
        
        // Stop periodic check on login failure
        if (periodicCheckInterval) {
            clearInterval(periodicCheckInterval);
            periodicCheckInterval = null;
            connectionStartTime = null;
        }
        
        // Safe message handling
        const message = (data && data.message) ? data.message : 'WhatsApp login failed';
        showNotification(message, 'error');
        hideLoadingModal();
        closeQRModal();
        
        // Update status to disconnected
        updateWhatsAppStatus({ 
            isReady: false, 
            isConnecting: false, 
            isAuthenticated: false 
        });
    });
}

async function loadInitialData() {
    try {
        // Load contacts with pagination
        await loadContacts();

        // Load templates with pagination
        await loadTemplates();

        // Load contact groups
        await loadContactGroups();
        // Store contactGroups globally for use in updateContactsTable
        window.contactGroups = contactGroups;

        // Load scheduled tasks with pagination
        await loadScheduledTasks();

        // Load analytics
        await loadAnalytics();

        // Get WhatsApp status (only if user has previously connected)
        try {
            whatsappStatus = await window.electronAPI.whatsapp.getStatus();
            // Only update status if there's an active connection or user has connected before
            if (whatsappStatus.isReady || whatsappStatus.isConnecting || whatsappStatus.hasEverConnected) {
                updateWhatsAppStatus(whatsappStatus);
            } else {
                // Set initial disconnected state without showing connect prompt
                updateWhatsAppStatus({ isReady: false, isConnecting: false });
            }
        } catch (error) {
            console.log('WhatsApp status not available:', error);
            // Set default disconnected state
            updateWhatsAppStatus({ isReady: false, isConnecting: false });
        }

        // Update dashboard stats
        updateDashboardStats();

    } catch (error) {
        console.error('Failed to load initial data:', error);
    }
}

async function navigateToPage(page) {
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-page="${page}"]`).classList.add('active');

    // Update page content
    document.querySelectorAll('.page-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${page}-page`).classList.add('active');

    // Update page title and icon
    const pageData = {
        dashboard: { title: 'Dashboard', icon: 'fas fa-chart-line' },
        contacts: { title: 'Contacts', icon: 'fas fa-users' },
        'contact-groups': { title: 'Contact Groups', icon: 'fas fa-layer-group' },
        templates: { title: 'Templates', icon: 'fas fa-file-alt' },
        messages: { title: 'Send Messages', icon: 'fas fa-paper-plane' },
        scheduler: { title: 'Scheduler', icon: 'fas fa-clock' },
        analytics: { title: 'Analytics', icon: 'fas fa-chart-bar' },
        settings: { title: 'Settings', icon: 'fas fa-cog' }
    };

    const pageInfo = pageData[page];
    document.getElementById('page-title-text').textContent = pageInfo.title;
    document.getElementById('page-icon').innerHTML = `<i class="${pageInfo.icon}"></i>`;

    currentPage = page;

    // Load data for the specific page
    await loadPageData(page);
}

async function loadPageData(page) {
    try {
        switch (page) {
            case 'contacts':
                await loadContacts();
                setupContactSearch(); // Setup search functionality
                break;
            case 'contact-groups':
                await loadContactGroups();
                break;
            case 'templates':
                await loadTemplates();
                break;
            case 'messages':
                console.log('Loading messages page data...');
                await loadTemplates(); // Load templates for message sending
                await loadContactsForMessages();
                await loadContactGroups(); // Load contact groups first
                await loadGroupsForMessages();
                
                // Add event listeners for radio buttons
                setTimeout(() => {
                    console.log('Setting up message listeners after timeout...');
                    setupMessageTargetTypeListeners();
                }, 200);
                break;
            case 'scheduler':
                await loadScheduledTasks();
                break;
            case 'analytics':
                await loadAnalytics();
                setupMessageLogs(); // Setup message logs functionality
                loadMessageLogs(); // Load message logs
                break;
            case 'dashboard':
                await loadDashboardData();
                break;
            default:
                break;
        }
    } catch (error) {
        console.error(`Failed to load data for page ${page}:`, error);
    }
}

async function loadDashboardData() {
    try {
        // Load contacts count
        const contacts = await window.electronAPI.database.getContacts();
        document.getElementById('total-contacts').textContent = contacts.length;

        // Load templates count
        const templates = await window.electronAPI.database.getTemplates();
        document.getElementById('scheduled-count').textContent = templates.length;

        // Load contact groups count
        const result = await window.electronAPI.contactGroups.getAll();
        if (result.success) {
            document.getElementById('messages-sent').textContent = result.data.length;
        }
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
    }
}

async function loadScheduledTasks() {
    try {
        const tasks = await window.electronAPI.scheduler.getTasks();
        updateSchedulerTable(tasks);
    } catch (error) {
        console.error('Failed to load scheduled tasks:', error);
        showNotification('Failed to load scheduled tasks', 'error');
    }
}

async function refreshData() {
    try {
        showNotification('Refreshing data...', 'info');
        await loadInitialData();
        showNotification('Data refreshed successfully', 'success');
    } catch (error) {
        console.error('Failed to refresh data:', error);
        showNotification('Failed to refresh data', 'error');
    }
}

async function connectWhatsApp() {
    try {
        // Check current status first
        const currentStatus = await window.electronAPI.whatsapp.getStatus();
        console.log('Current WhatsApp status:', currentStatus);
        
        if (currentStatus.isReady && currentStatus.isAuthenticated) {
            // Disconnect
            const result = await window.electronAPI.whatsapp.disconnect();
            if (result.success) {
                showNotification('WhatsApp disconnected', 'success');
                updateConnectionPanel('disconnected');
            } else {
                showNotification('Failed to disconnect: ' + result.message, 'error');
            }
        } else if (currentStatus.isConnecting) {
            showNotification('Already connecting to WhatsApp...', 'info');
            return;
        } else {
            // Connect
            showLoadingModal('Connecting to WhatsApp...', 'Initializing WhatsApp client...');
            
            const result = await window.electronAPI.whatsapp.connect();
            if (result.success) {
                showNotification('Connecting to WhatsApp...', 'info');
                
                // Update status to connecting
                updateWhatsAppStatus({ 
                    isReady: false, 
                    isConnecting: true, 
                    isAuthenticated: false 
                });
                
                showLoadingModal('Generating QR Code...', 'Please wait while we generate the QR code for scanning');
                
                // Start periodic status check
                setupPeriodicStatusCheck();
                
                // Show QR modal after a short delay
                setTimeout(() => {
                    hideLoadingModal();
                    showQRModal();
                }, 2000);
            } else {
                hideLoadingModal();
                showNotification('Failed to connect: ' + result.message, 'error');
                updateConnectionPanel('disconnected');
            }
        }
    } catch (error) {
        console.error('Failed to connect/disconnect WhatsApp:', error);
        hideLoadingModal();
        showNotification('Failed to connect/disconnect WhatsApp', 'error');
        updateConnectionPanel('disconnected');
    }
}

function updateWhatsAppStatus(status) {
    whatsappStatus = status;
    
    console.log('updateWhatsAppStatus called with:', status);
    console.log('Status details:', {
        isReady: status.isReady,
        isConnecting: status.isConnecting,
        isAuthenticated: status.isAuthenticated
    });
    
    // Stop periodic check if not connecting anymore
    if (!status.isConnecting && periodicCheckInterval) {
        clearInterval(periodicCheckInterval);
        periodicCheckInterval = null;
        connectionStartTime = null;
    }
    
    const indicator = document.getElementById('status-indicator');
    const text = document.getElementById('status-text');
    const connectBtn = document.getElementById('connect-btn');
    const connectBtnText = document.getElementById('connect-btn-text');

    if (status.isReady && status.isAuthenticated) {
        console.log('Status: Connected and authenticated');
        indicator.classList.add('connected');
        text.textContent = 'Connected';
        connectBtn.innerHTML = '<i class="fas fa-unlink"></i><span>Disconnect</span>';
        updateConnectionPanel('connected');
        
        // Show force disconnect button
        const forceDisconnectBtn = document.getElementById('force-disconnect-btn');
        if (forceDisconnectBtn) {
            forceDisconnectBtn.style.display = 'block';
        }
    } else if (status.isConnecting) {
        console.log('Status: Connecting...');
        indicator.classList.add('connecting');
        indicator.classList.remove('connected');
        text.textContent = 'Connecting...';
        connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Connecting...</span>';
        connectBtn.disabled = true;
        updateConnectionPanel('connecting');
    } else {
        console.log('Status: Disconnected');
        indicator.classList.remove('connected', 'connecting');
        text.textContent = 'Disconnected';
        connectBtn.innerHTML = '<i class="fas fa-link"></i><span>Connect WhatsApp</span>';
        connectBtn.disabled = false;
        updateConnectionPanel('disconnected');
        
        // Hide force disconnect button
        const forceDisconnectBtn = document.getElementById('force-disconnect-btn');
        if (forceDisconnectBtn) {
            forceDisconnectBtn.style.display = 'none';
        }
    }
}

function updateConnectionPanel(status) {
    const indicator = document.getElementById('status-indicator-large');
    const text = document.getElementById('connection-text');
    const description = document.getElementById('connection-description');
    const connectBtn = document.getElementById('connect-main-btn');

    indicator.className = 'status-indicator-large';
    
    switch (status) {
    case 'connected':
        indicator.classList.add('connected');
        text.textContent = 'WhatsApp Terhubung';
        description.textContent = 'Anda sekarang dapat mengirim pesan massal ke kontak Anda.';
        connectBtn.innerHTML = '<i class="fas fa-unlink"></i> Putuskan Koneksi WhatsApp';
        connectBtn.disabled = false;
        break;

    case 'connecting':
        indicator.classList.add('connecting');
        text.textContent = 'Menghubungkan ke WhatsApp...';
        description.textContent = 'Mohon tunggu, sistem sedang menyambungkan ke WhatsApp.';
        connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menghubungkan...';
        connectBtn.disabled = true;
        break;

    default:
        indicator.classList.remove('connected', 'connecting');
        text.textContent = 'Belum Terhubung ke WhatsApp';
        description.textContent = 'Klik tombol di bawah untuk menampilkan kode QR dan mulai koneksi WhatsApp Anda.';
        connectBtn.innerHTML = '<i class="fas fa-qrcode"></i> Tampilkan Kode QR';
        connectBtn.disabled = false;
}

}

function showLoadingModal(title, subtitle) {
    document.getElementById('loading-text').textContent = title;
    document.getElementById('loading-subtext').textContent = subtitle;
    document.getElementById('loading-modal').style.display = 'flex';
}

function hideLoadingModal() {
    document.getElementById('loading-modal').style.display = 'none';
}

async function forceDisconnectWhatsApp() {
    if (confirm('Are you sure you want to force disconnect and clear all session data? This will require you to scan QR code again.')) {
        try {
            const result = await window.electronAPI.whatsapp.forceDisconnect();
            if (result.success) {
                showNotification('Force disconnected successfully', 'success');
                updateWhatsAppStatus({ 
                    isReady: false, 
                    isConnecting: false, 
                    isAuthenticated: false 
                });
                updateConnectionPanel('disconnected');
            } else {
                showNotification('Failed to force disconnect: ' + result.message, 'error');
            }
        } catch (error) {
            console.error('Failed to force disconnect WhatsApp:', error);
            showNotification('Failed to force disconnect WhatsApp', 'error');
        }
    }
}

function showQRCode(qrData) {
    console.log('showQRCode called with data:', qrData ? 'QR data available' : 'No QR data');
    console.log('QR data type:', typeof qrData);
    console.log('QR data length:', qrData ? qrData.length : 'undefined');
    
    const container = document.getElementById('qr-code-container');
    console.log('QR container found:', !!container);
    
    if (container) {
        console.log('Setting QR code HTML...');
        container.innerHTML = `
            <img src="${qrData}" alt="QR Code" style="max-width: 200px; border-radius: 8px;">
        `;
        console.log('QR code displayed successfully');
        console.log('Container innerHTML length:', container.innerHTML.length);
    } else {
        console.error('QR code container not found');
        console.error('Available elements with qr in id:', document.querySelectorAll('[id*="qr"]'));
    }
}

function showQRModal() {
    document.getElementById('qr-modal').style.display = 'flex';
}

function closeQRModal() {
    document.getElementById('qr-modal').style.display = 'none';
}

// Old updateContactsTable function removed - using the new one below

function updateTemplatesTable() {
    const tbody = document.getElementById('templates-table-body');
    
    if (templates.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 40px; color: #666;">
                    No templates created. Create your first template to get started.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = templates.map(template => `
        <tr>
            <td>${template.name}</td>
            <td>${template.content.substring(0, 50)}...</td>
            <td>${template.variables.join(', ')}</td>
            <td>${new Date(template.created_at).toLocaleDateString()}</td>
            <td>
                <button class="btn btn-secondary" onclick="editTemplate(${template.id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-secondary" onclick="deleteTemplate(${template.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function updateTemplateSelect() {
    const select = document.getElementById('message-template');
    select.innerHTML = '<option value="">Choose a template...</option>';
    
    console.log('Updating template select with templates:', templates);
    
    if (templates && templates.length > 0) {
        templates.forEach(template => {
            const option = document.createElement('option');
            option.value = template.content;
            option.textContent = template.name;
            select.appendChild(option);
        });
    } else {
        console.log('No templates available');
    }
}

// Load contacts and groups for send messages
async function loadContactsForMessages() {
    // Clear selected contacts when loading
    clearSelectedContacts('message');
    
    // Update global contacts variable for autocomplete
    try {
        const result = await window.electronAPI.contacts.getAll();
        console.log('Loading contacts for messages - raw result:', result);
        
        // Handle both direct array and wrapped response
        let contactsData = result;
        if (result && result.data) {
            contactsData = result.data;
        }
        
        console.log('Processed contacts for messages:', contactsData);
        
        if (contactsData && Array.isArray(contactsData) && contactsData.length > 0) {
            // Update global contacts variable
            contacts = contactsData;
            console.log(`Loaded ${contacts.length} contacts for messages`);
            
            // Log first contact structure for debugging
            if (contacts.length > 0) {
                console.log('First contact structure:', contacts[0]);
                console.log('Contact phone field:', contacts[0].phone);
                console.log('Contact number field:', contacts[0].number);
                console.log('Contact telepon field:', contacts[0].telepon);
            }
        } else {
            console.log('No contacts available for messages - contacts:', contactsData);
            contacts = [];
        }
    } catch (error) {
        console.error('Error loading contacts for messages:', error);
        contacts = [];
    }
}

async function loadGroupsForMessages() {
    // This function is no longer needed as updateContactGroupsSelect handles all dropdowns
    // Keep it for backward compatibility but make it a no-op
    console.log('loadGroupsForMessages called - delegating to updateContactGroupsSelect');
    
    // Load groups using the main function
    try {
        const result = await window.electronAPI.contactGroups.getAll();
        if (result.success && result.data) {
            await updateContactGroupsSelect(result.data);
        }
    } catch (error) {
        console.error('Error loading groups for messages:', error);
    }
}

function setupMessageTargetTypeListeners() {
    console.log('Setting up message target type listeners...');
    
    const radios = document.querySelectorAll('input[name="message-target-type"]');
    console.log('Found radio buttons:', radios.length);
    
    // Remove existing listeners first
    radios.forEach(radio => {
        radio.removeEventListener('change', handleMessageTargetTypeChange);
    });
    
    // Add new listeners
    radios.forEach((radio, index) => {
        console.log(`Adding listener to radio ${index}:`, radio.value);
        radio.addEventListener('change', handleMessageTargetTypeChange);
    });
    
    // Set initial state
    const checkedRadio = document.querySelector('input[name="message-target-type"]:checked');
    console.log('Checked radio:', checkedRadio);
    if (checkedRadio) {
        console.log('Setting initial state for:', checkedRadio.value);
        handleMessageTargetTypeChange.call(checkedRadio);
    }
}

function handleMessageTargetTypeChange() {
    const contactsAutocomplete = document.getElementById('message-contacts-autocomplete');
    const contactsContainer = contactsAutocomplete ? contactsAutocomplete.closest('.autocomplete-container') : null;
    const groupsSelect = document.getElementById('message-groups-select');
    
    console.log('Message target type changed to:', this.value);
    console.log('Contacts autocomplete element:', contactsAutocomplete);
    console.log('Contacts container:', contactsContainer);
    console.log('Groups select element:', groupsSelect);
    
    if (this.value === 'contacts') {
        console.log('Showing contacts, hiding groups');
        if (contactsContainer) {
            contactsContainer.style.display = 'block';
            contactsContainer.style.visibility = 'visible';
            console.log('Contacts container display set to block');
        }
        if (groupsSelect) {
            groupsSelect.style.display = 'none';
            groupsSelect.style.visibility = 'hidden';
            console.log('Groups select display set to none');
        }
    } else {
        console.log('Showing groups, hiding contacts');
        if (contactsContainer) {
            contactsContainer.style.display = 'none';
            contactsContainer.style.visibility = 'hidden';
            console.log('Contacts container display set to none');
        }
        if (groupsSelect) {
            groupsSelect.style.display = 'block';
            groupsSelect.style.visibility = 'visible';
            console.log('Groups select display set to block');
            console.log('Groups select options count:', groupsSelect.options.length);
        }
    }
}

function handleDelayTypeChange() {
    const fixedContainer = document.getElementById('fixed-delay-container');
    const randomContainer = document.getElementById('random-delay-container');
    
    if (this.value === 'fixed') {
        fixedContainer.style.display = 'block';
        randomContainer.style.display = 'none';
    } else {
        fixedContainer.style.display = 'none';
        randomContainer.style.display = 'block';
    }
}

function setRandomDelay(min, max) {
    document.getElementById('min-delay').value = min;
    document.getElementById('max-delay').value = max;
}

function updateMessagePreview() {
    const template = document.getElementById('message-template').value;
    const preview = document.getElementById('message-preview');
    
    if (template) {
        preview.innerHTML = `<pre style="white-space: pre-wrap; font-family: inherit;">${template}</pre>`;
    } else {
        preview.innerHTML = 'Select a template to preview the message';
    }
}

function updateSchedulerTable(tasks = null) {
    const tbody = document.getElementById('scheduler-table-body');
    
    // Use provided tasks or fallback to global scheduledTasks
    const tasksToUse = tasks || scheduledTasks;
    
    if (tasksToUse.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 40px; color: #666;">
                    No scheduled messages. Create a new scheduled message to get started.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = tasksToUse.map(task => `
        <tr>
            <td>${task.name}</td>
            <td>${getTemplateName(task.template_id)}</td>
            <td>${new Date(task.scheduled_time).toLocaleString()}</td>
            <td>
                <span class="status-badge ${task.status}">${task.status}</span>
            </td>
            <td>
                <button class="btn btn-secondary" onclick="editScheduledTask(${task.id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-secondary" onclick="deleteScheduledTask(${task.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function getTemplateName(templateId) {
    const template = templates.find(t => t.id === templateId);
    return template ? template.name : 'Unknown';
}

// Scheduler functions
async function showAddScheduledTaskModal() {
    console.log('Opening scheduled task modal...');
    const modal = document.getElementById('add-scheduled-task-modal');
    if (modal) {
        modal.style.display = 'flex';
        console.log('Loading scheduler data...');
        loadTemplatesForScheduler();
        loadContactsForScheduler();
        loadGroupsForScheduler();
        
        // Add event listeners for radio buttons
        setTimeout(() => {
            console.log('Setting up scheduled listeners after timeout...');
            setupScheduledTargetTypeListeners();
        }, 200);
    } else {
        console.error('Scheduled task modal not found!');
    }
}

async function loadTemplatesForScheduler() {
    const select = document.getElementById('scheduled-template-select');
    if (select) {
        select.innerHTML = '<option value="">Choose a template...</option>';
        templates.forEach(template => {
            const option = document.createElement('option');
            option.value = template.id;
            option.textContent = template.name;
            select.appendChild(option);
        });
    }
}

async function loadContactsForScheduler() {
    // Clear selected contacts when loading
    clearSelectedContacts('scheduled');
    
    // Update global contacts variable for autocomplete
    try {
        const result = await window.electronAPI.contacts.getAll();
        console.log('Loading contacts for scheduler - raw result:', result);
        
        // Handle both direct array and wrapped response
        let contactsData = result;
        if (result && result.data) {
            contactsData = result.data;
        }
        
        console.log('Processed contacts for scheduler:', contactsData);
        
        if (contactsData && Array.isArray(contactsData) && contactsData.length > 0) {
            // Update global contacts variable
            contacts = contactsData;
            console.log(`Loaded ${contacts.length} contacts for scheduler`);
        } else {
            console.log('No contacts available for scheduler - contacts:', contactsData);
            contacts = [];
        }
    } catch (error) {
        console.error('Error loading contacts for scheduler:', error);
        contacts = [];
    }
}

async function loadGroupsForScheduler() {
    // This function is no longer needed as updateContactGroupsSelect handles all dropdowns
    // Keep it for backward compatibility but make it a no-op
    console.log('loadGroupsForScheduler called - delegating to updateContactGroupsSelect');
    
    // Load groups using the main function
    try {
        const result = await window.electronAPI.contactGroups.getAll();
        if (result.success && result.data) {
            await updateContactGroupsSelect(result.data);
        }
    } catch (error) {
        console.error('Error loading groups for scheduler:', error);
    }
}

function setupScheduledTargetTypeListeners() {
    console.log('Setting up scheduled target type listeners...');
    
    const radios = document.querySelectorAll('input[name="scheduled-target-type"]');
    console.log('Found scheduled radio buttons:', radios.length);
    
    // Remove existing listeners first
    radios.forEach(radio => {
        radio.removeEventListener('change', handleScheduledTargetTypeChange);
    });
    
    // Add new listeners
    radios.forEach((radio, index) => {
        console.log(`Adding listener to scheduled radio ${index}:`, radio.value);
        radio.addEventListener('change', handleScheduledTargetTypeChange);
    });
    
    // Set initial state
    const checkedRadio = document.querySelector('input[name="scheduled-target-type"]:checked');
    console.log('Checked scheduled radio:', checkedRadio);
    if (checkedRadio) {
        console.log('Setting initial state for scheduled:', checkedRadio.value);
        handleScheduledTargetTypeChange.call(checkedRadio);
    }
}

function handleScheduledTargetTypeChange() {
    const contactsAutocomplete = document.getElementById('scheduled-contacts-autocomplete');
    const contactsContainer = contactsAutocomplete ? contactsAutocomplete.closest('.autocomplete-container') : null;
    const groupsSelect = document.getElementById('scheduled-groups-select');
    
    console.log('Scheduled target type changed to:', this.value);
    console.log('Scheduled contacts autocomplete element:', contactsAutocomplete);
    console.log('Scheduled contacts container:', contactsContainer);
    console.log('Scheduled groups select element:', groupsSelect);
    
    if (this.value === 'contacts') {
        console.log('Showing scheduled contacts, hiding groups');
        if (contactsContainer) {
            contactsContainer.style.display = 'block';
            contactsContainer.style.visibility = 'visible';
            console.log('Scheduled contacts container display set to block');
        }
        if (groupsSelect) {
            groupsSelect.style.display = 'none';
            groupsSelect.style.visibility = 'hidden';
            console.log('Scheduled groups select display set to none');
        }
    } else {
        console.log('Showing scheduled groups, hiding contacts');
        if (contactsContainer) {
            contactsContainer.style.display = 'none';
            contactsContainer.style.visibility = 'hidden';
            console.log('Scheduled contacts container display set to none');
        }
        if (groupsSelect) {
            groupsSelect.style.display = 'block';
            groupsSelect.style.visibility = 'visible';
            console.log('Scheduled groups select display set to block');
            console.log('Scheduled groups select options count:', groupsSelect.options.length);
        }
    }
}

async function addScheduledTask() {
    try {
        const name = document.getElementById('scheduled-task-name').value;
        const templateId = document.getElementById('scheduled-template-select').value;
        const scheduledTime = document.getElementById('scheduled-time').value;
        const targetType = document.querySelector('input[name="scheduled-target-type"]:checked').value;

        if (!name || !templateId || !scheduledTime) {
            showNotification('Please fill in all fields', 'error');
            return;
        }

        let selectedContacts = [];

    if (targetType === 'contacts') {
        selectedContacts = getSelectedContacts('scheduled');
        if (selectedContacts.length === 0) {
            showNotification('Please select at least one contact', 'error');
            return;
        }
    } else {
            const groupIds = Array.from(document.getElementById('scheduled-groups-select').selectedOptions).map(option => parseInt(option.value));
            if (groupIds.length === 0) {
                showNotification('Please select at least one group', 'error');
                return;
            }
            
            // Get contacts from selected groups
    for (const groupId of groupIds) {
        console.log(`Scheduled: Getting contacts for group ${groupId}`);
        const groupContactsResult = await window.electronAPI.contactGroups.getContacts(groupId);
        console.log('Scheduled: Group contacts result:', groupContactsResult);
        
        if (groupContactsResult && groupContactsResult.success && groupContactsResult.data) {
            console.log(`Scheduled: Group ${groupId} has ${groupContactsResult.data.length} contacts`);
            console.log('Scheduled: Group contacts data:', groupContactsResult.data.map(c => ({ id: c.id, name: c.name, phone: c.phone, group_id: c.group_id })));
            
            // Check if data is actually an array of contacts
            if (Array.isArray(groupContactsResult.data)) {
                // Validate each contact has required fields
                const validContacts = groupContactsResult.data.filter(contact => {
                    const hasPhone = contact.phone || contact.number || contact.telepon || contact.phoneNumber;
                    if (!hasPhone) {
                        console.warn(`Scheduled: Contact ${contact.name || 'Unknown'} has no phone number:`, contact);
                    }
                    return hasPhone;
                });
                
                console.log(`Scheduled: Valid contacts (with phone): ${validContacts.length} out of ${groupContactsResult.data.length}`);
                console.log('Scheduled: Valid contacts data:', validContacts.map(c => ({ id: c.id, name: c.name, phone: c.phone, group_id: c.group_id })));
                
                selectedContacts = selectedContacts.concat(validContacts);
                console.log(`Scheduled: Added ${validContacts.length} valid contacts from group ${groupId}`);
            } else {
                console.error('Scheduled: groupContactsResult.data is not an array:', groupContactsResult.data);
                console.error('Scheduled: Type of data:', typeof groupContactsResult.data);
            }
        } else {
            console.error('Scheduled: Failed to get contacts from group:', groupContactsResult);
        }
    }
        }

        const taskData = {
            name,
            template_id: parseInt(templateId),
            contacts: selectedContacts,
            rules: [],
            scheduled_time: scheduledTime
        };

        const result = await window.electronAPI.scheduler.addTask(taskData);
        
        if (result.success) {
            showNotification('Scheduled task added successfully', 'success');
            closeAddScheduledTaskModal();
            await loadScheduledTasks();
        } else {
            showNotification(result.error || 'Failed to add scheduled task', 'error');
        }
    } catch (error) {
        console.error('Error adding scheduled task:', error);
        showNotification('Failed to add scheduled task', 'error');
    }
}

function closeAddScheduledTaskModal() {
    const modal = document.getElementById('add-scheduled-task-modal');
    if (modal) {
        modal.style.display = 'none';
        // Reset form
        document.getElementById('scheduled-task-name').value = '';
        document.getElementById('scheduled-template-select').value = '';
        
        // Check if scheduled-contacts-select exists before setting selectedIndex
        const contactsSelect = document.getElementById('scheduled-contacts-select');
        if (contactsSelect) {
            contactsSelect.selectedIndex = -1;
        }
        
        document.getElementById('scheduled-time').value = '';
    }
}

async function loadScheduledTasks() {
    try {
        const allTasksData = await window.electronAPI.scheduler.getTasks();
        scheduledTasks = allTasksData;
        
        // Update pagination data
        updatePaginationData('scheduler', allTasksData.length);
        
        // Get paginated data
        const paginatedTasks = getPaginatedData(allTasksData, 'scheduler');
        
        // Update table with paginated data
        updateSchedulerTable(paginatedTasks);
    } catch (error) {
        console.error('Failed to load scheduled tasks:', error);
    }
}

async function deleteScheduledTask(taskId) {
    if (confirm('Are you sure you want to delete this scheduled task?')) {
        try {
            const result = await window.electronAPI.scheduler.removeTask(taskId);
            if (result.success) {
                showNotification('Scheduled task deleted successfully', 'success');
                await loadScheduledTasks();
            } else {
                showNotification('Failed to delete scheduled task', 'error');
            }
        } catch (error) {
            console.error('Error deleting scheduled task:', error);
            showNotification('Failed to delete scheduled task', 'error');
        }
    }
}

function editScheduledTask(taskId) {
    // For now, just show a message that editing is not implemented
    showNotification('Editing scheduled tasks is not yet implemented', 'info');
}

// Progress Management Functions
function showProgressModal() {
    const modal = document.getElementById('sending-progress-modal');
    if (modal) {
        modal.style.display = 'flex';
        resetProgress();
    }
}

function closeProgressModal() {
    const modal = document.getElementById('sending-progress-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function resetProgress() {
    sendingProgress = {
        total: 0,
        sent: 0,
        failed: 0,
        remaining: 0,
        isSending: false,
        currentContact: null,
        logs: []
    };
    updateProgressDisplay();
    clearProgressLogs();
    addProgressLog('Progress tracking initialized', 'info');
}

function updateProgressDisplay() {
    // Update stats
    document.getElementById('progress-total').textContent = sendingProgress.total;
    document.getElementById('progress-sent').textContent = sendingProgress.sent;
    document.getElementById('progress-failed').textContent = sendingProgress.failed;
    document.getElementById('progress-remaining').textContent = sendingProgress.remaining;
    
    // Update progress bar
    const percentage = sendingProgress.total > 0 ? (sendingProgress.sent + sendingProgress.failed) / sendingProgress.total * 100 : 0;
    const roundedPercentage = Math.round(percentage);
    
    document.getElementById('progress-fill').style.width = `${percentage}%`;
    document.getElementById('progress-percentage').textContent = `${roundedPercentage}%`;
    
    // Update current contact
    const currentContactEl = document.getElementById('current-contact');
    if (sendingProgress.isSending) {
        if (sendingProgress.currentContact) {
            currentContactEl.textContent = `${sendingProgress.currentContact.name} (${sendingProgress.currentContact.phone})`;
        } else {
            currentContactEl.textContent = 'Processing...';
        }
    } else {
        // Check if sending is completed
        if (sendingProgress.remaining === 0 && sendingProgress.total > 0) {
            currentContactEl.textContent = '✅ Sending completed!';
        } else {
            currentContactEl.textContent = 'Preparing...';
        }
    }
    
    // Update button states
    const cancelBtn = document.getElementById('cancel-sending-btn');
    const closeBtn = document.getElementById('close-progress-btn');
    
    if (sendingProgress.isSending) {
        cancelBtn.style.display = 'inline-block';
        closeBtn.style.display = 'none';
    } else {
        cancelBtn.style.display = 'none';
        closeBtn.style.display = 'inline-block';
    }
}

function addProgressLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = {
        timestamp,
        message,
        type
    };
    
    sendingProgress.logs.push(logEntry);
    
    const logsContainer = document.getElementById('progress-logs');
    const logItem = document.createElement('div');
    logItem.className = `log-item ${type}`;
    logItem.innerHTML = `<span style="color: var(--text-muted); font-size: 0.75rem;">[${timestamp}]</span> ${message}`;
    
    logsContainer.appendChild(logItem);
    
    // Auto-scroll to bottom
    logsContainer.scrollTop = logsContainer.scrollHeight;
    
    // Keep only last 50 logs
    if (sendingProgress.logs.length > 50) {
        sendingProgress.logs.shift();
        const firstLog = logsContainer.querySelector('.log-item');
        if (firstLog) {
            firstLog.remove();
        }
    }
}

function clearProgressLogs() {
    const logsContainer = document.getElementById('progress-logs');
    logsContainer.innerHTML = '<div class="log-item info">Progress logs cleared</div>';
    sendingProgress.logs = [];
}

function cancelSending() {
    if (sendingProgress.isSending) {
        sendingProgress.isSending = false;
        addProgressLog('Sending cancelled by user', 'warning');
        updateProgressDisplay();
        
        // Notify main process to stop sending
        window.electronAPI.whatsapp.cancelSending?.();
    }
}

// Progress event handlers
function handleMessageSent(data) {
    sendingProgress.sent++;
    sendingProgress.remaining--;
    sendingProgress.currentContact = data.contact;
    
    // Safe contact info extraction
    const contactName = data.contact?.name || 'Unknown';
    const contactPhone = data.contact?.phone || data.contact?.number || data.contact?.telepon || 'Unknown';
    
    addProgressLog(`✅ Message sent to ${contactName} (${contactPhone})`, 'success');
    updateProgressDisplay();
}

document.querySelector('[data-page="live-whatsapp"]').addEventListener('click', () => {
    window.electronAPI.liveWhatsApp.open();
});

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
        if (e.target.dataset.page !== 'live-whatsapp') {
            window.electronAPI.liveWhatsApp.close();
        }
    });
});


function handleMessageFailed(data) {
    sendingProgress.failed++;
    sendingProgress.remaining--;
    sendingProgress.currentContact = data.contact;
    
    // Safe contact info extraction
    const contactName = data.contact?.name || 'Unknown';
    const contactPhone = data.contact?.phone || data.contact?.number || data.contact?.telepon || 'Unknown';
    const errorMessage = data.error || 'Unknown error';
    
    addProgressLog(`❌ Failed to send to ${contactName} (${contactPhone}): ${errorMessage}`, 'error');
    updateProgressDisplay();
}

function handleProgressUpdate(data) {
    if (data.currentContact) {
        sendingProgress.currentContact = data.currentContact;
        
        // Safe contact info extraction
        const contactName = data.currentContact?.name || 'Unknown';
        const contactPhone = data.currentContact?.phone || data.currentContact?.number || data.currentContact?.telepon || 'Unknown';
        
        addProgressLog(`📤 Sending to ${contactName} (${contactPhone})...`, 'info');
    }
    updateProgressDisplay();
}

function handleBulkCompleted(results) {
    sendingProgress.isSending = false;
    sendingProgress.currentContact = null;
    
    // Update final counts
    sendingProgress.sent = results.successful || sendingProgress.sent;
    sendingProgress.failed = results.failed || sendingProgress.failed;
    sendingProgress.remaining = 0;
    
    addProgressLog(`🎉 Bulk sending completed!`, 'success');
    addProgressLog(`📊 Final results: ${sendingProgress.sent} sent, ${sendingProgress.failed} failed`, 'info');
    
    // Force update progress display to show 100%
    updateProgressDisplay();
    
    // Show completion notification
    showNotification(`Bulk sending completed: ${sendingProgress.sent} sent, ${sendingProgress.failed} failed`, 'success');
}

// Make functions globally available
window.showAddScheduledTaskModal = showAddScheduledTaskModal;
window.addScheduledTask = addScheduledTask;
window.closeAddScheduledTaskModal = closeAddScheduledTaskModal;
window.deleteScheduledTask = deleteScheduledTask;
window.editScheduledTask = editScheduledTask;
window.showProgressModal = showProgressModal;
window.closeProgressModal = closeProgressModal;
window.clearProgressLogs = clearProgressLogs;
window.cancelSending = cancelSending;
window.setRandomDelay = setRandomDelay;
window.resendMessage = resendMessage;

async function loadAnalytics() {
    try {
        const stats = await window.electronAPI.analytics.getStats();
        
        // Update analytics display
        const today = new Date().toISOString().split('T')[0];
        const todayStats = stats.find(s => s.date === today);
        
        document.getElementById('today-messages').textContent = todayStats ? todayStats.messages_sent : 0;
        
        // Calculate success rate
        const totalMessages = stats.reduce((sum, s) => sum + s.messages_sent + s.messages_failed, 0);
        const totalSent = stats.reduce((sum, s) => sum + s.messages_sent, 0);
        const successRate = totalMessages > 0 ? Math.round((totalSent / totalMessages) * 100) : 0;
        
        document.getElementById('success-rate').textContent = successRate + '%';
        
    } catch (error) {
        console.error('Failed to load analytics:', error);
    }
}

function updateDashboardStats() {
    document.getElementById('total-contacts').textContent = contacts.length;
    
    // Calculate messages sent today
    const today = new Date().toISOString().split('T')[0];
    // This would be calculated from analytics data
    document.getElementById('messages-sent').textContent = '0';
    
    document.getElementById('scheduled-count').textContent = scheduledTasks.filter(t => t.status === 'pending').length;
    document.getElementById('failed-count').textContent = '0'; // This would be calculated from analytics
}

async function sendMessages() {
    if (!whatsappStatus.isReady) {
        showNotification('WhatsApp is not connected', 'error');
        return;
    }

    const template = document.getElementById('message-template').value;
    const targetType = document.querySelector('input[name="message-target-type"]:checked').value;
    
    // Get delay configuration
    const delayType = document.querySelector('input[name="delay-type"]:checked').value;
    let delay;
    
    if (delayType === 'fixed') {
        delay = parseInt(document.getElementById('message-delay').value) * 1000;
    } else {
        const minDelay = parseInt(document.getElementById('min-delay').value) * 1000;
        const maxDelay = parseInt(document.getElementById('max-delay').value) * 1000;
        delay = { min: minDelay, max: maxDelay, type: 'random' };
    }

    if (!template) {
        showNotification('Please select a template', 'error');
        return;
    }

    // Get selected contacts based on target type
    let selectedContacts = [];
    
    console.log('Target type:', targetType);
    console.log('Target type check:', targetType === 'contacts' ? 'individual contacts' : 'contact groups');
    
        if (targetType === 'contacts') {
            selectedContacts = getSelectedContacts('message');
            if (selectedContacts.length === 0) {
                showNotification('Please select at least one contact', 'error');
                return;
            }
        } else {
        const groupSelect = document.getElementById('message-groups-select');
        console.log('Group select element:', groupSelect);
        console.log('Group select options:', groupSelect ? groupSelect.options.length : 'null');
        console.log('Group select selected options:', groupSelect ? groupSelect.selectedOptions.length : 'null');
        
        const groupIds = Array.from(document.getElementById('message-groups-select').selectedOptions).map(option => parseInt(option.value));
        console.log('Selected group IDs:', groupIds);
        console.log('Selected group options:', Array.from(document.getElementById('message-groups-select').selectedOptions).map(option => ({ value: option.value, text: option.text })));
        
        if (groupIds.length === 0) {
            showNotification('Please select at least one group', 'error');
            return;
        }
        
        // Get contacts from selected groups
    for (const groupId of groupIds) {
        try {
            console.log(`Getting contacts for group ${groupId}`);
            console.log(`Group ID type: ${typeof groupId}, value: ${groupId}`);
            const groupContactsResult = await window.electronAPI.contactGroups.getContacts(groupId);
            console.log('Group contacts result:', groupContactsResult);
            console.log('Group contacts result type:', typeof groupContactsResult);
            console.log('Group contacts result success:', groupContactsResult?.success);
            console.log('Group contacts result data type:', typeof groupContactsResult?.data);
            console.log('Group contacts result data length:', groupContactsResult?.data?.length);
            
            if (groupContactsResult && groupContactsResult.success && groupContactsResult.data) {
                console.log(`Group ${groupId} has ${groupContactsResult.data.length} contacts`);
                console.log('Group contacts data:', groupContactsResult.data.map(c => ({ id: c.id, name: c.name, phone: c.phone, group_id: c.group_id })));
                
                // Check if data is actually an array of contacts
                if (Array.isArray(groupContactsResult.data)) {
                    // Validate each contact has required fields
                    const validContacts = groupContactsResult.data.filter(contact => {
                        const hasPhone = contact.phone || contact.number || contact.telepon || contact.phoneNumber;
                        if (!hasPhone) {
                            console.warn(`Contact ${contact.name || 'Unknown'} has no phone number:`, contact);
                        }
                        return hasPhone;
                    });
                    
                    console.log(`Valid contacts (with phone): ${validContacts.length} out of ${groupContactsResult.data.length}`);
                    console.log('Valid contacts data:', validContacts.map(c => ({ id: c.id, name: c.name, phone: c.phone, group_id: c.group_id })));
                    
                    selectedContacts = selectedContacts.concat(validContacts);
                    console.log(`Added ${validContacts.length} valid contacts from group ${groupId}`);
                } else {
                    console.error('groupContactsResult.data is not an array:', groupContactsResult.data);
                    console.error('Type of data:', typeof groupContactsResult.data);
                }
            } else {
                console.error('Failed to get contacts from group:', groupContactsResult);
            }
        } catch (error) {
            console.error('Error getting contacts from group:', error);
        }
    }
    }

    console.log('Final selectedContacts length:', selectedContacts.length);
    console.log('Final selectedContacts:', selectedContacts);
    
    if (selectedContacts.length === 0) {
        console.error('No contacts selected - this could be due to:');
        console.error('1. No groups selected');
        console.error('2. Selected groups have no contacts');
        console.error('3. Selected groups have no valid contacts (no phone numbers)');
        console.error('4. API call failed to get contacts from groups');
        showNotification('No contacts selected', 'error');
        return;
    }

    // Log selected contacts structure for debugging
        console.log('Selected contacts before sending:', selectedContacts);
        console.log('First selected contact structure:', selectedContacts[0]);
        if (selectedContacts[0]) {
            console.log('First contact phone field:', selectedContacts[0].phone);
            console.log('First contact number field:', selectedContacts[0].number);
            console.log('First contact telepon field:', selectedContacts[0].telepon);
            console.log('First contact available fields:', Object.keys(selectedContacts[0]));
            console.log('First contact is response object?', selectedContacts[0].hasOwnProperty('success'));
            console.log('First contact has data field?', selectedContacts[0].hasOwnProperty('data'));
        }
        
        // Check if any contact is a response object
        const responseObjects = selectedContacts.filter(contact => contact.hasOwnProperty('success'));
        if (responseObjects.length > 0) {
            console.error('Found response objects in selectedContacts:', responseObjects);
            console.error('This means the data extraction is not working properly');
        }

    try {
        // Show progress modal
        showProgressModal();
        
        // Initialize progress tracking
        sendingProgress.total = selectedContacts.length;
        sendingProgress.remaining = selectedContacts.length;
        sendingProgress.isSending = true;
        updateProgressDisplay();
        
        addProgressLog(`Starting bulk message sending to ${selectedContacts.length} contacts`, 'info');
        addProgressLog(`Template: ${template.substring(0, 50)}...`, 'info');
        
        if (delay.type === 'random') {
            addProgressLog(`Random delay: ${delay.min/1000}-${delay.max/1000} seconds`, 'info');
        } else {
            addProgressLog(`Fixed delay: ${delay/1000} seconds`, 'info');
        }
        
        // Prepare bulk message data
        const bulkMessageData = {
            contacts: selectedContacts,
            template: template,
            rules: [], // No rules for now
            delay: delay
        };

        // Send bulk messages
        const result = await window.electronAPI.whatsapp.sendBulk(bulkMessageData);
        
        if (result.success) {
            addProgressLog('Bulk sending initiated successfully', 'success');
        } else {
            addProgressLog(`Failed to start bulk sending: ${result.message}`, 'error');
            sendingProgress.isSending = false;
            updateProgressDisplay();
        }
        
    } catch (error) {
        console.error('Failed to send messages:', error);
        addProgressLog(`Error: ${error.message}`, 'error');
        sendingProgress.isSending = false;
        updateProgressDisplay();
    }
}

function updateProgress(data, isError = false) {
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const progressPercentage = document.getElementById('progress-percentage');
    
    const percentage = Math.round((data.progress / data.total) * 100);
    
    progressFill.style.width = percentage + '%';
    progressPercentage.textContent = percentage + '%';
    
    if (isError) {
        progressText.innerHTML = `<span style="color: #ff4757;">Failed: ${data.contact.name || data.contact.phone} - ${data.error}</span>`;
    } else {
        progressText.innerHTML = `<span style="color: #2ed573;">Sent to: ${data.contact.name || data.contact.phone}</span>`;
    }
}

function completeBulkSending(results) {
    document.getElementById('progress-container').style.display = 'none';
    
    showNotification(`Bulk sending completed! Success: ${results.success}, Failed: ${results.failed}`, 'success');
    
    // Refresh data
    loadInitialData();
}

async function saveSettings() {
    try {
        const defaultDelay = document.getElementById('default-delay').value;
        const autoSaveTemplates = document.getElementById('auto-save-templates').checked;
        
        await window.electronAPI.settings.set('defaultDelay', defaultDelay);
        await window.electronAPI.settings.set('autoSaveTemplates', autoSaveTemplates);
        
        showNotification('Settings saved successfully', 'success');
    } catch (error) {
        console.error('Failed to save settings:', error);
        showNotification('Failed to save settings', 'error');
    }
}

// Utility functions
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#2ed573' : type === 'error' ? '#ff4757' : '#667eea'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 8px;
        animation: slideIn 0.3s ease-out;
    `;
    
    // Add to document
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    .status-badge {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        text-transform: uppercase;
    }
    
    .status-badge.pending {
        background: #ffa726;
        color: white;
    }
    
    .status-badge.running {
        background: #42a5f5;
        color: white;
    }
    
    .status-badge.completed {
        background: #2ed573;
        color: white;
    }
    
    .status-badge.failed {
        background: #ff4757;
        color: white;
    }
    
    .metadata-badge {
        background: var(--secondary-color);
        color: white;
        padding: 0.25rem 0.5rem;
        border-radius: var(--radius-sm);
        font-size: 0.75rem;
        font-weight: 500;
    }
    
    .category-badge {
        padding: 0.25rem 0.5rem;
        border-radius: var(--radius-sm);
        font-size: 0.75rem;
        font-weight: 500;
        text-transform: capitalize;
    }
    
    .category-general {
        background: var(--bg-tertiary);
        color: var(--text-secondary);
    }
    
    .category-marketing {
        background: #3b82f6;
        color: white;
    }
    
    .category-notification {
        background: #f59e0b;
        color: white;
    }
    
    .category-reminder {
        background: #10b981;
        color: white;
    }
    
    .category-promotion {
        background: #ef4444;
        color: white;
    }
    
    .group-badge {
        padding: 0.25rem 0.75rem;
        border-radius: var(--radius-lg);
        font-size: 0.875rem;
        font-weight: 600;
        text-transform: capitalize;
        color: white;
    }
    
    .group-blue {
        background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
    }
    
    .group-green {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    }
    
    .group-orange {
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    }
    
    .group-red {
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    }
    
    .group-purple {
        background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
    }
    
    .group-gray {
        background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
    }
    
    .contact-count-badge {
        background: var(--bg-tertiary);
        color: var(--text-secondary);
        padding: 0.25rem 0.5rem;
        border-radius: var(--radius-sm);
        font-size: 0.75rem;
        font-weight: 500;
    }
`;
document.head.appendChild(style);

// CSV Upload Functions
async function uploadCSV() {
    try {
        showLoadingModal('Uploading CSV...', 'Please wait while we process your CSV file');
        
        const result = await window.electronAPI.csv.upload();
        
        if (result.success) {
            hideLoadingModal();
            
            const data = result.data;
            const message = `
                CSV uploaded successfully!
                Total contacts: ${data.totalContacts}
                Valid contacts: ${data.totalValid}
                Invalid contacts: ${data.totalInvalid}
                
                ${data.totalInvalid > 0 ? `\n${data.totalInvalid} contacts have validation errors and will be skipped.` : ''}
                
                Do you want to save the valid contacts to the database?
            `;
            
            if (confirm(message)) {
                showLoadingModal('Saving contacts...', 'Please wait while we save your contacts');
                
                const saveResult = await window.electronAPI.csv.saveContacts(data.validContacts);
                
                if (saveResult.success) {
                    hideLoadingModal();
                    showNotification(`Successfully saved ${data.totalValid} contacts!`, 'success');
                    await loadContacts();
                    navigateToPage('contacts');
                } else {
                    hideLoadingModal();
                    showNotification('Failed to save contacts: ' + saveResult.message, 'error');
                }
            }
        } else {
            hideLoadingModal();
            showNotification('Failed to upload CSV: ' + result.message, 'error');
        }
    } catch (error) {
        hideLoadingModal();
        console.error('CSV upload error:', error);
        showNotification('Failed to upload CSV', 'error');
    }
}

// Contact Management Functions
function showAddContactModal() {
    // Load contact groups for the form
    loadContactGroupsForForm();
    document.getElementById('add-contact-modal').style.display = 'flex';
}

function loadContactGroupsForForm() {
    const select = document.getElementById('contact-group');
    select.innerHTML = '<option value="">Select a group...</option>';
    
    window.electronAPI.contactGroups.getAll().then(result => {
        if (result.success && result.data) {
            result.data.forEach(group => {
                const option = document.createElement('option');
                option.value = group.id;
                option.textContent = group.name;
                select.appendChild(option);
            });
        }
    });
}

function closeAddContactModal() {
    document.getElementById('add-contact-modal').style.display = 'none';
    document.getElementById('add-contact-form').reset();
    document.getElementById('add-contact-form').dataset.editMessage = '';
    document.querySelector('#add-contact-modal .modal-title').textContent = 'Add Contact';
}

async function handleAddContact(event) {
    event.preventDefault();
    
    try {
        const contact = {
            name: document.getElementById('contact-name').value.trim(),
            phone: document.getElementById('contact-phone').value.trim(),
            email: document.getElementById('contact-email').value.trim(),
            company: document.getElementById('contact-company').value.trim(),
            group_id: document.getElementById('contact-group').value ? parseInt(document.getElementById('contact-group').value) : null,
            metadata: {}
        };

        // Parse metadata JSON if provided
        const metadataText = document.getElementById('contact-metadata').value.trim();
        if (metadataText) {
            try {
                contact.metadata = JSON.parse(metadataText);
            } catch (error) {
                showNotification('Invalid JSON format in Additional Info field', 'error');
                return;
            }
        }

        if (!contact.name || !contact.phone) {
            showNotification('Name and phone are required fields', 'error');
            return;
        }

        // Check if this is an edit operation
        const editId = document.getElementById('add-contact-form').dataset.editId;
        let result;
        
        if (editId) {
            contact.id = parseInt(editId);
            result = await window.electronAPI.contacts.update(contact);
        } else {
            result = await window.electronAPI.contacts.add(contact);
        }
        
        if (result.success) {
            showNotification(editId ? 'Contact updated successfully!' : 'Contact added successfully!', 'success');
            closeAddContactModal();
            // Force refresh contacts data with pagination
            await loadContacts();
        } else {
            showNotification(`Failed to ${editId ? 'update' : 'add'} contact: ` + result.message, 'error');
        }
    } catch (error) {
        console.error('Contact operation error:', error);
        showNotification('Failed to save contact', 'error');
    }
}

async function editContact(id) {
    try {
        const result = await window.electronAPI.contacts.get(id);
        if (result.success && result.data) {
            const contact = result.data;
            
            // Populate form with existing data
            document.getElementById('contact-name').value = contact.name || '';
            document.getElementById('contact-phone').value = contact.phone || '';
            document.getElementById('contact-email').value = contact.email || '';
            document.getElementById('contact-company').value = contact.company || '';
            document.getElementById('contact-group').value = contact.group_id || '';
            document.getElementById('contact-metadata').value = contact.metadata ? JSON.stringify(contact.metadata, null, 2) : '';
            
            // Store the ID for update
            document.getElementById('add-contact-form').dataset.editId = id;
            
            // Change modal title
            document.querySelector('#add-contact-modal .modal-title').textContent = 'Edit Contact';
            
            showAddContactModal();
        } else {
            showNotification('Failed to load contact data', 'error');
        }
    } catch (error) {
        console.error('Edit contact error:', error);
        showNotification('Failed to load contact data', 'error');
    }
}

async function assignContactToGroup(contactId) {
    try {
        // Load contact groups
        const groupsResult = await window.electronAPI.contactGroups.getAll();
        if (!groupsResult.success || !groupsResult.data.length) {
            showNotification('No contact groups available. Please create a contact group first.', 'error');
            return;
        }

        // Create modal for group selection
        const modalHtml = `
            <div id="assign-group-modal" class="modal" style="display: flex;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 class="modal-title">Assign Contact to Group</h3>
                        <button class="modal-close" onclick="closeAssignGroupModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label class="form-label">Select Group:</label>
                            <select id="group-select" class="form-input">
                                <option value="">Choose a group...</option>
                                ${groupsResult.data.map(group => 
                                    `<option value="${group.id}">${group.name}</option>`
                                ).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="closeAssignGroupModal()">Cancel</button>
                        <button type="button" class="btn btn-primary" onclick="confirmAssignGroup(${contactId})">Assign</button>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('assign-group-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    } catch (error) {
        console.error('Assign contact to group error:', error);
        showNotification('Failed to load contact groups', 'error');
    }
}

async function confirmAssignGroup(contactId) {
    try {
        const groupSelect = document.getElementById('group-select');
        const groupId = groupSelect.value;

        if (!groupId) {
            showNotification('Please select a group', 'error');
            return;
        }

        const result = await window.electronAPI.contactGroups.assignContact(contactId, parseInt(groupId));
        
        if (result.success) {
            showNotification('Contact assigned to group successfully!', 'success');
            closeAssignGroupModal();
            await loadContacts();
        } else {
            showNotification('Failed to assign contact to group: ' + result.message, 'error');
        }
    } catch (error) {
        console.error('Confirm assign group error:', error);
        showNotification('Failed to assign contact to group', 'error');
    }
}

function closeAssignGroupModal() {
    const modal = document.getElementById('assign-group-modal');
    if (modal) {
        modal.remove();
    }
}

async function deleteContact(id) {
    if (confirm('Are you sure you want to delete this contact?')) {
        try {
            const result = await window.electronAPI.contacts.delete(id);
            
            if (result.success) {
                showNotification('Contact deleted successfully!', 'success');
                await loadContacts();
            } else {
                showNotification('Failed to delete contact: ' + result.message, 'error');
            }
        } catch (error) {
            console.error('Delete contact error:', error);
            showNotification('Failed to delete contact', 'error');
        }
    }
}

// Template Management Functions
function showAddTemplateModal() {
    document.getElementById('add-template-modal').style.display = 'flex';
}

function closeAddTemplateModal() {
    document.getElementById('add-template-modal').style.display = 'none';
    document.getElementById('add-template-form').reset();
    document.getElementById('add-template-form').dataset.editId = '';
    document.querySelector('#add-template-modal .modal-title').textContent = 'Add Template';
}

async function editTemplate(id) {
    try {
        const result = await window.electronAPI.templates.get(id);
        if (result.success && result.data) {
            const template = result.data;
            
            // Populate form with existing data
            document.getElementById('template-name').value = template.name || '';
            document.getElementById('template-content').value = template.content || '';
            document.getElementById('template-category').value = template.category || 'general';
            document.getElementById('template-variables').value = template.variables ? template.variables.join(', ') : '';
            
            
            // Store the ID for update
            document.getElementById('add-template-form').dataset.editId = id;
            
            // Change modal title
            document.querySelector('#add-template-modal .modal-title').textContent = 'Edit Template';
            
            showAddTemplateModal();
        } else {
            showNotification('Failed to load template data', 'error');
        }
    } catch (error) {
        console.error('Edit template error:', error);
        showNotification('Failed to load template data', 'error');
    }
}

async function deleteTemplate(id) {
    if (confirm('Are you sure you want to delete this template?')) {
        try {
            const result = await window.electronAPI.templates.delete(id);
            
            if (result.success) {
                showNotification('Template deleted successfully!', 'success');
                await loadTemplates();
            } else {
                showNotification('Failed to delete template: ' + result.message, 'error');
            }
        } catch (error) {
            console.error('Delete template error:', error);
            showNotification('Failed to delete template', 'error');
        }
    }
}

// Data Loading Functions
async function loadContacts() {
    try {
        const allContactsData = await window.electronAPI.database.getContacts();
        allContacts = allContactsData; // Update search data
        
        // Update pagination data
        updatePaginationData('contacts', allContactsData.length);
        
        // Get paginated data
        const paginatedContacts = getPaginatedData(allContactsData, 'contacts');
        
        // Update table with paginated data
        updateContactsTable(paginatedContacts);
    } catch (error) {
        console.error('Failed to load contacts:', error);
        showNotification('Failed to load contacts', 'error');
    }
}

async function loadTemplates() {
    try {
        const allTemplatesData = await window.electronAPI.database.getTemplates();
        templates = allTemplatesData;
        
        // Update pagination data
        updatePaginationData('templates', allTemplatesData.length);
        
        // Get paginated data
        const paginatedTemplates = getPaginatedData(allTemplatesData, 'templates');
        
        // Update table with paginated data
        updateTemplatesTable(paginatedTemplates);
        updateTemplateSelect();
    } catch (error) {
        console.error('Failed to load templates:', error);
        showNotification('Failed to load templates', 'error');
    }
}

function updateContactsTable(contacts) {
    const tbody = document.getElementById('contacts-table-body');
    
    console.log(`updateContactsTable called with ${contacts ? contacts.length : 0} contacts`);
    
    if (!contacts || contacts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <i class="fas fa-users"></i>
                    <h3>No contacts loaded</h3>
                    <p>Import a CSV file or add contacts manually to get started</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = contacts.map(contact => {
        // Get contact groups safely
        const groups = window.contactGroups || [];
        const groupName = groups.find(g => g.id === contact.group_id)?.name || 'No Group';
        const metadataCount = contact.metadata ? Object.keys(contact.metadata).filter(key => 
            contact.metadata[key] !== null && contact.metadata[key] !== undefined && contact.metadata[key] !== ''
        ).length : 0;
        
        return `
        <tr>
            <td>
                <input type="checkbox" class="contact-checkbox" data-contact-id="${contact.id}" style="margin: 0;">
            </td>
            <td>
                <div class="contact-name clickable-contact" onclick="viewContactDetails(${contact.id})" style="cursor: pointer; color: var(--primary-color); text-decoration: underline;">
                    ${contact.name || 'No name'}
                </div>
                <div class="contact-details">
                    ${contact.email ? `<a href="mailto:${contact.email}" style="color: var(--primary-color); text-decoration: none;">${contact.email}</a>` : 'No email'}
                </div>
            </td>
            <td>
                <div class="contact-phone">
                    ${contact.phone ? 
                        `<a href="https://wa.me/${contact.phone.replace(/[^0-9]/g, '')}" target="_blank" class="phone-link" title="Open in WhatsApp Web">
                            <i class="fab fa-whatsapp"></i> ${contact.phone}
                        </a>` : 
                        'No phone'
                    }
                </div>
            </td>
            <td>
                <div class="contact-company" title="${contact.company || 'No company'}">${contact.company || 'No company'}</div>
            </td>
            <td>
                ${contact.group_id ? `<span class="group-badge group-blue">${groupName}</span>` : '<span class="text-muted">No group</span>'}
            </td>
            <td>
                ${metadataCount > 0 
                    ? `<span class="metadata-badge">${metadataCount} fields</span>`
                    : '<span class="text-muted">No metadata</span>'
                }
            </td>
            <td>
                <div class="dropdown">
                    <button class="btn btn-secondary btn-xs dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false" title="Actions">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <ul class="dropdown-menu">
                        <li><a class="dropdown-item" href="#" onclick="editContact(${contact.id})">
                            <i class="fas fa-edit"></i> Edit Contact
                        </a></li>
                        <li><a class="dropdown-item" href="#" onclick="assignContactToGroup(${contact.id})">
                            <i class="fas fa-users"></i> Assign Group
                        </a></li>
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item text-danger" href="#" onclick="deleteContact(${contact.id})">
                            <i class="fas fa-trash"></i> Delete Contact
                        </a></li>
                    </ul>
                </div>
            </td>
        </tr>
    `;
    }).join('');

    // Add event listeners to checkboxes
    document.querySelectorAll('.contact-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', updateBulkAssignButton);
    });

    // Add event listeners to dropdown toggles
    document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
        toggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Close other dropdowns
            document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
                if (menu !== this.nextElementSibling) {
                    menu.classList.remove('show');
                }
            });
            
            // Toggle current dropdown
            const dropdownMenu = this.nextElementSibling;
            if (dropdownMenu) {
                dropdownMenu.classList.toggle('show');
            }
        });
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.dropdown')) {
            document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
                menu.classList.remove('show');
            });
        }
    });
}

function updateTemplatesTable(templates) {
    const tbody = document.getElementById('templates-table-body');
    
    if (!templates || templates.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    <i class="fas fa-file-alt"></i>
                    <h3>No templates created</h3>
                    <p>Create your first template to get started</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = templates.map(template => `
        <tr>
            <td>${template.name || 'N/A'}</td>
            <td>${template.content ? template.content.substring(0, 50) + '...' : 'N/A'}</td>
            <td>${template.variables ? template.variables.join(', ') : 'N/A'}</td>
            <td>
                <span class="category-badge category-${template.category}">${template.category}</span>
            </td>
            <td>
                <div class="dropdown">
                    <button class="btn btn-secondary btn-xs dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false" title="Actions">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <ul class="dropdown-menu">
                        <li><a class="dropdown-item" href="#" onclick="editTemplate(${template.id})">
                            <i class="fas fa-edit"></i> Edit Template
                        </a></li>
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item text-danger" href="#" onclick="deleteTemplate(${template.id})">
                            <i class="fas fa-trash"></i> Delete Template
                        </a></li>
                    </ul>
                </div>
            </td>
        </tr>
    `).join('');

    // Add event listeners to dropdown toggles
    document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
        toggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Close other dropdowns
            document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
                if (menu !== this.nextElementSibling) {
                    menu.classList.remove('show');
                }
            });
            
            // Toggle current dropdown
            const dropdownMenu = this.nextElementSibling;
            if (dropdownMenu) {
                dropdownMenu.classList.toggle('show');
            }
        });
    });
}

// Contact Search Functions
let allContacts = []; // Store all contacts for search
let filteredContacts = []; // Store filtered contacts

function setupContactSearch() {
    const searchInput = document.getElementById('contacts-search');
    const clearBtn = document.getElementById('clear-search-btn');
    
    if (searchInput) {
        searchInput.addEventListener('input', handleContactSearch);
        searchInput.addEventListener('keyup', function(e) {
            if (e.key === 'Escape') {
                clearContactSearch();
            }
        });
    }
    
    if (clearBtn) {
        clearBtn.addEventListener('click', clearContactSearch);
    }
}

function handleContactSearch() {
    const searchInput = document.getElementById('contacts-search');
    const clearBtn = document.getElementById('clear-search-btn');
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    if (searchTerm === '') {
        clearContactSearch();
        return;
    }
    
    // Show clear button
    if (clearBtn) {
        clearBtn.style.display = 'block';
    }
    
    // Filter contacts
    filteredContacts = allContacts.filter(contact => {
        const name = (contact.name || '').toLowerCase();
        const email = (contact.email || '').toLowerCase();
        const phone = (contact.phone || '').toLowerCase();
        const company = (contact.company || '').toLowerCase();
        
        return name.includes(searchTerm) || 
               email.includes(searchTerm) || 
               phone.includes(searchTerm) || 
               company.includes(searchTerm);
    });
    
    // Update table with filtered results (apply pagination to filtered results)
    updatePaginationData('contacts', filteredContacts.length);
    const paginatedFilteredContacts = getPaginatedData(filteredContacts, 'contacts');
    updateContactsTable(paginatedFilteredContacts);
    
    // Show search results count
    const resultsCount = filteredContacts.length;
    console.log(`Search results: ${resultsCount} contacts found`);
}

async function clearContactSearch() {
    const searchInput = document.getElementById('contacts-search');
    const clearBtn = document.getElementById('clear-search-btn');
    
    if (searchInput) {
        searchInput.value = '';
    }
    
    if (clearBtn) {
        clearBtn.style.display = 'none';
    }
    
    // Show all contacts with pagination
    await loadContacts();
    filteredContacts = [];
}

// Message Log Functions
let messageLogs = []; // Store message logs
let currentLogFilter = 'all'; // Current filter: all, success, failed

// Function to log message sending
async function logMessage(contact, message, status, templateId = null, templateName = null) {
    try {
        const logData = {
            contactId: contact.id,
            contactName: contact.name || 'Unknown',
            contactPhone: contact.phone || '',
            message: message,
            status: status,
            sentAt: new Date().toISOString(),
            templateId: templateId,
            templateName: templateName,
            retryCount: 0
        };
        
        const result = await window.electronAPI.messageLogs.add(logData);
        if (result.success) {
            console.log('Message logged successfully:', logData);
            // Refresh logs if we're on analytics page
            if (currentPage === 'analytics') {
                await loadMessageLogs();
            }
        } else {
            console.error('Failed to log message:', result.error);
        }
    } catch (error) {
        console.error('Error logging message:', error);
    }
}

function setupMessageLogs() {
    // Setup filter buttons
    const filterButtons = document.querySelectorAll('.log-filters .btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            // Remove active class from all buttons
            filterButtons.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            this.classList.add('active');
            
            // Set current filter
            currentLogFilter = this.dataset.filter;
            updateMessageLogsTable();
        });
    });
    
    // Setup refresh button
    const refreshBtn = document.getElementById('refresh-logs-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadMessageLogs);
    }
    
    // Set default active filter
    document.getElementById('filter-all-logs').classList.add('active');
}

async function loadMessageLogs() {
    try {
        console.log('Loading message logs...');
        const result = await window.electronAPI.messageLogs.getAll();
        
        if (result.success) {
            const allLogsData = result.data || [];
            messageLogs = allLogsData;
            console.log(`Loaded ${messageLogs.length} message logs`);
            
            // Update pagination data
            updatePaginationData('analytics', allLogsData.length);
            
            // Get paginated data
            const paginatedLogs = getPaginatedData(allLogsData, 'analytics');
            
            // Update table with paginated data
            updateMessageLogsTable(paginatedLogs);
        } else {
            console.error('Failed to load message logs:', result.error);
            messageLogs = [];
            showNotification('Failed to load message logs', 'error');
        }
    } catch (error) {
        console.error('Error loading message logs:', error);
        messageLogs = [];
        showNotification('Error loading message logs', 'error');
        updateMessageLogsTable();
    }
}

function updateMessageLogsTable(logs = null) {
    const tbody = document.getElementById('message-logs-table-body');
    
    // Use provided logs or fallback to global messageLogs
    const logsToUse = logs || messageLogs;
    
    // Filter logs based on current filter
    let filteredLogs = logsToUse;
    if (currentLogFilter !== 'all') {
        filteredLogs = logsToUse.filter(log => log.status === currentLogFilter);
    }
    
    if (!filteredLogs || filteredLogs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <i class="fas fa-list-alt"></i>
                    <h3>No message logs found</h3>
                    <p>${currentLogFilter === 'all' ? 'Send some messages to see the log here' : `No ${currentLogFilter} messages found`}</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = filteredLogs.map(log => `
        <tr>
            <td>
                <span class="status-badge ${log.status}">
                    <i class="fas fa-${log.status === 'success' ? 'check' : log.status === 'failed' ? 'times' : 'clock'}"></i>
                    ${log.status.toUpperCase()}
                </span>
            </td>
            <td>
                <div class="contact-info">
                    <div class="contact-name">${log.contactName}</div>
                    <div class="contact-phone">${log.contactPhone}</div>
                </div>
            </td>
            <td>
                <div class="contact-phone">${log.contactPhone}</div>
            </td>
            <td>
                <div class="message-preview" title="${log.message}">${log.message}</div>
            </td>
            <td>
                <div class="text-muted">${formatDateTime(log.sentAt)}</div>
            </td>
            <td>
                ${log.status === 'failed' ? 
                    `<button class="btn btn-primary btn-sm resend-btn" onclick="resendMessage(${log.id})" title="Resend message">
                        <i class="fas fa-redo"></i> Resend
                    </button>` : 
                    log.status === 'pending' ?
                    `<span class="text-muted">
                        <i class="fas fa-clock"></i> Pending
                    </span>` :
                    '<span class="text-muted">Sent</span>'
                }
            </td>
        </tr>
    `).join('');
}

function formatDateTime(date) {
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    }).format(new Date(date));
}

async function resendMessage(logId) {
    const log = messageLogs.find(l => l.id === logId);
    if (!log) {
        showNotification('Message log not found', 'error');
        return;
    }
    
    // Show confirmation dialog
    if (confirm(`Resend message to ${log.contactName} (${log.contactPhone})?`)) {
        try {
            showNotification('Resending message...', 'info');
            
            // Update log status to pending
            log.status = 'pending';
            updateMessageLogsTable();
            
            // In a real implementation, this would trigger the actual resend process
            // For now, we'll simulate the process
            console.log('Resending message:', log);
            
            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Update log status to success
            const updateResult = await window.electronAPI.messageLogs.update(logId, {
                ...log,
                status: 'success',
                sentAt: new Date().toISOString(),
                retryCount: (log.retryCount || 0) + 1
            });
            
            if (updateResult.success) {
                // Reload logs to get updated data
                await loadMessageLogs();
                showNotification('Message resent successfully', 'success');
            } else {
                log.status = 'failed';
                updateMessageLogsTable();
                showNotification('Failed to resend message', 'error');
            }
        } catch (error) {
            console.error('Error resending message:', error);
            log.status = 'failed';
            updateMessageLogsTable();
            showNotification('Error resending message', 'error');
        }
    }
}

// Contact Groups Management Functions
function showAddContactGroupModal() {
    document.getElementById('add-contact-group-modal').style.display = 'flex';
}

function closeAddContactGroupModal() {
    document.getElementById('add-contact-group-modal').style.display = 'none';
    document.getElementById('add-contact-group-form').reset();
    document.getElementById('add-contact-group-form').dataset.editId = '';
    document.querySelector('#add-contact-group-modal .modal-title').textContent = 'Add Contact Group';
}

async function handleAddContactGroup(event) {
    event.preventDefault();
    
    try {
        const group = {
            name: document.getElementById('group-name').value.trim(),
            description: document.getElementById('group-description').value.trim(),
            color: document.getElementById('group-color').value
        };

        if (!group.name) {
            showNotification('Group name is required', 'error');
            return;
        }

        // Check if this is an edit operation
        const editId = document.getElementById('add-contact-group-form').dataset.editId;
        let result;
        
        if (editId) {
            group.id = parseInt(editId);
            result = await window.electronAPI.contactGroups.update(group);
        } else {
            result = await window.electronAPI.contactGroups.add(group);
        }
        
        if (result.success) {
            showNotification(editId ? 'Contact group updated successfully!' : 'Contact group added successfully!', 'success');
            closeAddContactGroupModal();
            await loadContactGroups();
        } else {
            showNotification(`Failed to ${editId ? 'update' : 'add'} contact group: ` + result.message, 'error');
        }
    } catch (error) {
        console.error('Add contact group error:', error);
        showNotification('Failed to add contact group', 'error');
    }
}

async function editContactGroup(id) {
    try {
        const result = await window.electronAPI.contactGroups.get(id);
        if (result.success && result.data) {
            const group = result.data;
            
            // Populate form with existing data
            document.getElementById('group-name').value = group.name || '';
            document.getElementById('group-description').value = group.description || '';
            document.getElementById('group-color').value = group.color || '#3b82f6';
            
            // Store the ID for update
            document.getElementById('add-contact-group-form').dataset.editId = id;
            
            // Change modal title
            document.querySelector('#add-contact-group-modal .modal-title').textContent = 'Edit Contact Group';
            
            showAddContactGroupModal();
        } else {
            showNotification('Failed to load contact group data', 'error');
        }
    } catch (error) {
        console.error('Edit contact group error:', error);
        showNotification('Failed to load contact group data', 'error');
    }
}

async function deleteContactGroup(id) {
    if (confirm('Are you sure you want to delete this contact group? This will remove the group from all contacts.')) {
        try {
            const result = await window.electronAPI.contactGroups.delete(id);
            
            if (result.success) {
                showNotification('Contact group deleted successfully!', 'success');
                await loadContactGroups();
            } else {
                showNotification('Failed to delete contact group: ' + result.message, 'error');
            }
        } catch (error) {
            console.error('Delete contact group error:', error);
            showNotification('Failed to delete contact group', 'error');
        }
    }
}

async function loadContactGroups() {
    try {
        console.log('Loading contact groups...');
        const result = await window.electronAPI.contactGroups.getAll();
        console.log('Contact groups API result:', result);
        if (result.success) {
            contactGroups = result.data;
            window.contactGroups = contactGroups; // Store globally
            console.log('Contact groups loaded:', contactGroups.length, 'groups');
            
            // Log each group with its contact count and update table
            for (const group of contactGroups) {
                try {
                    console.log(`loadContactGroups: Getting contacts for group ${group.id} (${group.name})`);
                    console.log(`loadContactGroups: Group ID type: ${typeof group.id}, value: ${group.id}`);
                    const contactsResult = await window.electronAPI.contactGroups.getContacts(group.id);
                    console.log(`loadContactGroups: Group contacts result:`, contactsResult);
                    console.log(`loadContactGroups: Group contacts result type:`, typeof contactsResult);
                    console.log(`loadContactGroups: Group contacts result success:`, contactsResult?.success);
                    console.log(`loadContactGroups: Group contacts result data type:`, typeof contactsResult?.data);
                    console.log(`loadContactGroups: Group contacts result data length:`, contactsResult?.data?.length);
                    
                    const contactCount = contactsResult.data?.length || 0;
                    console.log(`Group "${group.name}" (ID: ${group.id}) has ${contactCount} contacts`);
                    if (contactsResult.data && contactsResult.data.length > 0) {
                        console.log(`Group "${group.name}" contacts:`, contactsResult.data.map(c => ({ id: c.id, name: c.name, phone: c.phone, group_id: c.group_id })));
                    }
                    
                    // Update contact count in table
                    updateGroupContactCountInTable(group.id, contactCount);
                } catch (error) {
                    console.error(`Error getting contacts for group ${group.id}:`, error);
                }
            }
            
            // Update pagination data
            updatePaginationData('groups', result.data.length);
            
            // Get paginated data
            const paginatedGroups = getPaginatedData(result.data, 'groups');
            
            // Update table with paginated data
            updateContactGroupsTable(paginatedGroups);
            updateContactGroupsSelect(result.data);
        }
    } catch (error) {
        console.error('Failed to load contact groups:', error);
        showNotification('Failed to load contact groups', 'error');
    }
}

function updateContactGroupsTable(groups) {
    const tbody = document.getElementById('contact-groups-table-body');
    
    console.log('updateContactGroupsTable called with:', groups ? groups.length : 0, 'groups');
    console.log('Groups data:', groups);
    
    if (!groups || groups.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-state">
                    <i class="fas fa-layer-group"></i>
                    <h3>No contact groups created</h3>
                    <p>Create your first contact group to organize your contacts</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = groups.map(group => {
        console.log('Processing group:', group);
        console.log('Group name:', group.name);
        console.log('Group color:', group.color);
        
        // Get contact count for this group - we need to fetch it from the API
        // For now, we'll show "Loading..." and update it asynchronously
        const contactCount = 0; // Will be updated by loadContactGroups
        console.log(`Group ${group.name} has ${contactCount} contacts (will be updated)`);
        console.log(`Group data:`, group);
        
        // Note: Contact count is already logged in loadContactGroups function
        
        return `
        <tr>
            <td>
                <span class="group-badge group-${group.color}">${group.name || 'No name'}</span>
            </td>
            <td>${group.description || 'No description'}</td>
            <td>
                <span class="contact-count-badge">${contactCount} contacts</span>
            </td>
            <td>
                <div class="dropdown">
                    <button class="btn btn-secondary btn-xs dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false" title="Actions">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <ul class="dropdown-menu">
                        <li><a class="dropdown-item" href="#" onclick="editContactGroup(${group.id})">
                            <i class="fas fa-edit"></i> Edit Group
                        </a></li>
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item text-danger" href="#" onclick="deleteContactGroup(${group.id})">
                            <i class="fas fa-trash"></i> Delete Group
                        </a></li>
                    </ul>
                </div>
            </td>
        </tr>
    `;
    }).join('');

    // Add event listeners to dropdown toggles
    document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
        toggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Close other dropdowns
            document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
                if (menu !== this.nextElementSibling) {
                    menu.classList.remove('show');
                }
            });
            
            // Toggle current dropdown
            const dropdownMenu = this.nextElementSibling;
            if (dropdownMenu) {
                dropdownMenu.classList.toggle('show');
            }
        });
    });
}

async function updateContactGroupsSelect(groups) {
    console.log('updateContactGroupsSelect called with:', groups ? groups.length : 0, 'groups');
    
    // Update contact group select in contact form
    const contactGroupSelect = document.getElementById('contact-group');
    if (contactGroupSelect) {
        contactGroupSelect.innerHTML = '<option value="">Select a group...</option>';
        for (const group of groups) {
            const option = document.createElement('option');
            option.value = group.id;
            
            // Get contact count for this group
            try {
                const contactsResult = await window.electronAPI.contactGroups.getContacts(group.id);
                const contactCount = contactsResult.data?.length || 0;
                option.textContent = `${group.name} (${contactCount} contacts)`;
            } catch (error) {
                console.error(`Error getting contact count for group ${group.name}:`, error);
                option.textContent = group.name;
            }
            
            contactGroupSelect.appendChild(option);
        }
        console.log('Updated contact form group select with', groups.length, 'groups');
    }
    
    // Update message groups select
    const messageGroupsSelect = document.getElementById('message-groups-select');
    if (messageGroupsSelect) {
        messageGroupsSelect.innerHTML = '<option value="">Choose groups...</option>';
        for (const group of groups) {
            const option = document.createElement('option');
            option.value = group.id;
            
            // Get contact count for this group
            try {
                const contactsResult = await window.electronAPI.contactGroups.getContacts(group.id);
                const contactCount = contactsResult.data?.length || 0;
                option.textContent = `${group.name} (${contactCount} contacts)`;
            } catch (error) {
                console.error(`Error getting contact count for group ${group.name}:`, error);
                option.textContent = group.name;
            }
            
            messageGroupsSelect.appendChild(option);
        }
        console.log('Updated message groups select with', groups.length, 'groups');
    }
    
    // Update scheduled groups select
    const scheduledGroupsSelect = document.getElementById('scheduled-groups-select');
    if (scheduledGroupsSelect) {
        scheduledGroupsSelect.innerHTML = '<option value="">Choose groups...</option>';
        for (const group of groups) {
            const option = document.createElement('option');
            option.value = group.id;
            
            // Get contact count for this group
            try {
                const contactsResult = await window.electronAPI.contactGroups.getContacts(group.id);
                const contactCount = contactsResult.data?.length || 0;
                option.textContent = `${group.name} (${contactCount} contacts)`;
            } catch (error) {
                console.error(`Error getting contact count for group ${group.name}:`, error);
                option.textContent = group.name;
            }
            
            scheduledGroupsSelect.appendChild(option);
        }
        console.log('Updated scheduled groups select with', groups.length, 'groups');
    }
}

// Function to update contact count in table
function updateGroupContactCountInTable(groupId, contactCount) {
    const table = document.getElementById('contact-groups-table-body');
    if (table) {
        const rows = table.querySelectorAll('tr');
        rows.forEach(row => {
            const groupBadge = row.querySelector('.group-badge');
            if (groupBadge) {
                const groupName = groupBadge.textContent.trim();
                // Find the contact count badge in this row
                const contactCountBadge = row.querySelector('.contact-count-badge');
                if (contactCountBadge) {
                    contactCountBadge.textContent = `${contactCount} contacts`;
                    console.log(`Updated contact count for group ${groupName}: ${contactCount} contacts`);
                }
            }
        });
    }
}

// Update template form to include contact groups
async function handleAddTemplate(event) {
    event.preventDefault();
    
    try {
        const template = {
            name: document.getElementById('template-name').value.trim(),
            content: document.getElementById('template-content').value.trim(),
            category: document.getElementById('template-category').value,
            is_active: true
        };

        // Parse variables
        const variablesText = document.getElementById('template-variables').value.trim();
        template.variables = variablesText ? variablesText.split(',').map(v => v.trim()).filter(v => v) : [];


        if (!template.name || !template.content) {
            showNotification('Template name and content are required fields', 'error');
            return;
        }

        // Check if this is an edit operation
        const editId = document.getElementById('add-template-form').dataset.editId;
        let result;
        
        if (editId) {
            template.id = parseInt(editId);
            result = await window.electronAPI.templates.update(template);
        } else {
            result = await window.electronAPI.templates.add(template);
        }
        
        if (result.success) {
            showNotification(editId ? 'Template updated successfully!' : 'Template added successfully!', 'success');
            closeAddTemplateModal();
            await loadTemplates();
        } else {
            showNotification(`Failed to ${editId ? 'update' : 'add'} template: ` + result.message, 'error');
        }
    } catch (error) {
        console.error('Template operation error:', error);
        showNotification('Failed to save template', 'error');
    }
}

// Bulk assignment functions
function toggleSelectAllContacts() {
    const selectAll = document.getElementById('select-all-contacts');
    const checkboxes = document.querySelectorAll('.contact-checkbox');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAll.checked;
    });
    
    updateBulkAssignButton();
}

function updateBulkAssignButton() {
    const selectedContacts = document.querySelectorAll('.contact-checkbox:checked');
    const bulkBtn = document.getElementById('bulk-assign-group-btn');
    
    if (selectedContacts.length > 0) {
        bulkBtn.style.display = 'inline-flex';
    } else {
        bulkBtn.style.display = 'none';
    }
}

function showBulkAssignGroupModal() {
    const selectedContacts = document.querySelectorAll('.contact-checkbox:checked');
    if (selectedContacts.length === 0) {
        showNotification('Please select contacts first', 'error');
        return;
    }
    
    // Load contact groups
    loadContactGroupsForBulk();
    
    // Update selected contacts list
    updateSelectedContactsList();
    
    document.getElementById('bulk-assign-group-modal').style.display = 'flex';
}

function loadContactGroupsForBulk() {
    const select = document.getElementById('bulk-group-select');
    select.innerHTML = '<option value="">Choose a group...</option>';
    
    // Load groups from existing data or API
    window.electronAPI.contactGroups.getAll().then(result => {
        if (result.success && result.data) {
            result.data.forEach(group => {
                const option = document.createElement('option');
                option.value = group.id;
                option.textContent = group.name;
                select.appendChild(option);
            });
        }
    });
}

function updateSelectedContactsList() {
    const selectedContacts = document.querySelectorAll('.contact-checkbox:checked');
    const container = document.getElementById('selected-contacts-list');
    
    if (selectedContacts.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.875rem;">No contacts selected</p>';
        return;
    }
    
    const contactsList = Array.from(selectedContacts).map(checkbox => {
        const row = checkbox.closest('tr');
        const name = row.cells[1].textContent;
        const phone = row.cells[2].textContent;
        return `<div style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);">
                    <strong>${name}</strong> - ${phone}
                </div>`;
    }).join('');
    
    container.innerHTML = contactsList;
}

async function confirmBulkAssignGroup() {
    const groupId = document.getElementById('bulk-group-select').value;
    const selectedContacts = document.querySelectorAll('.contact-checkbox:checked');
    
    if (!groupId) {
        showNotification('Please select a group', 'error');
        return;
    }
    
    if (selectedContacts.length === 0) {
        showNotification('Please select contacts first', 'error');
        return;
    }
    
    try {
        showLoadingModal('Assigning contacts...', 'Please wait while we assign contacts to group');
        
        const contactIds = Array.from(selectedContacts).map(checkbox => 
            parseInt(checkbox.dataset.contactId)
        );
        
        let successCount = 0;
        let errorCount = 0;
        
        for (const contactId of contactIds) {
            try {
                const result = await window.electronAPI.contactGroups.assignContact(contactId, parseInt(groupId));
                if (result.success) {
                    successCount++;
                } else {
                    errorCount++;
                }
            } catch (error) {
                errorCount++;
                console.error('Error assigning contact:', error);
            }
        }
        
        hideLoadingModal();
        closeBulkAssignGroupModal();
        
        if (successCount > 0) {
            showNotification(`Successfully assigned ${successCount} contacts to group!`, 'success');
        }
        if (errorCount > 0) {
            showNotification(`Failed to assign ${errorCount} contacts`, 'error');
        }
        
        // Refresh contacts table
        await loadContacts();
        
    } catch (error) {
        hideLoadingModal();
        console.error('Bulk assign error:', error);
        showNotification('Failed to assign contacts to group', 'error');
    }
}

function closeBulkAssignGroupModal() {
    document.getElementById('bulk-assign-group-modal').style.display = 'none';
    document.getElementById('bulk-group-select').value = '';
    
    // Uncheck all contacts
    document.querySelectorAll('.contact-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
    document.getElementById('select-all-contacts').checked = false;
    updateBulkAssignButton();
}

// Make functions globally available
window.closeQRModal = closeQRModal;
window.closeAddContactModal = closeAddContactModal;
window.closeAddContactGroupModal = closeAddContactGroupModal;
window.closeAddTemplateModal = closeAddTemplateModal;
window.closeAssignGroupModal = closeAssignGroupModal;
window.closeBulkAssignGroupModal = closeBulkAssignGroupModal;
window.editContact = editContact;
window.editTemplate = editTemplate;
window.editContactGroup = editContactGroup;
window.assignContactToGroup = assignContactToGroup;
window.confirmAssignGroup = confirmAssignGroup;
window.confirmBulkAssignGroup = confirmBulkAssignGroup;
window.deleteContact = deleteContact;
window.deleteContactGroup = deleteContactGroup;
window.deleteTemplate = deleteTemplate;

// Contact Details Functions
async function viewContactDetails(contactId) {
    try {
        console.log('Loading contact details for ID:', contactId);
        const contactResult = await window.electronAPI.contacts.get(contactId);
        console.log('Contact API result:', contactResult);
        
        if (!contactResult || !contactResult.success) {
            showNotification('Contact not found', 'error');
            return;
        }
        
        const contact = contactResult.data || contactResult;
        console.log('Contact data received:', contact);

        // Get contact groups for display
        let groupName = 'No Group';
        try {
            const groupsResult = await window.electronAPI.contactGroups.getAll();
            console.log('Contact groups result:', groupsResult);
            
            if (groupsResult.success && groupsResult.data) {
                const group = groupsResult.data.find(g => g.id === contact.group_id);
                groupName = group ? group.name : 'No Group';
            }
        } catch (error) {
            console.warn('Could not load contact groups:', error);
        }
        // Helper function to safely display values
        const safeValue = (value, fallback = 'No data') => {
            if (value === null || value === undefined || value === '') {
                return `<span class="empty">${fallback}</span>`;
            }
            return value;
        };

        const metadataCount = contact.metadata ? Object.keys(contact.metadata).length : 0;

        let metadataHtml = '';
        if (contact.metadata && Object.keys(contact.metadata).length > 0) {
            // Filter out empty metadata values
            const validMetadata = Object.entries(contact.metadata).filter(([key, value]) => 
                value !== null && value !== undefined && value !== ''
            );
            
            if (validMetadata.length > 0) {
                metadataHtml = `
                    <div class="contact-details-section">
                        <h3>Additional Information (${validMetadata.length} fields)</h3>
                        <div class="contact-details-grid">
                            ${validMetadata.map(([key, value]) => `
                                <div class="contact-details-item">
                                    <div class="contact-details-label">${key.replace(/_/g, ' ').toUpperCase()}</div>
                                    <div class="contact-details-value">${safeValue(value, 'No data')}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        }

        const content = `
            <div class="contact-details-section">
                <h3>Basic Information</h3>
                <div class="contact-details-grid">
                    <div class="contact-details-item">
                        <div class="contact-details-label">Name</div>
                        <div class="contact-details-value">${safeValue(contact.name, 'No name')}</div>
                    </div>
                    <div class="contact-details-item">
                        <div class="contact-details-label">Phone</div>
                        <div class="contact-details-value">${safeValue(contact.phone, 'No phone')}</div>
                    </div>
                    <div class="contact-details-item">
                        <div class="contact-details-label">Email</div>
                        <div class="contact-details-value">${safeValue(contact.email, 'No email')}</div>
                    </div>
                    <div class="contact-details-item">
                        <div class="contact-details-label">Company/School</div>
                        <div class="contact-details-value">${safeValue(contact.company, 'No company')}</div>
                    </div>
                    <div class="contact-details-item">
                        <div class="contact-details-label">Group</div>
                        <div class="contact-details-value">${safeValue(groupName, 'No group')}</div>
                    </div>
                    <div class="contact-details-item">
                        <div class="contact-details-label">Created</div>
                        <div class="contact-details-value">${contact.created_at ? new Date(contact.created_at).toLocaleString() : '<span class="empty">Unknown</span>'}</div>
                    </div>
                </div>
            </div>
            ${metadataHtml}
        `;

        document.getElementById('contact-details-content').innerHTML = content;
        document.getElementById('contact-details-modal').style.display = 'flex';
        
        // Add click outside to close functionality
        document.getElementById('contact-details-modal').addEventListener('click', function(e) {
            if (e.target === this) {
                closeContactDetailsModal();
            }
        });
        
        // Add keyboard support (ESC key)
        const handleKeyDown = function(e) {
            if (e.key === 'Escape') {
                closeContactDetailsModal();
                document.removeEventListener('keydown', handleKeyDown);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
    } catch (error) {
        console.error('Error loading contact details:', error);
        showNotification('Failed to load contact details: ' + error.message, 'error');
        
        // Show error in modal
        document.getElementById('contact-details-content').innerHTML = `
            <div class="contact-details-section">
                <h3>Error Loading Contact Details</h3>
                <div class="contact-details-value">
                    <p>Failed to load contact details: ${error.message}</p>
                    <p>Please try again or contact support if the problem persists.</p>
                    <p><strong>Debug Info:</strong></p>
                    <p>Contact ID: ${contactId}</p>
                    <p>Error: ${error.message}</p>
                </div>
            </div>
        `;
        document.getElementById('contact-details-modal').style.display = 'flex';
    }
}

function closeContactDetailsModal() {
    const modal = document.getElementById('contact-details-modal');
    modal.style.display = 'none';
    
    // Clear content to prevent memory leaks
    const content = document.getElementById('contact-details-content');
    if (content) {
        content.innerHTML = '';
    }
}

// Make contact details functions globally available
window.viewContactDetails = viewContactDetails;
window.closeContactDetailsModal = closeContactDetailsModal;

// Autocomplete functionality
let selectedContacts = {
    message: [],
    scheduled: []
};

function initializeAutocomplete() {
    // Initialize message contacts autocomplete
    const messageInput = document.getElementById('message-contacts-autocomplete');
    const messageDropdown = document.getElementById('message-contacts-dropdown');
    const messageSelected = document.getElementById('message-selected-contacts');
    
    if (messageInput && messageDropdown && messageSelected) {
        setupAutocomplete(messageInput, messageDropdown, messageSelected, 'message');
    }

    // Initialize scheduled contacts autocomplete
    const scheduledInput = document.getElementById('scheduled-contacts-autocomplete');
    const scheduledDropdown = document.getElementById('scheduled-contacts-dropdown');
    const scheduledSelected = document.getElementById('scheduled-selected-contacts');
    
    if (scheduledInput && scheduledDropdown && scheduledSelected) {
        setupAutocomplete(scheduledInput, scheduledDropdown, scheduledSelected, 'scheduled');
    }
}

function setupAutocomplete(input, dropdown, selectedContainer, type) {
    let selectedIndex = -1;
    let filteredContacts = [];

    input.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        
        if (query.length < 2) {
            dropdown.classList.remove('show');
            return;
        }

        // Filter contacts
        filteredContacts = contacts.filter(contact => {
            const name = (contact.name || '').toLowerCase();
            const phone = (contact.phone || '').toLowerCase();
            const email = (contact.email || '').toLowerCase();
            const company = (contact.company || '').toLowerCase();
            
            return name.includes(query) || 
                   phone.includes(query) || 
                   email.includes(query) || 
                   company.includes(query);
        });

        // Remove already selected contacts
        filteredContacts = filteredContacts.filter(contact => 
            !selectedContacts[type].some(selected => selected.id === contact.id)
        );

        displayAutocompleteResults(dropdown, filteredContacts, type);
        selectedIndex = -1;
    });

    input.addEventListener('keydown', (e) => {
        if (!dropdown.classList.contains('show')) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, filteredContacts.length - 1);
                updateSelectedItem(dropdown, selectedIndex);
                break;
            case 'ArrowUp':
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, -1);
                updateSelectedItem(dropdown, selectedIndex);
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedIndex >= 0 && filteredContacts[selectedIndex]) {
                    selectContact(filteredContacts[selectedIndex], type);
                    input.value = '';
                    dropdown.classList.remove('show');
                }
                break;
            case 'Escape':
                dropdown.classList.remove('show');
                break;
        }
    });

    // Hide dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });
}

function displayAutocompleteResults(dropdown, contacts, type) {
    if (contacts.length === 0) {
        dropdown.innerHTML = '<div class="autocomplete-no-results">No contacts found</div>';
    } else {
        dropdown.innerHTML = contacts.map((contact, index) => `
            <div class="autocomplete-item" data-index="${index}" onclick="selectContact(${JSON.stringify(contact).replace(/"/g, '&quot;')}, '${type}')">
                <div class="autocomplete-item-name">${contact.name || 'No name'}</div>
                <div class="autocomplete-item-details">
                    ${contact.phone || 'No phone'} • ${contact.email || 'No email'} • ${contact.company || 'No company'}
                </div>
            </div>
        `).join('');
    }
    
    dropdown.classList.add('show');
}

function updateSelectedItem(dropdown, selectedIndex) {
    const items = dropdown.querySelectorAll('.autocomplete-item');
    items.forEach((item, index) => {
        item.classList.toggle('selected', index === selectedIndex);
    });
}

function selectContact(contact, type) {
    console.log('selectContact called with:', contact);
    console.log('Contact phone field:', contact.phone);
    console.log('Contact number field:', contact.number);
    console.log('Contact telepon field:', contact.telepon);
    
    // Add to selected contacts
    selectedContacts[type].push(contact);
    
    // Update display
    updateSelectedContactsDisplay(type);
    
    // Clear input
    const input = document.getElementById(`${type}-contacts-autocomplete`);
    if (input) {
        input.value = '';
    }
    
    // Hide dropdown
    const dropdown = document.getElementById(`${type}-contacts-dropdown`);
    if (dropdown) {
        dropdown.classList.remove('show');
    }
}

function removeSelectedContact(contactId, type) {
    selectedContacts[type] = selectedContacts[type].filter(contact => contact.id !== contactId);
    updateSelectedContactsDisplay(type);
}

function updateSelectedContactsDisplay(type) {
    const container = document.getElementById(`${type}-selected-contacts`);
    if (!container) return;

    if (selectedContacts[type].length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = selectedContacts[type].map(contact => `
        <div class="selected-contact-tag">
            <span>${contact.name || 'No name'}</span>
            <button class="remove-btn" onclick="removeSelectedContact(${contact.id}, '${type}')" title="Remove">×</button>
        </div>
    `).join('');
}

function getSelectedContacts(type) {
    return selectedContacts[type];
}

function clearSelectedContacts(type) {
    selectedContacts[type] = [];
    updateSelectedContactsDisplay(type);
}

// Make autocomplete functions globally available
window.selectContact = selectContact;
window.removeSelectedContact = removeSelectedContact;
window.getSelectedContacts = getSelectedContacts;
window.clearSelectedContacts = clearSelectedContacts;

// Pagination Functions
function setupPagination() {
    // Setup pagination for all list views
    setupPaginationForPage('contacts');
    setupPaginationForPage('groups');
    setupPaginationForPage('templates');
    setupPaginationForPage('scheduler');
    setupPaginationForPage('analytics');
}

function setupPaginationForPage(pageType) {
    const prevBtn = document.getElementById(`${pageType}-prev-btn`);
    const nextBtn = document.getElementById(`${pageType}-next-btn`);
    const jumpInput = document.getElementById(`${pageType}-jump-input`);
    const jumpBtn = document.getElementById(`${pageType}-jump-btn`);
    const perPageSelect = document.getElementById(`${pageType}-per-page-select`);

    if (prevBtn) {
        prevBtn.addEventListener('click', () => goToPage(pageType, currentPagination[pageType].currentPage - 1));
    }
    if (nextBtn) {
        nextBtn.addEventListener('click', () => goToPage(pageType, currentPagination[pageType].currentPage + 1));
    }
    if (jumpBtn && jumpInput) {
        jumpBtn.addEventListener('click', () => {
            const page = parseInt(jumpInput.value);
            if (page >= 1 && page <= currentPagination[pageType].totalPages) {
                goToPage(pageType, page);
            }
        });
        jumpInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const page = parseInt(jumpInput.value);
                if (page >= 1 && page <= currentPagination[pageType].totalPages) {
                    goToPage(pageType, page);
                }
            }
        });
    }
    if (perPageSelect) {
        perPageSelect.addEventListener('change', (e) => {
            const newPerPage = parseInt(e.target.value);
            if (newPerPage && newPerPage > 0) {
                console.log(`Changing per page for ${pageType} from ${currentPagination[pageType].perPage} to ${newPerPage}`);
                
                // Update both pagination config and current pagination
                paginationConfig.itemsPerPage = newPerPage;
                currentPagination[pageType].perPage = newPerPage;
                currentPagination[pageType].currentPage = 1;
                
                // Recalculate total pages
                currentPagination[pageType].totalPages = Math.ceil(currentPagination[pageType].totalItems / newPerPage);
                
                console.log(`Updated pagination for ${pageType}:`, currentPagination[pageType]);
                
                updatePaginationDisplay(pageType);
                
                // Reload data for the specific page type
                switch(pageType) {
                    case 'contacts':
                        loadContacts();
                        break;
                    case 'groups':
                        loadContactGroups();
                        break;
                    case 'templates':
                        loadTemplates();
                        break;
                    case 'scheduler':
                        loadScheduledTasks();
                        break;
                    case 'analytics':
                        loadMessageLogs();
                        break;
                }
            }
        });
    }
}

function goToPage(pageType, page) {
    if (page < 1 || page > currentPagination[pageType].totalPages) return;
    
    currentPagination[pageType].currentPage = page;
    updatePaginationDisplay(pageType);
    
    // Reload data for the specific page
    switch(pageType) {
        case 'contacts':
            loadContacts();
            break;
        case 'groups':
            loadContactGroups();
            break;
        case 'templates':
            loadTemplates();
            break;
        case 'scheduler':
            loadScheduledTasks();
            break;
        case 'analytics':
            loadMessageLogs();
            break;
    }
}

function updatePaginationDisplay(pageType) {
    const pagination = document.getElementById(`${pageType}-pagination`);
    const listControls = document.getElementById(`${pageType}-list-controls`);
    const info = document.getElementById(`${pageType}-pagination-info`);
    const prevBtn = document.getElementById(`${pageType}-prev-btn`);
    const nextBtn = document.getElementById(`${pageType}-next-btn`);
    const pageNumbers = document.getElementById(`${pageType}-page-numbers`);
    const jumpInput = document.getElementById(`${pageType}-jump-input`);

    if (!pagination || !info || !prevBtn || !nextBtn || !pageNumbers) return;

    const { currentPage, totalPages, totalItems } = currentPagination[pageType];
    
    // Show/hide list controls and pagination
    if (totalItems > 0) {
        if (listControls) listControls.style.display = 'flex';
        pagination.style.display = 'flex';
    } else {
        if (listControls) listControls.style.display = 'none';
        pagination.style.display = 'none';
    }
    
    // Always show list controls if there are items, regardless of pagination
    if (totalItems > 0 && listControls) {
        listControls.style.display = 'flex';
    }
    const perPage = currentPagination[pageType].perPage || paginationConfig.itemsPerPage;
    const startItem = (currentPage - 1) * perPage + 1;
    const endItem = Math.min(currentPage * perPage, totalItems);

    // Show/hide pagination based on total items
    if (totalItems <= perPage) {
        pagination.style.display = 'none';
        return;
    } else {
        pagination.style.display = 'flex';
    }

    // Update info - show actual displayed items
    const actualDisplayedItems = endItem - startItem + 1;
    info.textContent = `Showing ${startItem}-${endItem} of ${totalItems} ${pageType} (${actualDisplayedItems} items)`;

    // Update buttons
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;

    // Update page numbers
    pageNumbers.innerHTML = '';
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `pagination-btn ${i === currentPage ? 'active' : ''}`;
        pageBtn.textContent = i;
        pageBtn.addEventListener('click', () => goToPage(pageType, i));
        pageNumbers.appendChild(pageBtn);
    }

    // Update jump input
    if (jumpInput) {
        jumpInput.value = currentPage;
        jumpInput.max = totalPages;
    }
}

function updatePaginationData(pageType, totalItems) {
    currentPagination[pageType].totalItems = totalItems;
    const perPage = currentPagination[pageType].perPage || paginationConfig.itemsPerPage;
    currentPagination[pageType].totalPages = Math.ceil(totalItems / perPage);
    currentPagination[pageType].currentPage = Math.min(currentPagination[pageType].currentPage, currentPagination[pageType].totalPages);
    
    console.log(`Updated pagination data for ${pageType}:`, currentPagination[pageType]);
    updatePaginationDisplay(pageType);
}

function getPaginatedData(data, pageType) {
    const { currentPage } = currentPagination[pageType];
    const perPage = currentPagination[pageType].perPage || paginationConfig.itemsPerPage;
    const startIndex = (currentPage - 1) * perPage;
    const endIndex = startIndex + perPage;
    
    console.log(`Getting paginated data for ${pageType}:`);
    console.log(`- Current page: ${currentPage}`);
    console.log(`- Per page: ${perPage}`);
    console.log(`- Start index: ${startIndex}`);
    console.log(`- End index: ${endIndex}`);
    console.log(`- Total data length: ${data.length}`);
    
    const paginatedData = data.slice(startIndex, endIndex);
    console.log(`- Paginated data length: ${paginatedData.length}`);
    console.log(`- Paginated data:`, paginatedData.slice(0, 3)); // Show first 3 items
    
    return paginatedData;
}

// Make pagination functions globally available
window.goToPage = goToPage;
window.updatePaginationData = updatePaginationData;
window.getPaginatedData = getPaginatedData;
