/**
 * Cache Manager
 * Handles data caching and refresh logic
 */

const SalesDoctorAPI = require('./salesDoctorAPI');
const config = require('./config');

class CacheManager {
    constructor() {
        this.api = new SalesDoctorAPI();
        this.cache = {
            dashboard: null,
            lastUpdate: null,
            isRefreshing: false
        };
        this.refreshTimer = null;
    }

    /**
     * Start automatic refresh
     */
    startAutoRefresh() {
        console.log('🔄 Starting auto-refresh...');

        // Initial refresh
        this.refreshCache();

        // Schedule periodic refresh
        this.scheduleNextRefresh();
    }

    /**
     * Schedule next refresh based on time
     */
    scheduleNextRefresh() {
        const interval = config.getCurrentRefreshInterval();
        const minutes = interval / 60000;

        console.log(`⏰ Next refresh in ${minutes} minutes (${config.isNightTime() ? 'NIGHT' : 'DAY'} mode)`);

        if (this.refreshTimer) clearTimeout(this.refreshTimer);

        this.refreshTimer = setTimeout(() => {
            this.refreshCache();
            this.scheduleNextRefresh();
        }, interval);
    }

    /**
     * Refresh cache data
     */
    async refreshCache() {
        if (this.cache.isRefreshing) {
            console.log('⏳ Refresh already in progress...');
            return;
        }

        this.cache.isRefreshing = true;
        const startTime = Date.now();

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔄 CACHE REFRESH STARTED');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        try {
            // MUHIM: Avval autentifikatsiya qilamiz (parallel requestlar uchun)
            console.log('🔐 Autentifikatsiya...');
            await this.api.authenticate();

            // Fetch all data in parallel (token tayyor)
            const [orders, costPrices, totalProducts, totalClients, balances, payments] = await Promise.all([
                this.api.fetchAllOrders(),
                this.api.fetchCostPrices(),
                this.api.fetchTotalProducts(),
                this.api.fetchTotalClients(),
                this.api.fetchAllBalances(),
                this.api.fetchAllPayments()
            ]);

            // Calculate dashboard stats
            const dashboardData = this.calculateDashboardStats(
                orders,
                costPrices,
                totalProducts,
                totalClients,
                balances,
                payments
            );

            // Update cache
            this.cache.dashboard = dashboardData;
            this.cache.lastUpdate = new Date().toISOString();

            const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`✅ CACHE REFRESHED in ${elapsed}s`);
            console.log(`   Orders: ${orders.length}`);
            console.log(`   Clients: ${totalClients}`);
            console.log(`   Products: ${totalProducts}`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        } catch (error) {
            console.error('❌ CACHE REFRESH FAILED:', error);
        } finally {
            this.cache.isRefreshing = false;
        }
    }

    /**
     * Calculate dashboard statistics
     */
    calculateDashboardStats(orders, costPrices, totalProducts, totalClients, balances, payments) {
        const USD_RATE = config.DEFAULT_USD_RATE;

        // Initialize stats
        let stats = {
            sales: { uzs: 0, usd: 0 },
            orders: 0,
            clients: { total: totalClients, active: 0 },
            products: totalProducts,
            profit: { uzs: 0, usd: 0 },
            iroda: { uzs: 0, usd: 0 },
            debt: { som: 0, dollar: 0, naqd: 0, beznal: 0 },
            topProducts: [],
            topAgents: []
        };

        // Filter orders for current period (last 30 days for now)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentOrders = orders.filter(order => {
            const orderDate = new Date(order.dateCreate || order.dateDocument || order.orderCreated);
            return orderDate >= thirtyDaysAgo && !order.status?.name?.toLowerCase().includes('возврат');
        });

        stats.orders = recentOrders.length;

        // Track active clients
        const activeClients = new Set();
        const productStats = {};
        const agentStats = {};

        // Calculate from orders
        recentOrders.forEach(order => {
            const clientId = order.client?.SD_id;
            if (clientId) activeClients.add(clientId);

            const orderSumma = parseFloat(order.totalSumma) || 0;
            const orderSummaUZS = orderSumma > 100 ? orderSumma : orderSumma * USD_RATE;

            stats.sales.uzs += orderSummaUZS;

            if (orderSumma <= 100) {
                stats.sales.usd += orderSumma;
            }

            // Agent stats
            const agentId = order.agent?.SD_id;
            if (agentId) {
                if (!agentStats[agentId]) {
                    agentStats[agentId] = {
                        name: order.agent?.name || agentId,
                        sales: 0,
                        profit: 0,
                        clients: new Set()
                    };
                }
                agentStats[agentId].sales += orderSummaUZS;
                if (clientId) agentStats[agentId].clients.add(clientId);
            }

            // Product stats and profit
            (order.orderProducts || []).forEach(item => {
                const productId = item.product?.SD_id;
                const productName = item.product?.name || 'Unknown';
                const quantity = parseFloat(item.quantity) || 0;
                const rawSumma = parseFloat(item.summa) || 0;
                const itemSummaUZS = rawSumma > 100 ? rawSumma : rawSumma * USD_RATE;

                const costData = costPrices[productId];
                const costPriceUZS = costData?.costPriceUZS || 0;

                let profit = 0;
                if (costPriceUZS > 0) {
                    profit = Math.max(0, itemSummaUZS - (costPriceUZS * quantity));
                } else {
                    profit = itemSummaUZS; // Bonus - full price as profit
                }

                stats.profit.uzs += profit;
                if (agentId && agentStats[agentId]) {
                    agentStats[agentId].profit += profit;
                }

                // Product aggregation
                if (!productStats[productId]) {
                    productStats[productId] = {
                        name: productName,
                        sold: 0,
                        revenue: 0,
                        profit: 0
                    };
                }
                productStats[productId].sold += quantity;
                productStats[productId].revenue += itemSummaUZS;
                productStats[productId].profit += profit;
            });
        });

        stats.clients.active = activeClients.size;
        stats.profit.usd = Math.round(stats.profit.uzs / USD_RATE);

        // Top 5 products
        stats.topProducts = Object.values(productStats)
            .sort((a, b) => b.sold - a.sold)
            .slice(0, 5)
            .map(p => ({
                name: p.name,
                sold: p.sold,
                revenue: Math.round(p.revenue),
                profit: Math.round(p.profit)
            }));

        // Top 5 agents
        stats.topAgents = Object.entries(agentStats)
            .map(([id, a]) => ({
                name: a.name,
                sales: Math.round(a.sales),
                clients: a.clients.size,
                profit: Math.round(a.profit)
            }))
            .sort((a, b) => b.sales - a.sales)
            .slice(0, 5);

        // Calculate debts from balances
        balances.forEach(bal => {
            const balanceValue = parseFloat(bal.balance) || 0;
            const currency = bal.currency?.name || '';

            if (currency.includes('UZS') || currency.includes('Сум')) {
                stats.debt.som += balanceValue;

                const paymentType = bal.paymentType?.name || '';
                if (paymentType.toLowerCase().includes('нал') || paymentType.toLowerCase().includes('наличн')) {
                    stats.debt.naqd += balanceValue;
                } else {
                    stats.debt.beznal += balanceValue;
                }
            } else if (currency.includes('USD') || currency.includes('$')) {
                stats.debt.dollar += balanceValue;
            }
        });

        // Iroda agents calculation (placeholder - you can specify IDs)
        const irodaAgentIds = ['d0_10', 'd0_11', 'd0_15']; // Example IDs
        Object.entries(agentStats).forEach(([id, data]) => {
            if (irodaAgentIds.includes(id)) {
                stats.iroda.uzs += data.sales;
            }
        });
        stats.iroda.usd = Math.round(stats.iroda.uzs / USD_RATE);

        return stats;
    }

    /**
     * Get cached data
     */
    getCachedData() {
        if (!this.cache.dashboard) {
            return {
                error: 'Cache not ready yet',
                message: 'Please wait for initial data load...'
            };
        }

        const age = Date.now() - new Date(this.cache.lastUpdate).getTime();
        const isFresh = age < config.CACHE_TTL;

        return {
            data: this.cache.dashboard,
            meta: {
                lastUpdate: this.cache.lastUpdate,
                age: Math.round(age / 1000), // seconds
                isFresh,
                nextRefresh: Math.round((config.getCurrentRefreshInterval() - age) / 1000)
            }
        };
    }

    /**
     * Stop auto-refresh
     */
    stop() {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            console.log('🛑 Auto-refresh stopped');
        }
    }
}

module.exports = CacheManager;
