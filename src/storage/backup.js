const BACKUP_REMINDER_KEY = "openmcat_backup_reminder_v1";

const getNextLocalDay = (days, now = new Date()) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + days).getTime();

const loadNextReminderAt = () => {
    if (typeof localStorage === "undefined") return 0;
    try {
        const value = Number(localStorage.getItem(BACKUP_REMINDER_KEY));
        return Number.isFinite(value) ? value : 0;
    } catch (error) { console.warn("OpenMCAT: failed to load the data backup reminder.", error); return 0; }
};

const saveNextReminderAt = (timestamp) => {
    if (typeof localStorage === "undefined") return;
    try { localStorage.setItem(BACKUP_REMINDER_KEY, String(timestamp)); } catch (error) { console.warn("OpenMCAT: failed to save the data backup reminder.", error); }
};

export const isBackupReminderDue = (now = new Date()) => now.getTime() >= loadNextReminderAt();

export const remindAboutBackupTomorrow = (now = new Date()) => saveNextReminderAt(getNextLocalDay(1, now));

export const remindAboutBackupNextWeek = (now = new Date()) => saveNextReminderAt(getNextLocalDay(7, now));
