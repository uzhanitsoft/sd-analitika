/**
 * Sales Doctor Cache Server
 * Fast API backend for analytics dashboard
 */

const express = require('express');
const cors = require('cors');
const config = require('./config');
const CacheManager = require('./cache');

const app = express();
const cache = new CacheManager();

// Middleware
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);

        // Check if origin is allowed
        const isAllowed = config.CORS_ORIGINS.some(allowed => {
            if (allowed.includes('*')) {
                const pattern = allowed.replace('*', '.*');
                return new RegExp(pattern).test(origin);
            }
            return allowed === origin;
        });

        callback(null, isAllowed);
    },
    credentials: true
}));

app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// ============ API ENDPOINTS ============

/**
 * GET / - Health check
 */
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'Sales Doctor Cache Server',
        version: '1.0.0',
        endpoints: {
            dashboard: '/api/dashboard',
            refresh: '/api/refresh',
            health: '/api/health'
        }
    });
});

/**
 * GET /api/health - Server health
 */
app.get('/api/health', (req, res) => {
    const cachedData = cache.getCachedData();

    res.json({
        status: 'healthy',
        cache: {
            ready: !cachedData.error,
            lastUpdate: cachedData.meta?.lastUpdate || null,
            age: cachedData.meta?.age || null,
            nextRefresh: cachedData.meta?.nextRefresh || null
        },
        config: {
            refreshInterval: config.getCurrentRefreshInterval() / 60000 + ' minutes',
            nightMode: config.isNightTime()
        },
        uptime: process.uptime()
    });
});

/**
 * GET /api/dashboard - Get cached dashboard data
 */
app.get('/api/dashboard', (req, res) => {
    const result = cache.getCachedData();

    if (result.error) {
        return res.status(503).json({
            error: result.error,
            message: result.message
        });
    }

    res.json(result);
});

/**
 * POST /api/refresh - Manual cache refresh
 */
app.post('/api/refresh', async (req, res) => {
    // Return immediately but start refresh in background
    res.json({
        status: 'refresh initiated',
        message: 'Cache refresh started in background'
    });

    // Start refresh (don't await)
    cache.refreshCache().catch(err => {
        console.error('Manual refresh error:', err);
    });
});

/**
 * GET /api/stats - Quick stats (without full data)
 */
app.get('/api/stats', (req, res) => {
    const result = cache.getCachedData();

    if (result.error) {
        return res.status(503).json({ error: result.error });
    }

    // Return only summary stats
    const { sales, orders, clients, products, profit } = result.data;

    res.json({
        sales,
        orders,
        clients,
        products,
        profit,
        meta: result.meta
    });
});

// ============ ERROR HANDLING ============

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Endpoint ${req.path} not found`
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message
    });
});

// ============ START SERVER ============

const PORT = config.PORT;

app.listen(PORT, () => {
    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║     🏥 Sales Doctor Cache Server               ║');
    console.log('╠════════════════════════════════════════════════╣');
    console.log(`║  🌐 Server: http://localhost:${PORT}              ║`);
    console.log(`║  📊 API Ready: /api/dashboard                  ║`);
    console.log(`║  🔄 Refresh: Every ${config.getCurrentRefreshInterval() / 60000} minutes         ║`);
    console.log('╚════════════════════════════════════════════════╝\n');

    // Start auto-refresh
    cache.startAutoRefresh();
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('\n🛑 SIGTERM received, shutting down gracefully...');
    cache.stop();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n🛑 SIGINT received, shutting down gracefully...');
    cache.stop();
    process.exit(0);
});

module.exports = app;
