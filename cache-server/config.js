/**
 * Cache Server Configuration
 */

module.exports = {
    // Server sozlamalari
    PORT: process.env.PORT || 3003,

    // Cache yangilanish intervallari (milliseconds)
    REFRESH_INTERVALS: {
        DASHBOARD: 10 * 60 * 1000,      // 10 daqiqa
        NIGHT_MODE: 30 * 60 * 1000,     // Tunda 30 daqiqa (0:00-6:00)
    },

    // Sales Doctor API credentials
    SALES_DOCTOR: {
        SERVER: process.env.SD_SERVER || 'rafiq.salesdoc.io',
        LOGIN: process.env.SD_LOGIN || 'admin',
        PASSWORD: process.env.SD_PASSWORD || '1234567rafiq'
    },

    // Cache TTL (Time To Live)
    CACHE_TTL: 15 * 60 * 1000, // 15 daqiqa (eski ma'lumot sanalmaydi)

    // USD kursi
    DEFAULT_USD_RATE: 12200,

    // CORS sozlamalari
    CORS_ORIGINS: [
        'http://localhost:3000',
        'http://localhost:5173',
        'https://sd-analitika-production.up.railway.app',
        'https://*.railway.app'
    ],

    // Logging
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',

    // Tunda sekinroq yangilash (0:00 - 6:00)
    isNightTime() {
        const hour = new Date().getHours();
        return hour >= 0 && hour < 6;
    },

    // Hozirgi refresh interval
    getCurrentRefreshInterval() {
        return this.isNightTime()
            ? this.REFRESH_INTERVALS.NIGHT_MODE
            : this.REFRESH_INTERVALS.DASHBOARD;
    }
};
