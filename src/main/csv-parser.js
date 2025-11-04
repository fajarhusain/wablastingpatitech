const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

class CSVParser {
    constructor() {
        this.standardColumns = ['name', 'phone', 'email', 'company'];
    }

    async parseCSV(filePath) {
        return new Promise((resolve, reject) => {
            const results = [];
            const headers = [];
            let isFirstRow = true;

            fs.createReadStream(filePath)
                .pipe(csv())
                .on('headers', (headerList) => {
                    headers.push(...headerList);
                })
                .on('data', (data) => {
                    if (isFirstRow) {
                        // Get headers from first row
                        headers.push(...Object.keys(data));
                        isFirstRow = false;
                    }

                    const contact = this.parseContactRow(data);
                    results.push(contact);
                })
                .on('end', () => {
                    resolve({
                        contacts: results,
                        headers: headers,
                        totalContacts: results.length
                    });
                })
                .on('error', (error) => {
                    reject(error);
                });
        });
    }

    parseContactRow(row) {
        const contact = {
            name: '',
            phone: '',
            email: '',
            company: '',
            metadata: {}
        };

        // Parse standard columns
        Object.keys(row).forEach(key => {
            const normalizedKey = key.toLowerCase().trim();
            const value = row[key] ? row[key].toString().trim() : '';

            switch (normalizedKey) {
                case 'name':
                case 'nama':
                case 'nama lengkap':
                    contact.name = value;
                    break;
                case 'phone':
                case 'telepon':
                case 'hp':
                case 'mobile':
                case 'no hp':
                    contact.phone = value;
                    break;
                case 'email':
                case 'e-mail':
                case 'email konfirmasi':
                    contact.email = value;
                    break;
                case 'company':
                case 'perusahaan':
                case 'instansi':
                case 'nama sekolah':
                    contact.company = value;
                    break;
                default:
                    // Add to metadata if not empty
                    if (value) {
                        contact.metadata[normalizedKey] = value;
                    }
                    break;
            }
        });

        return contact;
    }

    validateContact(contact) {
        const errors = [];

        if (!contact.name || contact.name.trim() === '') {
            errors.push('Name is required');
        }

        if (!contact.phone || contact.phone.trim() === '') {
            errors.push('Phone is required');
        } else {
            // Basic phone validation
            const phoneRegex = /^[\+]?[0-9\s\-\(\)]+$/;
            if (!phoneRegex.test(contact.phone)) {
                errors.push('Invalid phone number format');
            }
        }

        if (contact.email && contact.email.trim() !== '') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(contact.email)) {
                errors.push('Invalid email format');
            }
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    async validateContacts(contacts) {
        const validContacts = [];
        const invalidContacts = [];

        contacts.forEach((contact, index) => {
            const validation = this.validateContact(contact);
            
            if (validation.isValid) {
                validContacts.push(contact);
            } else {
                invalidContacts.push({
                    index: index + 1,
                    contact: contact,
                    errors: validation.errors
                });
            }
        });

        return {
            validContacts,
            invalidContacts,
            totalValid: validContacts.length,
            totalInvalid: invalidContacts.length
        };
    }

    formatPhoneNumber(phone) {
        // Remove all non-digit characters
        let cleaned = phone.replace(/\D/g, '');
        
        // Handle Indonesian phone numbers
        if (cleaned.startsWith('0')) {
            cleaned = '62' + cleaned.substring(1);
        } else if (!cleaned.startsWith('62')) {
            cleaned = '62' + cleaned;
        }
        
        return cleaned + '@c.us';
    }

    async exportToCSV(contacts, filePath) {
        return new Promise((resolve, reject) => {
            try {
                const csvContent = this.generateCSVContent(contacts);
                fs.writeFileSync(filePath, csvContent, 'utf8');
                resolve({ success: true, filePath });
            } catch (error) {
                reject(error);
            }
        });
    }

    generateCSVContent(contacts) {
        if (contacts.length === 0) {
            return 'name,phone,email,company\n';
        }

        // Get all unique metadata keys
        const metadataKeys = new Set();
        contacts.forEach(contact => {
            Object.keys(contact.metadata || {}).forEach(key => {
                metadataKeys.add(key);
            });
        });

        // Create headers
        const headers = ['name', 'phone', 'email', 'company', ...Array.from(metadataKeys)];
        
        // Generate CSV content
        let csvContent = headers.join(',') + '\n';
        
        contacts.forEach(contact => {
            const row = headers.map(header => {
                if (header === 'metadata') return '';
                
                let value = '';
                if (contact[header] !== undefined) {
                    value = contact[header];
                } else if (contact.metadata && contact.metadata[header] !== undefined) {
                    value = contact.metadata[header];
                }
                
                // Escape CSV values
                if (value && typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                    value = '"' + value.replace(/"/g, '""') + '"';
                }
                
                return value || '';
            });
            
            csvContent += row.join(',') + '\n';
        });

        return csvContent;
    }
}

module.exports = { CSVParser };
