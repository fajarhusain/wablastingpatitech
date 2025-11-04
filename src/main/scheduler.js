const cron = require('node-cron');
const moment = require('moment');

class Scheduler {
    constructor(whatsappClient, database, logger) {
        this.whatsappClient = whatsappClient;
        this.database = database;
        this.logger = logger;
        this.scheduledTasks = new Map();
        this.isRunning = false;
        
        this.initialize();
    }

    initialize() {
        this.loadScheduledTasks();
        this.startScheduler();
    }

    startScheduler() {
        if (this.isRunning) {
            return;
        }

        this.isRunning = true;
        this.logger.schedulerInfo('Scheduler started');

        // Check for pending tasks every minute
        this.scheduledTasks.set('check-tasks', cron.schedule('* * * * *', () => {
            this.checkPendingTasks();
        }));

        // Clean up completed tasks daily at midnight
        this.scheduledTasks.set('cleanup-tasks', cron.schedule('0 0 * * *', () => {
            this.cleanupCompletedTasks();
        }));
    }

    stopScheduler() {
        if (!this.isRunning) {
            return;
        }

        this.scheduledTasks.forEach((task, name) => {
    try {
        if (task && typeof task.destroy === 'function') {
            // Untuk task yang berupa object dengan method destroy()
            task.destroy();
        } else if (task && task.timeoutId) {
            // Untuk task yang disimpan dengan setTimeout
            clearTimeout(task.timeoutId);
        } else if (typeof task === 'number') {
            // Untuk task yang berupa ID dari setInterval/setTimeout langsung
            clearTimeout(task);
            clearInterval(task);
        }

        this.logger.schedulerInfo(`Stopped scheduled task: ${name}`);
    } catch (err) {
        this.logger.schedulerError(`Gagal menghentikan task: ${name}`, err);
    }
});


        this.scheduledTasks.clear();
        this.isRunning = false;
        this.logger.schedulerInfo('Scheduler stopped');
    }

    async loadScheduledTasks() {
        try {
            const tasks = await this.database.getScheduledMessages();
            
            tasks.forEach(task => {
                if (task.status === 'pending' && moment(task.scheduled_time).isAfter(moment())) {
                    this.scheduleTask(task);
                }
            });

            this.logger.schedulerInfo(`Loaded ${tasks.length} scheduled tasks`);
        } catch (error) {
            this.logger.schedulerError('Failed to load scheduled tasks', { error: error.message });
        }
    }

    async addTask(taskData) {
        try {
            const { name, template_id, contacts, rules, scheduled_time } = taskData;
            
            // Validate scheduled time
            if (!moment(scheduled_time).isValid()) {
                throw new Error('Invalid scheduled time');
            }

            if (moment(scheduled_time).isBefore(moment())) {
                throw new Error('Scheduled time cannot be in the past');
            }

            // Save to database
            const result = await this.database.saveScheduledMessage({
                name,
                template_id,
                contacts: JSON.stringify(contacts),
                rules: JSON.stringify(rules),
                scheduled_time,
                status: 'pending'
            });

            // Schedule the task
            const task = {
                id: result.id,
                name,
                template_id,
                contacts,
                rules,
                scheduled_time,
                status: 'pending'
            };

            this.scheduleTask(task);
            
            this.logger.schedulerInfo('Task added successfully', { taskId: result.id, name });
            
            return { success: true, taskId: result.id };
        } catch (error) {
            this.logger.schedulerError('Failed to add task', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    scheduleTask(task) {
        const scheduledTime = moment(task.scheduled_time);
        const cronExpression = this.convertToCronExpression(scheduledTime);
        
        if (!cron.validate(cronExpression)) {
            this.logger.schedulerError('Invalid cron expression', { taskId: task.id, cronExpression });
            return;
        }

        const cronTask = cron.schedule(cronExpression, async () => {
            await this.executeTask(task);
        }, {
            scheduled: false,
            timezone: 'Asia/Jakarta'
        });

        cronTask.start();
        
        this.scheduledTasks.set(`task-${task.id}`, cronTask);
        
        this.logger.schedulerInfo('Task scheduled', {
            taskId: task.id,
            name: task.name,
            scheduledTime: scheduledTime.format('YYYY-MM-DD HH:mm:ss')
        });
    }

    convertToCronExpression(dateTime) {
        const minute = dateTime.minute();
        const hour = dateTime.hour();
        const day = dateTime.date();
        const month = dateTime.month() + 1; // moment months are 0-based
        const year = dateTime.year();
        
        return `${minute} ${hour} ${day} ${month} *`;
    }

    async executeTask(task) {
        try {
            this.logger.schedulerInfo('Executing scheduled task', { taskId: task.id, name: task.name });
            
            // Update task status to running
            await this.database.updateScheduledMessageStatus(task.id, 'running');
            
            // Get template
            const template = await this.database.getTemplate(task.template_id);
            if (!template) {
                throw new Error('Template not found');
            }

            // Get contacts
            const contacts = task.contacts;
            if (!contacts || contacts.length === 0) {
                throw new Error('No contacts specified');
            }

            // Prepare bulk message data
            const bulkMessageData = {
                contacts: contacts,
                template: template.content,
                rules: task.rules || [],
                delay: 3000 // Default delay
            };

            // Send bulk messages
            const result = await this.whatsappClient.sendBulkMessages(bulkMessageData);
            
            if (result.success) {
                // Update task status to completed
                await this.database.updateScheduledMessageStatus(task.id, 'completed');
                
                // Log analytics
                await this.database.updateAnalytics(moment().format('YYYY-MM-DD'), {
                    messages_sent: result.results.success,
                    messages_failed: result.results.failed,
                    contacts_processed: result.results.total
                });

                this.logger.schedulerInfo('Scheduled task completed successfully', {
                    taskId: task.id,
                    name: task.name,
                    results: result.results
                });
            } else {
                // Update task status to failed
                await this.database.updateScheduledMessageStatus(task.id, 'failed');
                
                this.logger.schedulerError('Scheduled task failed', {
                    taskId: task.id,
                    name: task.name,
                    error: result.message
                });
            }

            // Remove the cron task
            const cronTask = this.scheduledTasks.get(`task-${task.id}`);
            if (cronTask) {
                cronTask.destroy();
                this.scheduledTasks.delete(`task-${task.id}`);
            }

        } catch (error) {
            this.logger.schedulerError('Failed to execute scheduled task', {
                taskId: task.id,
                name: task.name,
                error: error.message
            });

            // Update task status to failed
            await this.database.updateScheduledMessageStatus(task.id, 'failed');
        }
    }

    async removeTask(taskId) {
        try {
            // Remove from database
            await this.database.updateScheduledMessageStatus(taskId, 'cancelled');
            
            // Remove cron task
            const cronTask = this.scheduledTasks.get(`task-${taskId}`);
            if (cronTask) {
                cronTask.destroy();
                this.scheduledTasks.delete(`task-${taskId}`);
            }

            this.logger.schedulerInfo('Task removed successfully', { taskId });
            
            return { success: true };
        } catch (error) {
            this.logger.schedulerError('Failed to remove task', { taskId, error: error.message });
            return { success: false, error: error.message };
        }
    }

    async getTasks() {
        try {
            const tasks = await this.database.getScheduledMessages();
            return tasks;
        } catch (error) {
            this.logger.schedulerError('Failed to get tasks', { error: error.message });
            return [];
        }
    }

    async checkPendingTasks() {
        try {
            const tasks = await this.database.getScheduledMessages();
            const now = moment();
            
            tasks.forEach(task => {
                if (task.status === 'pending' && moment(task.scheduled_time).isSameOrBefore(now)) {
                    this.executeTask(task);
                }
            });
        } catch (error) {
            this.logger.schedulerError('Failed to check pending tasks', { error: error.message });
        }
    }

    async cleanupCompletedTasks() {
        try {
            const tasks = await this.database.getScheduledMessages();
            const cutoffDate = moment().subtract(30, 'days'); // Keep completed tasks for 30 days
            
            for (const task of tasks) {
                if ((task.status === 'completed' || task.status === 'failed') && 
                    moment(task.created_at).isBefore(cutoffDate)) {
                    
                    // Remove from database (you might want to implement a soft delete)
                    // await this.database.deleteScheduledMessage(task.id);
                }
            }

            this.logger.schedulerInfo('Completed task cleanup finished');
        } catch (error) {
            this.logger.schedulerError('Failed to cleanup completed tasks', { error: error.message });
        }
    }

    // Utility methods
    getScheduledTasksCount() {
        return this.scheduledTasks.size;
    }

    isTaskScheduled(taskId) {
        return this.scheduledTasks.has(`task-${taskId}`);
    }

    // Schedule a one-time task
    async scheduleOneTimeTask(taskData) {
        const { name, template_id, contacts, rules, scheduled_time } = taskData;
        
        // Validate scheduled time
        if (!moment(scheduled_time).isValid()) {
            throw new Error('Invalid scheduled time');
        }

        if (moment(scheduled_time).isBefore(moment())) {
            throw new Error('Scheduled time cannot be in the past');
        }

        // Calculate delay in milliseconds
        const delay = moment(scheduled_time).diff(moment());
        
        // Schedule the task
        setTimeout(async () => {
            await this.executeTask({
                id: `temp-${Date.now()}`,
                name,
                template_id,
                contacts,
                rules,
                scheduled_time,
                status: 'pending'
            });
        }, delay);

        this.logger.schedulerInfo('One-time task scheduled', { name, scheduledTime: scheduled_time });
        
        return { success: true };
    }

    // Get next scheduled task
    async getNextScheduledTask() {
        try {
            const tasks = await this.database.getScheduledMessages();
            const pendingTasks = tasks.filter(task => task.status === 'pending');
            
            if (pendingTasks.length === 0) {
                return null;
            }

            // Sort by scheduled time
            pendingTasks.sort((a, b) => moment(a.scheduled_time).diff(moment(b.scheduled_time)));
            
            return pendingTasks[0];
        } catch (error) {
            this.logger.schedulerError('Failed to get next scheduled task', { error: error.message });
            return null;
        }
    }
}

module.exports = { Scheduler };
