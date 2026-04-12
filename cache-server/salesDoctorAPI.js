/**
 * Sales Doctor API Client
 * Handles all API requests to Sales Doctor
 */

const fetch = require('node-fetch');
const config = require('./config');

class SalesDoctorAPI {
    constructor() {
        this.server = config.SALES_DOCTOR.SERVER;
        this.login = config.SALES_DOCTOR.LOGIN;
        this.password = config.SALES_DOCTOR.PASSWORD;
        this.userId = null;
        this.token = null;
    }

    /**
     * Authenticate and get userId + token
     */
    async authenticate() {
        try {
            const response = await fetch(`https://${this.server}/api/v2/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    method: 'login',
                    auth: {
                        login: this.login,
                        password: this.password
                    }
                })
            });

            const data = await response.json();

            if (data.status === true && data.result?.userId && data.result?.token) {
                this.userId = data.result.userId;
                this.token = data.result.token;
                console.log(`✅ Sales Doctor API authenticated - userId: ${this.userId}`);
                return true;
            } else {
                console.error('❌ Authentication failed:', data.error || data);
                return false;
            }
        } catch (error) {
            console.error('❌ Auth error:', error.message);
            return false;
        }
    }

    /**
     * Make API request
     */
    async request(method, params = {}, retryCount = 0) {
        if (!this.userId || !this.token) {
            const authenticated = await this.authenticate();
            if (!authenticated) throw new Error('Authentication failed');
        }

        try {
            const requestBody = {
                method,
                auth: {
                    userId: this.userId,
                    token: this.token
                },
                params
            };

            const response = await fetch(`https://${this.server}/api/v2/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            // Token expired - re-authenticate (max 1 retry)
            if (data.status === false && retryCount < 1) {
                const errorStr = typeof data.error === 'string' ? data.error : '';
                if (errorStr.includes('авторизоваться') || errorStr.includes('token') || errorStr.includes('auth')) {
                    console.log('🔄 Token expired, re-authenticating...');
                    this.userId = null;
                    this.token = null;
                    return this.request(method, params, retryCount + 1);
                }
            }

            return data;
        } catch (error) {
            console.error(`❌ API request error (${method}):`, error.message);
            throw error;
        }
    }

    /**
     * Fetch all orders with pagination
     */
    async fetchAllOrders() {
        const allOrders = [];
        let page = 1;
        const limit = 1000;

        console.log('📥 Fetching all orders...');

        while (page <= 20) {
            try {
                const data = await this.request('getOrder', {
                    filter: { status: 'all' },
                    page,
                    limit
                });

                const orders = data.result?.order || [];
                if (orders.length === 0) break;

                console.log(`  📦 Page ${page}: ${orders.length} orders`);
                allOrders.push(...orders);

                if (orders.length < limit) break;
                page++;
            } catch (error) {
                console.error(`Error fetching page ${page}:`, error.message);
                break;
            }
        }

        console.log(`✅ Total: ${allOrders.length} orders`);
        return allOrders;
    }

    /**
     * Fetch cost prices (purchase data)
     */
    async fetchCostPrices() {
        try {
            let allPurchases = [];
            for (let page = 1; page <= 10; page++) {
                const data = await this.request('getPurchase', { page, limit: 500 });
                const purchases = data.result?.warehouse || data.result?.purchase || [];
                if (purchases.length === 0) break;
                allPurchases = allPurchases.concat(purchases);
                if (purchases.length < 500) break;
            }

            const costPrices = {};
            const USD_RATE = config.DEFAULT_USD_RATE;

            allPurchases.forEach(p => {
                (p.detail || [p]).forEach(item => {
                    const productId = item.SD_id || item.product?.SD_id;
                    if (!productId) return;

                    const rawPrice = parseFloat(item.price || p.price) || 0;
                    if (rawPrice <= 0) return;
                    const costPriceUZS = rawPrice < 100 ? rawPrice * USD_RATE : rawPrice;

                    if (!costPrices[productId] || costPrices[productId].costPriceUZS < costPriceUZS) {
                        costPrices[productId] = {
                            costPriceUZS,
                            originalPrice: rawPrice
                        };
                    }
                });
            });

            console.log(`✅ Cost prices: ${Object.keys(costPrices).length} products`);
            return costPrices;
        } catch (error) {
            console.error('Error fetching cost prices:', error.message);
            return {};
        }
    }

    /**
     * Fetch total counts
     */
    async fetchTotalProducts() {
        try {
            let total = 0;
            let page = 1;
            while (page <= 10) {
                const data = await this.request('getProduct', { limit: 1000, page });
                const products = data.result?.product || [];
                if (products.length === 0) break;
                total += products.length;
                if (products.length < 1000) break;
                page++;
            }
            return total;
        } catch {
            return 0;
        }
    }

    async fetchTotalClients() {
        try {
            let total = 0;
            let page = 1;
            while (page <= 10) {
                const data = await this.request('getClient', { limit: 1000, page });
                const clients = data.result?.client || [];
                if (clients.length === 0) break;
                total += clients.length;
                if (clients.length < 1000) break;
                page++;
            }
            return total;
        } catch {
            return 0;
        }
    }

    /**
     * Fetch balances and payments
     */
    async fetchAllBalances() {
        try {
            const data = await this.request('getBalance', {});
            return data.result?.balance || [];
        } catch {
            return [];
        }
    }

    async fetchAllPayments() {
        const allPayments = [];
        let page = 1;
        const limit = 1000;

        while (page <= 10) {
            try {
                const data = await this.request('getPayment', { page, limit });
                const payments = data.result?.payment || [];
                if (payments.length === 0) break;

                allPayments.push(...payments);
                if (payments.length < limit) break;
                page++;
            } catch {
                break;
            }
        }

        return allPayments;
    }
}

module.exports = SalesDoctorAPI;
