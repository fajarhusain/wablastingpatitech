const fs = require('fs');
const path = require('path');

class SimpleDatabaseManager {
    constructor() {
        this.dataPath = path.join(__dirname, '../../data');
        this.contactsFile = path.join(this.dataPath, 'contacts.json');
        this.contactGroupsFile = path.join(this.dataPath, 'contact-groups.json');
        this.templatesFile = path.join(this.dataPath, 'templates.json');
        this.messagesFile = path.join(this.dataPath, 'messages.json');
        this.scheduledFile = path.join(this.dataPath, 'scheduled.json');
        this.analyticsFile = path.join(this.dataPath, 'analytics.json');
        this.settingsFile = path.join(this.dataPath, 'settings.json');
        
        this.initialize();
    }

    initialize() {
        // Ensure data directory exists
        if (!fs.existsSync(this.dataPath)) {
            fs.mkdirSync(this.dataPath, { recursive: true });
        }

        // Initialize files if they don't exist
        this.initializeFile(this.contactsFile, []);
        this.initializeFile(this.contactGroupsFile, []);
        this.initializeFile(this.templatesFile, []);
        this.initializeFile(this.messagesFile, []);
        this.initializeFile(this.scheduledFile, []);
        this.initializeFile(this.analyticsFile, []);
        this.initializeFile(this.settingsFile, {});

        console.log('Simple database initialized');
    }

    initializeFile(filePath, defaultValue) {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
        }
    }

    readFile(filePath) {
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error(`Error reading file ${filePath}:`, error);
            return null;
        }
    }

    writeFile(filePath, data) {
        try {
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            return true;
        } catch (error) {
            console.error(`Error writing file ${filePath}:`, error);
            return false;
        }
    }

    // Contacts operations
    async getContacts() {
        return this.readFile(this.contactsFile) || [];
    }

    async getContact(id) {
        const contacts = await this.getContacts();
        return contacts.find(contact => contact.id === id);
    }

    async saveContact(contact) {
        const contacts = await this.getContacts();
        
        if (contact.id) {
            // Update existing contact
            const index = contacts.findIndex(c => c.id === contact.id);
            if (index !== -1) {
                contacts[index] = { ...contact, updated_at: new Date().toISOString() };
            }
        } else {
            // Add new contact
            const newContact = {
                id: Date.now(),
                name: contact.name || '',
                phone: contact.phone || '',
                group_id: contact.group_id || null,
                metadata: contact.metadata || {}, // Store additional data as metadata
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            contacts.push(newContact);
        }

        return this.writeFile(this.contactsFile, contacts);
    }

    async saveContacts(newContacts) {
        const contacts = newContacts.map((contact, index) => ({
            id: Date.now() + index,
            ...contact,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }));

        return this.writeFile(this.contactsFile, contacts);
    }

    async deleteContact(id) {
        const contacts = await this.getContacts();
        const filteredContacts = contacts.filter(contact => contact.id !== id);
        return this.writeFile(this.contactsFile, filteredContacts);
    }

    async clearContacts() {
        return this.writeFile(this.contactsFile, []);
    }

    // Templates operations
    async getTemplates() {
        return this.readFile(this.templatesFile) || [];
    }

    async getTemplate(id) {
        const templates = await this.getTemplates();
        return templates.find(template => template.id === id);
    }

    async saveTemplate(template) {
        const templates = await this.getTemplates();
        
        if (template.id) {
            // Update existing template
            const index = templates.findIndex(t => t.id === template.id);
            if (index !== -1) {
                templates[index] = { ...template, updated_at: new Date().toISOString() };
            }
        } else {
            // Add new template
            const newTemplate = {
                id: Date.now(),
                ...template,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            templates.push(newTemplate);
        }

        return this.writeFile(this.templatesFile, templates);
    }

    async deleteTemplate(id) {
        const templates = await this.getTemplates();
        const filteredTemplates = templates.filter(template => template.id !== id);
        return this.writeFile(this.templatesFile, filteredTemplates);
    }

    // Message history operations
    async saveMessageHistory(messageData) {
        const messages = this.readFile(this.messagesFile) || [];
        const newMessage = {
            id: Date.now(),
            ...messageData,
            created_at: new Date().toISOString()
        };
        messages.push(newMessage);
        return this.writeFile(this.messagesFile, messages);
    }

    async getMessageHistory(limit = 100) {
        const messages = this.readFile(this.messagesFile) || [];
        return messages.slice(-limit).reverse();
    }

    // Scheduled messages operations
    async getScheduledMessages() {
        return this.readFile(this.scheduledFile) || [];
    }

    async saveScheduledMessage(messageData) {
        const scheduled = this.readFile(this.scheduledFile) || [];
        const newMessage = {
            id: Date.now(),
            ...messageData,
            created_at: new Date().toISOString()
        };
        scheduled.push(newMessage);
        return this.writeFile(this.scheduledFile, scheduled);
    }

    async updateScheduledMessageStatus(id, status) {
        const scheduled = this.readFile(this.scheduledFile) || [];
        const index = scheduled.findIndex(msg => msg.id === id);
        if (index !== -1) {
            scheduled[index].status = status;
            return this.writeFile(this.scheduledFile, scheduled);
        }
        return false;
    }

    // Analytics operations
    async getAnalytics(dateFrom = null, dateTo = null) {
        const analytics = this.readFile(this.analyticsFile) || [];
        
        if (dateFrom && dateTo) {
            return analytics.filter(item => {
                const itemDate = new Date(item.date);
                return itemDate >= new Date(dateFrom) && itemDate <= new Date(dateTo);
            });
        }
        
        return analytics;
    }

    async updateAnalytics(date, stats) {
        const analytics = this.readFile(this.analyticsFile) || [];
        
        // Find existing entry for the date
        const index = analytics.findIndex(item => item.date === date);
        
        if (index !== -1) {
            analytics[index] = { ...analytics[index], ...stats };
        } else {
            analytics.push({ date, ...stats, created_at: new Date().toISOString() });
        }
        
        return this.writeFile(this.analyticsFile, analytics);
    }

    // Settings operations
    async getSetting(key) {
        const settings = this.readFile(this.settingsFile) || {};
        return settings[key] || null;
    }

    async setSetting(key, value) {
        const settings = this.readFile(this.settingsFile) || {};
        settings[key] = value;
        return this.writeFile(this.settingsFile, settings);
    }

    // Contact Groups operations
    async getContactGroups() {
        return this.readFile(this.contactGroupsFile) || [];
    }

    async getContactGroup(id) {
        const groups = await this.getContactGroups();
        return groups.find(group => group.id === id);
    }

    async saveContactGroup(group) {
        const groups = await this.getContactGroups();
        
        if (group.id) {
            // Update existing group
            const index = groups.findIndex(g => g.id === group.id);
            if (index !== -1) {
                groups[index] = { ...group, updated_at: new Date().toISOString() };
            }
        } else {
            // Add new group
            const newGroup = {
                id: Date.now(),
                ...group,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            groups.push(newGroup);
        }

        return this.writeFile(this.contactGroupsFile, groups);
    }

    async deleteContactGroup(id) {
        const groups = await this.getContactGroups();
        const filteredGroups = groups.filter(group => group.id !== id);
        
        // Remove group from contacts
        const contacts = await this.getContacts();
        const updatedContacts = contacts.map(contact => {
            if (contact.group_id === id) {
                const { group_id, ...contactWithoutGroup } = contact;
                return contactWithoutGroup;
            }
            return contact;
        });
        
        await this.writeFile(this.contactsFile, updatedContacts);
        return this.writeFile(this.contactGroupsFile, filteredGroups);
    }

    async assignContactToGroup(contactId, groupId) {
        const contacts = await this.getContacts();
        const index = contacts.findIndex(c => c.id === contactId);
        
        if (index !== -1) {
            contacts[index].group_id = groupId;
            contacts[index].updated_at = new Date().toISOString();
            return this.writeFile(this.contactsFile, contacts);
        }
        
        return false;
    }

    async getContactsByGroup(groupId) {
        const contacts = await this.getContacts();
        console.log(`getContactsByGroup: Total contacts in database: ${contacts.length}`);
        console.log(`getContactsByGroup: Looking for group_id: ${groupId}`);
        
        // Log all contacts with their group_id for debugging
        const contactsWithGroups = contacts.filter(c => c.group_id);
        console.log(`Contacts with groups: ${contactsWithGroups.length}`);
        console.log('All contacts with groups:', contactsWithGroups.map(c => ({ id: c.id, name: c.name, group_id: c.group_id })));
        
        const groupContacts = contacts.filter(contact => contact.group_id === groupId);
        console.log(`getContactsByGroup: Found ${groupContacts.length} contacts for group ${groupId}`);
        console.log('Group contacts:', groupContacts.map(c => ({ id: c.id, name: c.name, group_id: c.group_id })));
        
        // Log detailed structure of first contact if exists
        if (groupContacts.length > 0) {
            console.log('First group contact detailed structure:', groupContacts[0]);
            console.log('First group contact phone field:', groupContacts[0].phone);
            console.log('First group contact available fields:', Object.keys(groupContacts[0]));
            
            // Check if contact has phone number
            const hasPhone = groupContacts[0].phone || groupContacts[0].number || groupContacts[0].telepon || groupContacts[0].phoneNumber;
            console.log('First contact has phone number:', hasPhone);
            if (!hasPhone) {
                console.warn('First contact has no phone number! This will cause sending to fail.');
            }
        }
        
        return groupContacts;
    }

    // Message Logs methods
    async getMessageLogs() {
        const messageLogsFile = path.join(this.dataPath, 'message-logs.json');
        this.initializeFile(messageLogsFile, []);
        return this.readFile(messageLogsFile) || [];
    }

    async addMessageLog(log) {
        const messageLogs = await this.getMessageLogs();
        const newLog = {
            id: Date.now(),
            ...log,
            createdAt: new Date().toISOString()
        };
        messageLogs.push(newLog);
        
        const messageLogsFile = path.join(this.dataPath, 'message-logs.json');
        this.writeFile(messageLogsFile, messageLogs);
        return newLog;
    }

    async updateMessageLog(id, logData) {
        const messageLogs = await this.getMessageLogs();
        const index = messageLogs.findIndex(log => log.id === id);
        
        if (index !== -1) {
            messageLogs[index] = {
                ...messageLogs[index],
                ...logData,
                updatedAt: new Date().toISOString()
            };
            
            const messageLogsFile = path.join(this.dataPath, 'message-logs.json');
            this.writeFile(messageLogsFile, messageLogs);
            return messageLogs[index];
        }
        
        return null;
    }

    async deleteMessageLog(id) {
        const messageLogs = await this.getMessageLogs();
        const filteredLogs = messageLogs.filter(log => log.id !== id);
        
        const messageLogsFile = path.join(this.dataPath, 'message-logs.json');
        this.writeFile(messageLogsFile, filteredLogs);
        return true;
    }

    // Close database connection (no-op for file-based storage)
    close() {
        console.log('Simple database connection closed');
    }
}

module.exports = { DatabaseManager: SimpleDatabaseManager };
