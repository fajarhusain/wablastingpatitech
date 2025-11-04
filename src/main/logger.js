const winston = require('winston');
const path = require('path');
const fs = require('fs');

class Logger {
    constructor() {
        // Ensure logs directory exists
        const logsDir = path.join(__dirname, '../../data/logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }

        // Create logger instance
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp({
                    format: 'YYYY-MM-DD HH:mm:ss'
                }),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
            defaultMeta: { service: 'whatsapp-labs-desktop' },
            transports: [
                // Write all logs with importance level of `error` or less to `error.log`
                new winston.transports.File({
                    filename: path.join(logsDir, 'error.log'),
                    level: 'error',
                    maxsize: 5242880, // 5MB
                    maxFiles: 5,
                    tailable: true
                }),
                // Write all logs with importance level of `info` or less to `combined.log`
                new winston.transports.File({
                    filename: path.join(logsDir, 'combined.log'),
                    maxsize: 5242880, // 5MB
                    maxFiles: 5,
                    tailable: true
                })
            ]
        });

        // If we're not in production then log to the console with the format:
        // `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
        if (process.env.NODE_ENV !== 'production') {
            this.logger.add(new winston.transports.Console({
                format: winston.format.combine(
                    winston.format.colorize(),
                    winston.format.simple(),
                    winston.format.printf(({ timestamp, level, message, ...meta }) => {
                        return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
                    })
                )
            }));
        }

        // Create specific loggers for different modules
        this.whatsappLogger = this.logger.child({ module: 'whatsapp' });
        this.databaseLogger = this.logger.child({ module: 'database' });
        this.schedulerLogger = this.logger.child({ module: 'scheduler' });
        this.appLogger = this.logger.child({ module: 'app' });
    }

    // General logging methods
    info(message, meta = {}) {
        this.logger.info(message, meta);
    }

    error(message, meta = {}) {
        this.logger.error(message, meta);
    }

    warn(message, meta = {}) {
        this.logger.warn(message, meta);
    }

    debug(message, meta = {}) {
        this.logger.debug(message, meta);
    }

    // WhatsApp specific logging
    whatsappInfo(message, meta = {}) {
        this.whatsappLogger.info(message, meta);
    }

    whatsappError(message, meta = {}) {
        this.whatsappLogger.error(message, meta);
    }

    whatsappWarn(message, meta = {}) {
        this.whatsappLogger.warn(message, meta);
    }

    whatsappDebug(message, meta = {}) {
        this.whatsappLogger.debug(message, meta);
    }

    // Database specific logging
    databaseInfo(message, meta = {}) {
        this.databaseLogger.info(message, meta);
    }

    databaseError(message, meta = {}) {
        this.databaseLogger.error(message, meta);
    }

    databaseWarn(message, meta = {}) {
        this.databaseLogger.warn(message, meta);
    }

    databaseDebug(message, meta = {}) {
        this.databaseLogger.debug(message, meta);
    }

    // Scheduler specific logging
    schedulerInfo(message, meta = {}) {
        this.schedulerLogger.info(message, meta);
    }

    schedulerError(message, meta = {}) {
        this.schedulerLogger.error(message, meta);
    }

    schedulerWarn(message, meta = {}) {
        this.schedulerLogger.warn(message, meta);
    }

    schedulerDebug(message, meta = {}) {
        this.schedulerLogger.debug(message, meta);
    }

    // App specific logging
    appInfo(message, meta = {}) {
        this.appLogger.info(message, meta);
    }

    appError(message, meta = {}) {
        this.appLogger.error(message, meta);
    }

    appWarn(message, meta = {}) {
        this.appLogger.warn(message, meta);
    }

    appDebug(message, meta = {}) {
        this.appLogger.debug(message, meta);
    }

    // Log message sending activity
    logMessageSent(phoneNumber, message, success = true, error = null) {
        const logData = {
            phoneNumber,
            messageLength: message.length,
            success,
            timestamp: new Date().toISOString()
        };

        if (error) {
            logData.error = error.message || error;
        }

        if (success) {
            this.whatsappInfo('Message sent successfully', logData);
        } else {
            this.whatsappError('Failed to send message', logData);
        }
    }

    // Log bulk sending activity
    logBulkSendingStart(contactCount, templateId) {
        this.whatsappInfo('Bulk sending started', {
            contactCount,
            templateId,
            timestamp: new Date().toISOString()
        });
    }

    logBulkSendingComplete(results) {
        this.whatsappInfo('Bulk sending completed', {
            total: results.total,
            success: results.success,
            failed: results.failed,
            timestamp: new Date().toISOString()
        });
    }

    // Log database operations
    logDatabaseOperation(operation, table, success = true, error = null) {
        const logData = {
            operation,
            table,
            success,
            timestamp: new Date().toISOString()
        };

        if (error) {
            logData.error = error.message || error;
        }

        if (success) {
            this.databaseInfo('Database operation completed', logData);
        } else {
            this.databaseError('Database operation failed', logData);
        }
    }

    // Log scheduler operations
    logScheduledTask(taskId, taskName, action, success = true, error = null) {
        const logData = {
            taskId,
            taskName,
            action,
            success,
            timestamp: new Date().toISOString()
        };

        if (error) {
            logData.error = error.message || error;
        }

        if (success) {
            this.schedulerInfo('Scheduled task executed', logData);
        } else {
            this.schedulerError('Scheduled task failed', logData);
        }
    }

    // Get recent logs
    getRecentLogs(level = 'info', limit = 100) {
        return new Promise((resolve, reject) => {
            const logFile = level === 'error' ? 'error.log' : 'combined.log';
            const logPath = path.join(__dirname, '../../data/logs', logFile);
            
            if (!fs.existsSync(logPath)) {
                resolve([]);
                return;
            }

            fs.readFile(logPath, 'utf8', (err, data) => {
                if (err) {
                    reject(err);
                    return;
                }

                const lines = data.trim().split('\n').filter(line => line.length > 0);
                const logs = lines.slice(-limit).map(line => {
                    try {
                        return JSON.parse(line);
                    } catch (e) {
                        return { message: line, timestamp: new Date().toISOString() };
                    }
                });

                resolve(logs);
            });
        });
    }

    // Clear old logs
    clearOldLogs(daysToKeep = 30) {
        const logsDir = path.join(__dirname, '../../data/logs');
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        fs.readdir(logsDir, (err, files) => {
            if (err) {
                this.error('Failed to read logs directory', { error: err.message });
                return;
            }

            files.forEach(file => {
                const filePath = path.join(logsDir, file);
                fs.stat(filePath, (err, stats) => {
                    if (err) {
                        this.error('Failed to get file stats', { file, error: err.message });
                        return;
                    }

                    if (stats.mtime < cutoffDate) {
                        fs.unlink(filePath, (err) => {
                            if (err) {
                                this.error('Failed to delete old log file', { file, error: err.message });
                            } else {
                                this.info('Deleted old log file', { file });
                            }
                        });
                    }
                });
            });
        });
    }
}

module.exports = { Logger };
