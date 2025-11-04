const { ipcRenderer, contextBridge } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // WhatsApp client operations
    whatsapp: {
        connect: () => ipcRenderer.invoke('whatsapp-connect'),
        disconnect: () => ipcRenderer.invoke('whatsapp-disconnect'),
        forceDisconnect: () => ipcRenderer.invoke('whatsapp-force-disconnect'),
        getStatus: () => ipcRenderer.invoke('whatsapp-get-status'),
        checkHealth: () => ipcRenderer.invoke('whatsapp-check-health'),
        sendMessage: (data) => ipcRenderer.invoke('whatsapp-send-message', data),
        sendBulk: (data) => ipcRenderer.invoke('whatsapp-send-bulk', data)
    },

    // Database operations
    database: {
        getContacts: () => ipcRenderer.invoke('db-get-contacts'),
        saveContacts: (contacts) => ipcRenderer.invoke('db-save-contacts', contacts),
        getTemplates: () => ipcRenderer.invoke('db-get-templates'),
        saveTemplate: (template) => ipcRenderer.invoke('db-save-template', template),

        deleteTemplate: (id) => ipcRenderer.invoke('db-delete-template', id)
    },

    // CSV operations
    csv: {
        upload: () => ipcRenderer.invoke('csv-upload'),
        saveContacts: (contacts) => ipcRenderer.invoke('csv-save-contacts', contacts)
    },

    // Contact operations
    contacts: {
        add: (contact) => ipcRenderer.invoke('contact-add', contact),
        update: (contact) => ipcRenderer.invoke('contact-update', contact),
        delete: (id) => ipcRenderer.invoke('contact-delete', id),
        get: (id) => ipcRenderer.invoke('contact-get', id),
        getAll: () => ipcRenderer.invoke('db-get-contacts')
    },

    // Template operations
    templates: {
        add: (template) => ipcRenderer.invoke('template-add', template),
        update: (template) => ipcRenderer.invoke('template-update', template),
        delete: (id) => ipcRenderer.invoke('template-delete', id),
        get: (id) => ipcRenderer.invoke('template-get', id)
    },

    // Contact Groups operations
    contactGroups: {
        add: (group) => ipcRenderer.invoke('contact-group-add', group),
        update: (group) => ipcRenderer.invoke('contact-group-update', group),
        delete: (id) => ipcRenderer.invoke('contact-group-delete', id),
        getAll: () => ipcRenderer.invoke('contact-group-get-all'),
        get: (id) => ipcRenderer.invoke('contact-group-get', id),
        getContacts: (groupId) => ipcRenderer.invoke('contact-group-get-contacts', groupId),
        assignContact: (contactId, groupId) => ipcRenderer.invoke('contact-assign-group', contactId, groupId)
    },

    // File operations
    files: {
        importCSV: () => ipcRenderer.invoke('file-import-csv'),
        exportData: (data) => ipcRenderer.invoke('file-export-data', data)
    },

    // Settings
    settings: {
        get: () => ipcRenderer.invoke('settings-get'),
        set: (key, value) => ipcRenderer.invoke('settings-set', key, value)
    },

    // Scheduler
    scheduler: {
        getTasks: () => ipcRenderer.invoke('scheduler-get-tasks'),
        addTask: (task) => ipcRenderer.invoke('scheduler-add-task', task),
        removeTask: (id) => ipcRenderer.invoke('scheduler-remove-task', id)
    },

    // Analytics
    analytics: {
        getStats: () => ipcRenderer.invoke('analytics-get-stats')
    },

    // Message Logs operations
    messageLogs: {
        getAll: () => ipcRenderer.invoke('message-logs-get-all'),
        add: (log) => ipcRenderer.invoke('message-logs-add', log),
        update: (id, log) => ipcRenderer.invoke('message-logs-update', id, log),
        delete: (id) => ipcRenderer.invoke('message-logs-delete', id)
    },

    // Event listeners
    on: (channel, callback) => {
        const validChannels = [
            'whatsapp-status-changed',
            'whatsapp-qr-code',
            'whatsapp-qr-timeout',
            'whatsapp-message-sent',
            'whatsapp-message-failed',
            'whatsapp-login-success',
            'whatsapp-login-failed',
            'update-available',
            'update-downloaded',
            'import-contacts',
            'export-data',
            'open-settings',
            'open-templates',
            'open-scheduler',
            'open-analytics',
            'show-qr-code'
        ];
        
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, callback);
        }
    },

    // Remove event listeners
    removeAllListeners: (channel) => {
        ipcRenderer.removeAllListeners(channel);
    },

    // Utility functions
    utils: {
        formatPhoneNumber: (phone) => {
            let cleaned = phone.replace(/\D/g, '');
            if (cleaned.startsWith('0')) {
                cleaned = '62' + cleaned.substring(1);
            } else if (!cleaned.startsWith('62')) {
                cleaned = '62' + cleaned;
            }
            return cleaned + '@c.us';
        },
        
        validateEmail: (email) => {
            const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return re.test(email);
        },
        
        formatDate: (date) => {
            return new Date(date).toLocaleDateString('id-ID', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
     },

    // 🔥 Live WhatsApp page support
    liveWhatsApp: {
        open: () => ipcRenderer.send('open-live-whatsapp'),
        close: () => ipcRenderer.send('close-live-whatsapp')
    }
});
