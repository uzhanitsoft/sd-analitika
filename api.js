/**
 * Sales Doctor API Wrapper
 * Public API integration for Sales Doctor system
 */

class SalesDoctorAPI {
    constructor() {
        this.config = this.loadConfig();
        this.isAuthenticated = false;
    }

    loadConfig() {
        const saved = localStorage.getItem('sd_api_config');
        if (saved) {
            return JSON.parse(saved);
        }
        // Default credentials - so app works out of the box
        return {
            serverUrl: 'rafiq.salesdoc.io',
            login: 'admin',
            password: '1234567rafiq',
            userId: 'd0_67',
            token: '4415b6af76b4ccc48f7f1120c917368c'
        };
    }

    saveConfig(config) {
        this.config = { ...this.config, ...config };
        localStorage.setItem('sd_api_config', JSON.stringify(this.config));
    }

    isConfigured() {
        return this.config.serverUrl && this.config.userId && this.config.token;
    }

    hasCredentials() {
        return this.config.serverUrl && this.config.login && this.config.password;
    }

    // Login to get userId and token (via proxy)
    async login(login, password, serverUrl) {
        const server = serverUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

        try {
            // Proxy server orqali so'rov yuborish
            const response = await fetch('https://sd-analitika-production.up.railway.app/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    serverUrl: server,
                    login: login,
                    password: password
                })
            });

            if (!response.ok) {
                throw new Error(`Server xatosi: ${response.status}`);
            }

            const data = await response.json();

            if (data.status === true && data.result) {
                // Save credentials
                this.saveConfig({
                    serverUrl: server,
                    login: login,
                    password: password,
                    userId: data.result.userId,
                    token: data.result.token
                });
                this.isAuthenticated = true;
                return { success: true, data: data.result };
            } else {
                // Error obyekt bo'lishi mumkin - xabarni olish
                let errorMsg = 'Login yoki parol noto\'g\'ri';
                if (data.error) {
                    if (typeof data.error === 'string') {
                        errorMsg = data.error;
                    } else if (data.error.message) {
                        errorMsg = data.error.message;
                    }
                }
                return { success: false, error: errorMsg };
            }
        } catch (error) {
            console.error('Login xatosi:', error);
            return { success: false, error: error.message };
        }
    }

    // Make authenticated API request (via proxy)
    async request(method, params = {}) {
        if (!this.isConfigured()) {
            throw new Error('API avtorizatsiya qilinmagan');
        }

        const body = {
            auth: {
                userId: this.config.userId,
                token: this.config.token
            },
            method: method,
            params: params
        };

        try {
            const response = await fetch('https://sd-analitika-production.up.railway.app/api/proxy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    serverUrl: this.config.serverUrl,
                    body: body
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP xato: ${response.status}`);
            }

            const data = await response.json();

            // Token eskirgan bo'lsa, qayta login qilamiz
            if (data.status === false && data.error?.code === 401) {
                console.log('Token eskirgan, qayta login qilamiz...');
                if (this.hasCredentials()) {
                    const loginResult = await this.login(this.config.login, this.config.password, this.config.serverUrl);
                    if (loginResult.success) {
                        // Yangi token bilan qayta so'rov yuboramiz
                        return this.request(method, params);
                    }
                }
                throw new Error('Token eskirgan. Qayta login qiling.');
            }

            if (data.status === false) {
                throw new Error(data.error?.message || data.error || 'API xatosi');
            }

            return data;
        } catch (error) {
            console.error('API so\'rov xatosi:', error);
            throw error;
        }
    }

    // Sales Methods
    async getSales(params = {}) {
        return this.request('getSales', {
            page: params.page || 1,
            limit: params.limit || 50,
            filter: params.filter || {},
            period: params.period || {}
        });
    }

    // Products Methods
    async getProducts(params = {}) {
        return this.request('getProduct', {
            page: params.page || 1,
            limit: params.limit || 50,
            filter: params.filter || {}
        });
    }

    // Clients Methods  
    async getClients(params = {}) {
        return this.request('getClient', {
            page: params.page || 1,
            limit: params.limit || 50,
            filter: params.filter || {}
        });
    }

    // Orders Methods - MUHIM: filter.status: 'all' barcha statusdagi buyurtmalarni olish uchun
    async getOrders(params = {}) {
        // Default filter - barcha statuslar (shipped, delivered, new, etc.)
        const defaultFilter = { status: 'all' };
        const mergedFilter = { ...defaultFilter, ...(params.filter || {}) };

        return this.request('getOrder', {
            page: params.page || 1,
            limit: params.limit || 1000, // Ko'proq buyurtma olish uchun
            filter: mergedFilter,
            period: params.period || {}
        });
    }

    // Barcha buyurtmalarni olish (pagination bilan)
    async getAllOrders(params = {}) {
        let allOrders = [];
        let page = 1;
        let hasMore = true;
        const limit = 1000;

        while (hasMore) {
            const data = await this.getOrders({
                ...params,
                page: page,
                limit: limit,
                filter: { status: 'all', ...(params.filter || {}) }
            });

            if (data.result?.order && data.result.order.length > 0) {
                allOrders = allOrders.concat(data.result.order);
                if (data.result.order.length < limit) {
                    hasMore = false;
                } else {
                    page++;
                }
            } else {
                hasMore = false;
            }

            // Maximum 20 sahifa (xavfsizlik uchun)
            if (page > 20) hasMore = false;
        }

        return { result: { order: allOrders } };
    }

    // Warehouse/Stock Methods
    async getStock(params = {}) {
        return this.request('getStock', params);
    }

    async getWarehouse(params = {}) {
        return this.request('getWarehouse', params);
    }

    // Reports
    async getReport(reportType, params = {}) {
        return this.request(reportType, params);
    }

    // Payments (To'lovlar)
    async getPayments(params = {}) {
        return this.request('getPayment', params);
    }

    // Balances (Qarzdorlik)
    async getBalances(params = {}) {
        return this.request('getBalance', params);
    }

    // Logout - clear credentials
    logout() {
        this.config = {
            serverUrl: this.config.serverUrl,
            login: '',
            password: '',
            userId: '',
            token: ''
        };
        localStorage.removeItem('sd_api_config');
        this.isAuthenticated = false;
    }
}

// Demo data generator for testing without API
class DemoDataGenerator {
    constructor() {
        this.productNames = [
            'Coca-Cola 1L', 'Pepsi 2L', 'Sprite 1.5L', 'Fanta 0.5L', 'Mirinda 1L',
            'Snickers 50g', 'Mars 45g', 'Twix 40g', 'KitKat 35g', 'Bounty 55g',
            'Lay\'s Classic 150g', 'Pringles Original', 'Doritos Nacho', 'Cheetos 90g',
            'Nestle Water 1.5L', 'Aquafina 0.5L', 'Bonaqua 1L'
        ];

        this.agentNames = [
            'Akmal Karimov', 'Sardor Rahimov', 'Jamshid Toshev', 'Bekzod Umarov',
            'Dilshod Qodirov', 'Otabek Nazarov', 'Shoxrux Aliyev', 'Nodir Saidov'
        ];

        this.categories = [
            { name: 'Ichimliklar', color: '#0071e3' },
            { name: 'Shirinliklar', color: '#34c759' },
            { name: 'Sneklar', color: '#ff9500' },
            { name: 'Suv', color: '#5ac8fa' },
            { name: 'Boshqa', color: '#af52de' }
        ];
    }

    randomNumber(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    getDashboardStats() {
        return {
            totalSales: this.randomNumber(150000000, 500000000),
            totalOrders: this.randomNumber(1500, 5000),
            totalClients: this.randomNumber(800, 2000),
            totalProducts: this.randomNumber(150, 400)
        };
    }

    getSparklineData(count = 7) {
        const data = [];
        let value = this.randomNumber(50, 100);
        for (let i = 0; i < count; i++) {
            value = Math.max(10, Math.min(100, value + this.randomNumber(-20, 20)));
            data.push(value);
        }
        return data;
    }

    getRevenueChartData(days = 30) {
        const labels = [];
        const revenue = [];
        const orders = [];
        const profit = [];

        const now = new Date();
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' }));

            const rev = this.randomNumber(5000000, 20000000);
            revenue.push(rev);
            orders.push(this.randomNumber(50, 200));
            profit.push(Math.floor(rev * 0.15));
        }

        return { labels, revenue, orders, profit };
    }

    getCategoryData() {
        return this.categories.map(cat => ({
            name: cat.name,
            color: cat.color,
            value: this.randomNumber(10, 30)
        }));
    }

    getTopProducts(count = 5) {
        const products = [];
        const usedNames = new Set();

        while (products.length < count) {
            const name = this.productNames[this.randomNumber(0, this.productNames.length - 1)];
            if (!usedNames.has(name)) {
                usedNames.add(name);
                products.push({
                    name: name,
                    sold: this.randomNumber(500, 3000),
                    revenue: this.randomNumber(5000000, 50000000),
                    trend: Math.random() > 0.3 ? 'up' : 'down',
                    trendValue: this.randomNumber(1, 25)
                });
            }
        }

        return products.sort((a, b) => b.revenue - a.revenue);
    }

    getTopAgents(count = 5) {
        const agents = [];
        const usedNames = new Set();

        while (agents.length < count) {
            const name = this.agentNames[this.randomNumber(0, this.agentNames.length - 1)];
            if (!usedNames.has(name)) {
                usedNames.add(name);
                agents.push({
                    name: name,
                    initials: name.split(' ').map(n => n[0]).join(''),
                    sales: this.randomNumber(50000000, 200000000),
                    clients: this.randomNumber(50, 200),
                    rating: (3.5 + Math.random() * 1.5).toFixed(1)
                });
            }
        }

        return agents.sort((a, b) => b.sales - a.sales);
    }

    getRecentActivity(count = 10) {
        const types = [
            { type: 'sale', icon: 'sale', title: 'Yangi sotuv' },
            { type: 'order', icon: 'order', title: 'Yangi buyurtma' },
            { type: 'client', icon: 'client', title: 'Yangi mijoz' },
            { type: 'product', icon: 'product', title: 'Mahsulot yangilandi' }
        ];

        const activities = [];
        const now = new Date();

        for (let i = 0; i < count; i++) {
            const typeInfo = types[this.randomNumber(0, types.length - 1)];
            const minutesAgo = this.randomNumber(1, 300);
            const time = new Date(now - minutesAgo * 60000);

            let description = '';
            switch (typeInfo.type) {
                case 'sale':
                    description = `${this.agentNames[this.randomNumber(0, this.agentNames.length - 1)]} ${this.randomNumber(100, 5000).toLocaleString()} ming so'm sotdi`;
                    break;
                case 'order':
                    description = `Buyurtma #${this.randomNumber(10000, 99999)} tasdiqlandi`;
                    break;
                case 'client':
                    description = `"${['Premium Market', 'Supermarket A', 'Minimarket B', 'Dokon C'][this.randomNumber(0, 3)]}" qo'shildi`;
                    break;
                case 'product':
                    description = `${this.productNames[this.randomNumber(0, this.productNames.length - 1)]} narxi yangilandi`;
                    break;
            }

            activities.push({
                ...typeInfo,
                description,
                time: this.formatRelativeTime(time)
            });
        }

        return activities;
    }

    formatRelativeTime(date) {
        const now = new Date();
        const diff = Math.floor((now - date) / 60000);

        if (diff < 1) return 'Hozirgina';
        if (diff < 60) return `${diff} daqiqa oldin`;
        if (diff < 1440) return `${Math.floor(diff / 60)} soat oldin`;
        return `${Math.floor(diff / 1440)} kun oldin`;
    }
}

// Export for use
window.SalesDoctorAPI = SalesDoctorAPI;
window.DemoDataGenerator = DemoDataGenerator;
