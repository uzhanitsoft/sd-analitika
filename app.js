/**
 * Sales Doctor Analytics Dashboard
 * Main Application Logic with Real API Integration
 */
console.log('📊 app.js v54 yuklandi!');

class SalesDoctorApp {
    constructor() {
        this.api = new SalesDoctorAPI();
        this.demo = new DemoDataGenerator(); // Sparklines uchun
        this.charts = {};
        this.currentPeriod = 'today';
        this.useRealData = true; // API avtomatik yoqilgan
        this.cachedCostPrices = null; // Har safar yangi ma'lumot olish uchun


        // 🚀 CACHE - tezlashtirish uchun
        this.cache = {
            orders: null,           // Barcha buyurtmalar
            products: null,         // Barcha mahsulotlar
            clients: null,          // Barcha mijozlar
            lastUpdate: null,       // Oxirgi yangilanish vaqti
            dashboardDays: 30       // Dashboard uchun kunlar soni (legacy)
        };

        // 💾 LocalStorage cache kalitlari
        this.CACHE_KEYS = {
            ORDERS: 'sd_cache_orders',
            STATS: 'sd_cache_stats',
            DEBTS: 'sd_cache_debts',
            TIMESTAMP: 'sd_cache_timestamp'
        };
        this.CACHE_TTL = 5 * 60 * 1000; // 5 daqiqa (milliseconds)

        this.init();
    }

    // 💾 LocalStorage cache metodlari
    saveToCache(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            localStorage.setItem(this.CACHE_KEYS.TIMESTAMP, Date.now().toString());
            console.log(`💾 Cache saqlandi: ${key}`);
        } catch (e) {
            console.warn('Cache saqlash xatosi:', e);
        }
    }

    loadFromCache(key) {
        try {
            const data = localStorage.getItem(key);
            if (!data) return null;

            const timestamp = parseInt(localStorage.getItem(this.CACHE_KEYS.TIMESTAMP) || '0');
            const age = Date.now() - timestamp;

            // Cache 5 daqiqadan eski bo'lsa ham ko'rsatamiz, lekin yangilaymiz
            console.log(`📂 Cache yuklandi: ${key} (${Math.round(age / 1000)}s oldin)`);
            return JSON.parse(data);
        } catch (e) {
            console.warn('Cache yuklash xatosi:', e);
            return null;
        }
    }

    isCacheFresh() {
        const timestamp = parseInt(localStorage.getItem(this.CACHE_KEYS.TIMESTAMP) || '0');
        return (Date.now() - timestamp) < this.CACHE_TTL;
    }

    getCacheBaseUrl() {
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        return isLocal ? 'http://localhost:3000' : 'https://sd-analitika-production.up.railway.app';
    }

    init() {
        // Safety timeout - 10 sekund ichida loading yashiriladi
        setTimeout(() => {
            this.hideLoading();
            console.log('⏰ Loading timeout - forcefully hidden');
        }, 10000);

        try {
            this.setupTheme();
            this.setupEventListeners();

            // api.js da default credentials mavjud - avtomatik yuklash
            if (this.api.isConfigured()) {
                console.log('✅ API konfiguratsiya topildi - Dashboard yuklanmoqda...');
                this.loadDashboard().catch(error => {
                    console.error('❌ Dashboard yuklash xatosi:', error);
                    this.hideLoading();
                    this.showEmptyStats();
                });
            } else {
                console.log('⚠️ API sozlanmagan');
                this.hideLoading();
                this.showEmptyStats();
            }
        } catch (error) {
            console.error('❌ Init xatosi:', error);
            this.hideLoading();
            this.showEmptyStats();
        }
    }

    // Bo'sh statistika ko'rsatish
    showEmptyStats() {
        // Safely update if elements exist
        const updateIfExists = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };

        updateIfExists('totalSalesUZS', '0');
        updateIfExists('totalSalesUSD', '0');
        updateIfExists('totalOrders', '0');
        updateIfExists('totalClientsOKB', '0');
        updateIfExists('totalClientsAKB', '0');
        updateIfExists('totalProducts', '0');

        console.log('📊 Empty stats shown (elements may not exist)');
    }

    // Theme Management
    setupTheme() {
        const savedTheme = localStorage.getItem('sd_theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
    }

    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const newTheme = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('sd_theme', newTheme);
        this.updateChartColors();
    }

    // Event Listeners
    setupEventListeners() {
        // Theme toggle
        document.getElementById('themeToggle')?.addEventListener('click', () => this.toggleTheme());

        // 🔄 Refresh button - cache tozalash va qayta yuklash
        document.getElementById('refreshBtn')?.addEventListener('click', (e) => {
            const btn = e.currentTarget;
            btn.classList.add('spinning');

            // Cache tozalash - BARCHA ma'lumotlar
            this.cache.orders = null;
            this.cache.products = null;
            this.cache.clients = null;
            this.cache.lastUpdate = null;
            console.log('🗑️ Cache to\'liq tozalandi');

            // Dashboard qayta yuklash
            this.loadDashboard().finally(() => {
                btn.classList.remove('spinning');
            });
        });

        // Menu toggle for mobile
        document.getElementById('menuToggle')?.addEventListener('click', () => {
            document.querySelector('.sidebar').classList.toggle('active');
        });

        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');

                const section = item.dataset.section;
                this.switchSection(section);
            });
        });

        // Period filter buttons
        document.querySelectorAll('.filter-btn[data-period]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentPeriod = btn.dataset.period;
                this.loadDashboard();
            });
        });

        // Sana oraligi Apply tugmasi
        document.getElementById('applyDateRange')?.addEventListener('click', () => {
            const startInput = document.getElementById('startDate');
            const endInput = document.getElementById('endDate');

            if (startInput?.value && endInput?.value) {
                this.customStartDate = startInput.value;
                this.customEndDate = endInput.value;
                this.currentPeriod = 'custom';

                // Barcha tugmalardan active'ni olib tashlash
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));

                this.loadDashboard();
            } else {
                alert('Iltimos, boshlanish va tugash sanalarini tanlang!');
            }
        });

        // Chart tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.updateMainChart(btn.dataset.chart);
            });
        });

        // Refresh activity
        document.getElementById('refreshActivity')?.addEventListener('click', (e) => {
            const btn = e.currentTarget;
            btn.classList.add('spinning');
            setTimeout(() => {
                this.loadActivity();
                btn.classList.remove('spinning');
            }, 1000);
        });

        // Modal handlers
        document.getElementById('closeModal')?.addEventListener('click', () => this.closeModal());
        document.getElementById('cancelConfig')?.addEventListener('click', () => this.closeModal());
        document.getElementById('saveConfig')?.addEventListener('click', () => this.saveApiConfig());
        document.querySelector('.modal-backdrop')?.addEventListener('click', () => this.closeModal());

        // Stat card click handlers for detail view
        this.setupStatCardClicks();

        // Settings button (user profile click)
        document.querySelector('.user-profile')?.addEventListener('click', () => this.openConfigModal());

        // USD Rate handlers
        this.initUsdRate();
        document.getElementById('saveRateBtn')?.addEventListener('click', () => this.saveUsdRate());
        document.getElementById('usdRateInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.saveUsdRate();
        });

        // ESC tugmasi bilan modal yopish
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeModal();
        });
    }

    // Modal yopish funksiyasi
    closeModal() {
        const detailModal = document.getElementById('detailModal');
        const configModal = document.getElementById('configModal');
        if (detailModal) detailModal.classList.remove('active');
        if (configModal) configModal.classList.remove('active');
        // Barcha modern-modal larni olib tashlash
        document.querySelectorAll('.modern-modal').forEach(m => m.remove());
        document.body.style.overflow = '';
    }

    // USD Rate Management
    initUsdRate() {
        const savedRate = localStorage.getItem('sd_usd_rate');
        const rateInput = document.getElementById('usdRateInput');
        if (savedRate && rateInput) {
            rateInput.value = savedRate;
        }
    }

    getUsdRate() {
        const savedRate = localStorage.getItem('sd_usd_rate');
        return savedRate ? parseFloat(savedRate) : 12200;
    }

    saveUsdRate() {
        const rateInput = document.getElementById('usdRateInput');
        const rate = parseFloat(rateInput?.value) || 12200;

        if (rate >= 1000 && rate <= 50000) {
            localStorage.setItem('sd_usd_rate', rate);

            // Cache'ni tozalash va qayta yuklash
            this.cachedCostPrices = null;

            this.showToast('success', 'Saqlandi', `Dollar kursi: ${this.formatNumber(rate)} so'm`);

            // Dashboard'ni qayta yuklash
            this.loadDashboard();
        } else {
            this.showToast('error', 'Xato', 'Kurs 1,000 - 50,000 oralig\'ida bo\'lishi kerak');
        }
    }

    // Lokal sanani formatlash (timezone muammosini hal qilish)
    formatLocalDate(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    // Get date range based on period
    getDateRange() {
        const now = new Date();
        let startDate, endDate;

        endDate = this.formatLocalDate(now);

        switch (this.currentPeriod) {
            case 'today':
                startDate = endDate;
                break;
            case 'yesterday':
                const yesterday = new Date(now);
                yesterday.setDate(yesterday.getDate() - 1);
                startDate = this.formatLocalDate(yesterday);
                endDate = startDate; // Faqat kecha
                break;
            case 'week':
                const weekAgo = new Date(now);
                weekAgo.setDate(weekAgo.getDate() - 7);
                startDate = this.formatLocalDate(weekAgo);
                break;
            case 'month':
                // Joriy oyning 1-sanasi
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                startDate = this.formatLocalDate(monthStart);
                break;
            case 'year':
                // Joriy yilning 1-yanvar
                const yearStart = new Date(now.getFullYear(), 0, 1);
                startDate = this.formatLocalDate(yearStart);
                break;
            case 'custom':
                // Custom sana oraligi
                startDate = this.customStartDate || endDate;
                endDate = this.customEndDate || endDate;
                break;
            default:
                startDate = endDate;
        }

        return { startDate, endDate };
    }

    // ⏱️ Timeout bilan fetch - server javob bermasa hang qilmasligi uchun
    async fetchWithTimeout(url, timeoutMs = 5000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    // Dashboard Loading - 🚀 SERVER CACHE ORQALI TEZKOR YUKLASH
    async loadDashboard() {
        // Server cache URL - lokal yoki production
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const CACHE_BASE_URL = isLocal
            ? 'http://localhost:3000'
            : 'https://sd-analitika-production.up.railway.app';

        try {
            console.log('🚀 Server cache dan yuklash...');
            this.showLoading();

            // 1️⃣ Avval server cache holatini tekshirish (5 sek timeout)
            const statusRes = await this.fetchWithTimeout(`${CACHE_BASE_URL}/api/cache/status`, 5000);
            const statusData = await statusRes.json();

            if (!statusData.hasData) {
                console.log('⏳ Server cache hali tayyor emas, eski usulda yuklaymiz...');
                try {
                    await this.loadRealStats();
                } catch (e) {
                    console.error('loadRealStats xatosi:', e);
                    this.showEmptyStats();
                }
                this.hideLoading();
                return;
            }

            console.log(`✅ Server cache tayyor: ${statusData.counts.orders} buyurtma`);

            // 2️⃣ Statistikani cache dan olish (TEZKOR!)
            const statsRes = await this.fetchWithTimeout(`${CACHE_BASE_URL}/api/cache/stats/${this.currentPeriod}`, 5000);
            const statsData = await statsRes.json();

            if (statsData.status && statsData.result) {
                const stats = statsData.result;

                // UI yangilash
                this.animateValue('totalSalesUZS', 0, stats.totalSalesUZS, 1500, this.formatCurrency.bind(this));
                this.animateValue('totalSalesUSD', 0, stats.totalSalesUSD, 1500, this.formatNumber.bind(this));
                this.animateValue('totalOrders', 0, stats.totalOrders, 1200, this.formatNumber.bind(this));
                this.animateValue('totalClientsAKB', 0, stats.totalClientsAKB, 1000, this.formatNumber.bind(this));
                this.animateValue('totalProducts', 0, stats.totalProducts, 800, this.formatNumber.bind(this));

                // Foyda
                const profitUZSEl = document.getElementById('totalProfitUZS');
                const profitUSDEl = document.getElementById('totalProfitUSD');
                if (profitUZSEl) profitUZSEl.textContent = Math.round(stats.totalProfitUZS).toLocaleString('ru-RU');
                if (profitUSDEl) profitUSDEl.textContent = '$' + stats.totalProfitUSD.toLocaleString();

                // Iroda agentlari
                const formatMln = (value) => {
                    const abs = Math.abs(value);
                    return (value < 0 ? '-' : '') + Math.round(abs).toLocaleString('ru-RU');
                };
                const irodaUZSEl = document.getElementById('irodaAgentsSalesUZS');
                const irodaUSDEl = document.getElementById('irodaAgentsSalesUSD');
                const irodaOrdersEl = document.getElementById('irodaAgentsOrders');
                if (irodaUZSEl) irodaUZSEl.textContent = formatMln(stats.irodaSalesUZS || 0);
                if (irodaUSDEl) irodaUSDEl.textContent = (stats.irodaSalesUSD || 0) > 0 ? '$' + (stats.irodaSalesUSD || 0).toLocaleString() : '$0';
                if (irodaOrdersEl) irodaOrdersEl.textContent = stats.irodaOrders || 0;

                // Cache vaqtini ko'rsatish
                const lastUpdate = new Date(statsData.lastUpdate);
                console.log(`📅 Oxirgi yangilanish: ${lastUpdate.toLocaleString('uz-UZ')}`);

                // Sparklines
                this.createSparkline('salesSparkline', this.demo.getSparklineData(), '#0071e3');
                this.createSparkline('ordersSparkline', this.demo.getSparklineData(), '#34c759');
                this.createSparkline('clientsSparkline', this.demo.getSparklineData(), '#af52de');
                this.createSparkline('productsSparkline', this.demo.getSparklineData(), '#ff9500');
                this.createSparkline('irodaSparkline', this.demo.getSparklineData(), '#00b4d8');
                this.createSparkline('profitSparkline', this.demo.getSparklineData(), '#10b981');
            }

            this.hideLoading();

            // 3️⃣ Background da qolgan elementlarni yuklash
            this.loadCachedCharts(CACHE_BASE_URL).catch(e => console.error('Chart xatosi:', e));
            this.loadCachedTables(CACHE_BASE_URL).catch(e => console.error('Table xatosi:', e));
            this.loadDebtAndPaymentStats();

        } catch (error) {
            console.error('❌ Server cache xatosi:', error);
            console.log('📡 Fallback: Eski usulda yuklaymiz...');

            try {
                // Fallback - eski usul
                if (this.useRealData && this.api.isConfigured()) {
                    await this.loadRealStats();
                    this.loadRealCharts().catch(e => console.error('Chart xatosi:', e));
                    this.loadRealTables().catch(e => console.error('Table xatosi:', e));
                } else {
                    await this.loadStats();
                    await this.loadCharts();
                    await this.loadTables();
                }
            } catch (fallbackError) {
                console.error('❌ Fallback ham xato:', fallbackError);
                this.showEmptyStats();
            } finally {
                this.hideLoading();
            }
        }
    }

    // 🚀 Cache dan chartlarni yuklash
    async loadCachedCharts(baseUrl) {
        try {
            const ordersRes = await fetch(`${baseUrl}/api/cache/orders/${this.currentPeriod}`);
            const ordersData = await ordersRes.json();

            if (ordersData.status && ordersData.result?.order) {
                this.cachedOrders = ordersData.result.order;
                await this.loadRealCharts();
            }
        } catch (e) {
            console.error('Cached charts xatosi:', e);
        }
    }

    // 🚀 Cache dan tablelarni yuklash
    async loadCachedTables(baseUrl) {
        try {
            const ordersRes = await fetch(`${baseUrl}/api/cache/orders/${this.currentPeriod}`);
            const ordersData = await ordersRes.json();

            if (ordersData.status && ordersData.result?.order) {
                this.cachedOrders = ordersData.result.order;
                await this.loadRealTables();
            }
        } catch (e) {
            console.error('Cached tables xatosi:', e);
        }
    }

    // 💾 Cache dan statistikani ko'rsatish
    displayCachedStats(stats) {
        const updateEl = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };

        if (stats.sales) {
            updateEl('totalSalesUZS', stats.sales.uzs || '0');
            updateEl('totalSalesUSD', stats.sales.usd || '0');
        }
        updateEl('totalOrders', stats.orders || '0');
        updateEl('totalClientsOKB', stats.clientsOKB || '0');
        updateEl('totalClientsAKB', stats.clientsAKB || '0');
        updateEl('totalProducts', stats.products || '0');
        updateEl('totalProfitUZS', stats.profitUZS || '0');
        updateEl('totalProfitUSD', stats.profitUSD || '$0');
        updateEl('irodaAgentsSalesUZS', stats.irodaUZS || '0');
        updateEl('irodaAgentsSalesUSD', stats.irodaUSD || '0');
        updateEl('irodaAgentsOrders', stats.irodaOrders || '0');

        console.log('✅ Cache dan statistika ko\'rsatildi');
    }

    // 🔄 Orqa fonda yangilash
    async refreshDashboardInBackground() {
        try {
            await this.loadRealStats();
            this.loadRealCharts().catch(e => console.error('Chart xatosi:', e));
            this.loadRealTables().catch(e => console.error('Table xatosi:', e));
            this.loadRealActivity().catch(e => console.error('Activity xatosi:', e));
            console.log('✅ Dashboard orqa fonda yangilandi');
        } catch (e) {
            console.error('Background refresh xatosi:', e);
        }
    }

    // ============ REAL API DATA LOADING ============

    // Tan narxlarni olish (getPurchase API dan)
    // Narx < 100 = USD, >= 100 = UZS
    async fetchCostPrices() {
        try {
            if (this.cachedCostPrices) return this.cachedCostPrices;

            // 🚀 Server cache dan olish - TEZKOR!
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const CACHE_BASE_URL = isLocal
                ? 'http://localhost:3000'
                : 'https://sd-analitika-production.up.railway.app';

            const res = await this.fetchWithTimeout(`${CACHE_BASE_URL}/api/cache/costprices`, 5000);
            const data = await res.json();

            if (data.status && data.result) {
                this.cachedCostPrices = data.result;
                console.log(`✅ Tan narxlar (cache): ${data.total} ta`);
                return data.result;
            }

            // Fallback - eski usul (agar server cache yo'q bo'lsa)
            console.log('⚠️ Tan narxlar cache da yo\'q, API dan yuklaymiz...');
            let allPurchases = [];
            for (let page = 1; page <= 10; page++) {
                const r = await this.api.request('getPurchase', { page, limit: 500 });
                const purchases = r?.result?.warehouse || [];
                if (purchases.length === 0) break;
                allPurchases = allPurchases.concat(purchases);
            }

            const costPrices = {};
            const USD_RATE = this.getUsdRate();

            allPurchases.forEach(p => {
                (p.detail || []).forEach(item => {
                    const productId = item.SD_id;
                    const rawPrice = parseFloat(item.price) || 0;
                    if (rawPrice <= 0) return;

                    const isUSD = rawPrice < 100;
                    const costPriceUZS = isUSD ? rawPrice * USD_RATE : rawPrice;

                    if (!costPrices[productId] || costPrices[productId].date < p.date) {
                        costPrices[productId] = {
                            name: item.name,
                            costPrice: rawPrice,
                            costPriceUZS: costPriceUZS,
                            currency: isUSD ? 'USD' : 'UZS',
                            date: p.date
                        };
                    }
                });
            });

            this.cachedCostPrices = costPrices;
            return costPrices;
        } catch (error) {
            console.error('Tan narxlarni yuklash xatosi:', error);
            return this.cachedCostPrices || {};
        }
    }

    // Summani so'mga o'tkazish (faqat ORDER darajasidagi totalSumma uchun!)
    // Mahsulot summalari har doim so'mda keladi
    getSummaInUZS(summa) {
        if (!summa || summa <= 0) return 0;
        // Agar summa < 10000, demak dollarda - kursga ko'paytiramiz
        // Bu faqat order.totalSumma uchun ishlatiladi!
        if (summa < 10000) {
            return summa * this.getUsdRate();
        }
        // Aks holda so'mda
        return summa;
    }

    // MUHIM: itemSumma har doim so'mda keladi, konvertatsiya kerak emas!
    // Foyda hisobini hisoblash
    calculateProfit(summa, costPriceUZS, quantity) {
        // Mahsulot summasi har doim so'mda - konvertatsiya QILMAYMIZ!
        const summaUZS = summa;

        if (!summaUZS || summaUZS <= 0) return 0;

        // Agar tan narx = 0 yoki yo'q bo'lsa, butun summa = foyda (BONUS tovarlar)
        if (!costPriceUZS || costPriceUZS <= 0) {
            return summaUZS; // To'liq summa foyda sifatida - bonus tovar
        }

        const totalCost = costPriceUZS * quantity;
        const profit = summaUZS - totalCost;

        // Mantiqsiz foyda tekshiruvi:
        // 1. Manfiy foyda - 0 qaytaramiz
        // 2. Foyda sotuvning 50% dan oshsa - 15% taxminiy foyda ishlatamiz
        if (profit < 0) {
            return 0;
        }

        const maxProfit = summaUZS * 0.50; // Maksimum 50% marja
        if (profit > maxProfit) {
            // Noto'g'ri tan narx - 15% taxminiy foyda
            return summaUZS * 0.15;
        }

        return profit;
    }


    async loadRealStats() {
        try {
            const dateRange = this.getDateRange();

            // Barcha buyurtmalarni yuklash (to'liq ma'lumot)
            console.log('📊 Barcha buyurtmalar yuklanmoqda...');
            const allOrders = await this.fetchAllOrders();
            console.log(`✅ ${allOrders.length} ta buyurtma yuklandi`);

            // PriceType olish (valyuta aniqlash uchun)
            const priceTypesRes = await this.api.request('getPriceType', {});

            // Dollar narx turlarini aniqlash (priceType bo'yicha)
            // 1. Nomida '$' bo'lganlar: d0_7, d0_8
            // 2. Summalari kichik bo'lganlar: d0_11, d0_9, d0_6 (dollar narxlar)
            const dollarPriceTypes = new Set(['d0_7', 'd0_8', 'd0_11', 'd0_9', 'd0_6']);

            // Agar getPriceType mavjud bo'lsa, nomida $ borlarni ham qo'shish
            if (priceTypesRes?.result?.priceType) {
                priceTypesRes.result.priceType.forEach(pt => {
                    if (pt.name && (pt.name.includes('$') || pt.name.toLowerCase().includes('dollar'))) {
                        dollarPriceTypes.add(pt.SD_id);
                    }
                });
            }

            // Ma'lumotlarni hisoblash
            let totalSalesUZS = 0;
            let totalSalesUSD = 0;
            let totalOrders = 0;
            let totalClients = 0;  // OKB - Umumiy Klient Baza
            let activeClients = new Set();  // AKB - Aktiv Klient Baza (davrda ishlagan)
            let totalProducts = 0;

            // Tanlangan period bo'yicha filtrlash
            const { startDate, endDate } = dateRange;
            const filteredOrders = allOrders.filter(order => {
                const orderDate = (order.dateCreate || order.dateDocument || order.orderCreated || '').split('T')[0].split(' ')[0];
                if (startDate && endDate) {
                    return orderDate >= startDate && orderDate <= endDate;
                }
                return true;
            });

            // Sotuvlarni hisoblash - paymentType (sposob oplata) orqali dollar aniqlash
            // d0_4 = "Доллар США" (Dollar)
            // d0_2, d0_3, d0_5 = So'm (naqd, beznal, click)
            filteredOrders.forEach(order => {
                // "Возврат" (Qaytarish) buyurtmalarini o'tkazib yuborish
                // status = 4 bu Возврат
                const orderStatus = order.status;
                const totalSumma = parseFloat(order.totalSumma) || 0;
                const returnsSumma = parseFloat(order.totalReturnsSumma) || 0;
                // status 4 = Возврат, status 5 = boshqa qaytarish
                if (orderStatus === 4 || orderStatus === 5 || (returnsSumma > 0 && returnsSumma === totalSumma)) {
                    return;
                }

                const sum = parseFloat(order.totalSumma) || parseFloat(order.totalSummaAfterDiscount) || 0;
                const paymentTypeId = order.paymentType?.SD_id;
                const priceTypeId = order.priceType?.SD_id;

                // AKB - Aktiv mijozlarni to'plash
                if (order.client?.SD_id) {
                    activeClients.add(order.client.SD_id);
                }

                // Avval paymentType tekshiramiz (sposob oplata)
                if (paymentTypeId === 'd0_4') {
                    totalSalesUSD += sum;
                }
                // Agar paymentType dollar bo'lmasa, priceType tekshiramiz
                else if (dollarPriceTypes.has(priceTypeId)) {
                    totalSalesUSD += sum;
                } else {
                    totalSalesUZS += sum;
                }
            });

            totalOrders = filteredOrders.length;

            // Products - pagination bilan
            totalProducts = await this.fetchTotalProducts();

            // Clients - pagination bilan  
            totalClients = await this.fetchTotalClients();

            // AKB ma'lumotlarini saqlash (modal uchun)
            const akbCount = activeClients.size;
            this.cachedActiveClientIds = activeClients;  // AKB client ID'lari
            this.cachedOKBCount = totalClients;
            this.cachedAKBCount = akbCount;

            console.log(`📊 Statistika: ${totalOrders} buyurtma, ${totalSalesUZS.toLocaleString()} UZS, ${totalSalesUSD.toLocaleString()} $`);
            console.log(`👥 OKB: ${totalClients}, AKB: ${akbCount}`);

            // Animate stat values - dual currency
            const salesUZSEl = document.getElementById('totalSalesUZS');
            const salesUSDEl = document.getElementById('totalSalesUSD');

            if (salesUZSEl) {
                this.animateValue('totalSalesUZS', 0, totalSalesUZS, 1500, this.formatCurrency.bind(this));
            }
            if (salesUSDEl) {
                this.animateValue('totalSalesUSD', 0, totalSalesUSD, 1500, (val) => this.formatNumber(val));
            }

            this.animateValue('totalOrders', 0, totalOrders, 1200, this.formatNumber.bind(this));
            // OKB/AKB widgetlarni yangilash
            this.animateValue('totalClientsOKB', 0, totalClients, 1000, this.formatNumber.bind(this));
            this.animateValue('totalClientsAKB', 0, akbCount, 1000, this.formatNumber.bind(this));
            this.animateValue('totalProducts', 0, totalProducts, 800, this.formatNumber.bind(this));

            // Iroda agentlari savdosini hisoblash (sana filtri bilan)
            const irodaSales = await this.fetchIrodaAgentsSales(filteredOrders);

            // Iroda agentlari widget'ni yangilash
            const formatMln = (value) => {
                // To'liq raqam ko'rsatish (mln emas)
                const abs = Math.abs(value);
                const formatted = Math.round(abs).toLocaleString('ru-RU');
                return (value < 0 ? '-' : '') + formatted;
            };

            const irodaUZSEl = document.getElementById('irodaAgentsSalesUZS');
            const irodaUSDEl = document.getElementById('irodaAgentsSalesUSD');
            console.log('📍 Iroda exact:', irodaSales.totalUZS.toLocaleString(), 'so\'m,', irodaSales.totalUSD.toLocaleString(), '$');
            if (irodaUZSEl) irodaUZSEl.textContent = formatMln(irodaSales.totalUZS);
            if (irodaUSDEl) irodaUSDEl.textContent = irodaSales.totalUSD > 0 ? '$' + irodaSales.totalUSD.toLocaleString() : '$0';
            const irodaOrdersEl = document.getElementById('irodaAgentsOrders');
            if (irodaOrdersEl) irodaOrdersEl.textContent = irodaSales.matchedOrders;

            // ========== JAMI FOYDA HISOBLASH ==========
            const costPrices = await this.fetchCostPrices();
            let totalProfitUZS = 0;
            let matchedCount = 0;
            let fallbackCount = 0;
            const productProfits = {}; // Mahsulotlar bo'yicha foyda
            const orderProfits = []; // Buyurtmalar bo'yicha foyda

            filteredOrders.forEach(order => {
                // "Возврат" (Qaytarish) buyurtmalarini o'tkazib yuborish
                // status = 4 bu Возврат
                const orderStatus = order.status;
                const totalSumma = parseFloat(order.totalSumma) || 0;
                const returnsSumma = parseFloat(order.totalReturnsSumma) || 0;

                // status 4 = Возврат, status 5 = boshqa qaytarish
                if (orderStatus === 4 || orderStatus === 5 || (returnsSumma > 0 && returnsSumma === totalSumma)) {
                    return;
                }

                // Buyurtma darajasida foyda
                let orderProfit = 0;
                let orderSales = 0;
                const orderProductDetails = [];

                (order.orderProducts || []).forEach(item => {
                    const productId = item.product?.SD_id;
                    const productName = item.product?.name || 'Noma\'lum';
                    const quantity = parseFloat(item.quantity) || 0;
                    const rawSumma = parseFloat(item.summa) || 0;
                    // Valyutani aniqlash: > 100 = UZS, <= 100 = USD
                    const itemSummaUZS = rawSumma > 100 ? rawSumma : rawSumma * this.getUsdRate();
                    const costData = costPrices[productId];
                    const costPriceUZS = costData?.costPriceUZS || 0;

                    let itemProfit = 0;
                    if (costPriceUZS > 0) {
                        matchedCount++;
                        // Foyda = Sotish - Tan narx * soni
                        const totalCost = costPriceUZS * quantity;
                        itemProfit = Math.max(0, itemSummaUZS - totalCost);
                    } else {
                        fallbackCount++;
                        // Tan narx yo'q (bonus) - butun summa foyda
                        itemProfit = itemSummaUZS;
                    }

                    totalProfitUZS += itemProfit;
                    orderProfit += itemProfit;
                    orderSales += itemSummaUZS;

                    // Buyurtma mahsulotlarini saqlash
                    orderProductDetails.push({
                        name: productName,
                        quantity: quantity,
                        sales: itemSummaUZS,
                        profit: itemProfit,
                        isBonus: costPriceUZS <= 0
                    });

                    // Mahsulot foydani yig'ish
                    if (!productProfits[productId]) {
                        productProfits[productId] = {
                            name: productName,
                            profit: 0,
                            sales: 0,
                            quantity: 0,
                            isBonus: costPriceUZS <= 0
                        };
                    }
                    productProfits[productId].profit += itemProfit;
                    productProfits[productId].sales += itemSummaUZS;
                    productProfits[productId].quantity += quantity;
                });

                // Buyurtma foydani saqlash
                if (orderProfit > 0) {
                    orderProfits.push({
                        orderId: order.SD_id || order._id,
                        date: order.date,
                        client: order.client?.name || 'Noma\'lum',
                        sales: orderSales,
                        profit: orderProfit,
                        products: orderProductDetails
                    });
                }
            });

            // Mahsulot va buyurtma foydalarni cache qilish
            this.cachedProductProfits = productProfits;
            this.cachedOrderProfits = orderProfits;

            const totalProfitUSD = Math.round(totalProfitUZS / this.getUsdRate());

            // Jami Foyda widget'ni yangilash
            const profitUZSEl = document.getElementById('totalProfitUZS');
            const profitUSDEl = document.getElementById('totalProfitUSD');
            if (profitUZSEl) profitUZSEl.textContent = formatMln(totalProfitUZS);
            if (profitUSDEl) profitUSDEl.textContent = '$' + totalProfitUSD.toLocaleString();

            console.log(`💰 Jami foyda: ${formatMln(totalProfitUZS)} (${totalProfitUSD.toLocaleString()} $)`);
            console.log(`📊 Tan narx statistika: ${matchedCount} matched, ${fallbackCount} fallback (15%)`);
            console.log(`📦 Tan narxlar soni: ${Object.keys(costPrices).length}`);

            // Sparklines (demo for now as API doesn't provide historical trends)
            this.createSparkline('salesSparkline', this.demo.getSparklineData(), '#0071e3');
            this.createSparkline('ordersSparkline', this.demo.getSparklineData(), '#34c759');
            this.createSparkline('clientsSparkline', this.demo.getSparklineData(), '#af52de');
            this.createSparkline('productsSparkline', this.demo.getSparklineData(), '#ff9500');
            this.createSparkline('irodaSparkline', this.demo.getSparklineData(), '#00b4d8');
            this.createSparkline('profitSparkline', this.demo.getSparklineData(), '#10b981');

            // Load debt and payment stats
            this.loadDebtAndPaymentStats();

            // Buyurtmalarni cache qilish (chartlar uchun)
            this.cachedOrders = allOrders;

            // 💾 LocalStorage cache ga saqlash (keyingi yuklanishda tez ko'rsatish uchun)
            const statsToCache = {
                sales: {
                    uzs: document.getElementById('totalSalesUZS')?.textContent || '0',
                    usd: document.getElementById('totalSalesUSD')?.textContent || '0'
                },
                orders: document.getElementById('totalOrders')?.textContent || '0',
                clientsOKB: document.getElementById('totalClientsOKB')?.textContent || '0',
                clientsAKB: document.getElementById('totalClientsAKB')?.textContent || '0',
                products: document.getElementById('totalProducts')?.textContent || '0',
                profitUZS: document.getElementById('totalProfitUZS')?.textContent || '0',
                profitUSD: document.getElementById('totalProfitUSD')?.textContent || '$0',
                irodaUZS: document.getElementById('irodaAgentsSalesUZS')?.textContent || '0',
                irodaUSD: document.getElementById('irodaAgentsSalesUSD')?.textContent || '0',
                irodaOrders: document.getElementById('irodaAgentsOrders')?.textContent || '0'
            };
            this.saveToCache(this.CACHE_KEYS.STATS, statsToCache);
            console.log('💾 Statistika cache ga saqlandi');

        } catch (error) {
            console.error('Real stats yuklash xatosi:', error);
            throw error;
        }
    }

    // Barcha buyurtmalarni pagination bilan olish
    async fetchAllOrders() {
        let allOrders = [];
        let page = 1;
        let hasMore = true;
        const limit = 1000;

        console.log('📥 Barcha buyurtmalarni yuklash...');

        while (hasMore && page <= 20) {
            try {
                const data = await this.api.request('getOrder', {
                    filter: { status: 'all' },
                    page: page,
                    limit: limit
                });

                if (data.result?.order && data.result.order.length > 0) {
                    console.log(`  📦 Sahifa ${page}: ${data.result.order.length} ta buyurtma`);
                    allOrders = allOrders.concat(data.result.order);

                    if (data.result.order.length < limit) {
                        hasMore = false;
                    } else {
                        page++;
                    }
                } else {
                    hasMore = false;
                }
            } catch (error) {
                console.error(`Sahifa ${page} xatosi:`, error);
                hasMore = false;
            }
        }

        console.log(`✅ Jami yuklandi: ${allOrders.length} ta buyurtma`);
        return allOrders;
    }

    // 🚀 OPTIMIZATSIYA: Oxirgi 30 kunlik buyurtmalarni yuklash (Dashboard uchun)
    async fetch30DaysOrders() {
        // Cache mavjud bo'lsa va yangi bo'lsa - ishlatamiz
        const now = Date.now();
        const cacheAge = this.cache.lastUpdate ? (now - this.cache.lastUpdate) / 1000 / 60 : 999; // minutlarda

        if (this.cache.orders && cacheAge < 5) {
            console.log(`⚡ Cache ishlatildi (${Math.round(cacheAge)} min oldin)`);
            return this.filterLast30Days(this.cache.orders);
        }

        let allOrders = [];
        let page = 1;
        let hasMore = true;
        const limit = 1000;

        // 30 kun oldingi sana
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - this.cache.dashboardDays);
        const startDate = thirtyDaysAgo.toISOString().split('T')[0];

        console.log(`📥 Oxirgi ${this.cache.dashboardDays} kunlik buyurtmalar (${startDate} dan)...`);

        // Faqat 3-4 sahifa yuklash (30 kun uchun yetarli)
        while (hasMore && page <= 4) {
            try {
                const data = await this.api.request('getOrder', {
                    filter: { status: 'all' },
                    page: page,
                    limit: limit
                });

                if (data.result?.order && data.result.order.length > 0) {
                    const orders = data.result.order;
                    console.log(`  📦 Sahifa ${page}: ${orders.length} ta buyurtma`);

                    // Faqat oxirgi 30 kunlikni qo'shamiz
                    const recentOrders = orders.filter(order => {
                        const orderDate = (order.dateCreate || order.dateDocument || order.orderCreated || '').split('T')[0].split(' ')[0];
                        return orderDate >= startDate;
                    });

                    allOrders = allOrders.concat(recentOrders);

                    // Agar eski buyurtmalar topilsa - to'xtaymiz
                    if (recentOrders.length < orders.length) {
                        console.log(`  ⏹️ Eski buyurtmalar topildi - to'xtash`);
                        hasMore = false;
                    } else if (orders.length < limit) {
                        hasMore = false;
                    } else {
                        page++;
                    }
                } else {
                    hasMore = false;
                }
            } catch (error) {
                console.error(`Sahifa ${page} xatosi:`, error);
                hasMore = false;
            }
        }

        // Cache ga saqlash
        this.cache.orders = allOrders;
        this.cache.lastUpdate = now;

        console.log(`✅ ${this.cache.dashboardDays} kunlik: ${allOrders.length} ta buyurtma`);
        return allOrders;
    }

    // 30 kunlik buyurtmalarni filtrlash (cache uchun)
    filterLast30Days(orders) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - this.cache.dashboardDays);
        const startDate = thirtyDaysAgo.toISOString().split('T')[0];

        return orders.filter(order => {
            const orderDate = (order.dateCreate || order.dateDocument || order.orderCreated || '').split('T')[0].split(' ')[0];
            return orderDate >= startDate;
        });
    }

    // Barcha mahsulotlar sonini olish (pagination bilan)
    async fetchTotalProducts() {
        // Cache mavjud bo'lsa - ishlatamiz
        if (this.cache.products !== null) {
            console.log(`⚡ Mahsulotlar cache dan: ${this.cache.products}`);
            return this.cache.products;
        }

        let total = 0;
        let page = 1;
        let hasMore = true;

        while (hasMore && page <= 10) {
            try {
                const data = await this.api.request('getProduct', { page, limit: 1000 });
                if (data.result?.product?.length > 0) {
                    total += data.result.product.length;
                    if (data.result.product.length < 1000) hasMore = false;
                    else page++;
                } else {
                    hasMore = false;
                }
            } catch (e) {
                hasMore = false;
            }
        }

        // Cache ga saqlash
        this.cache.products = total;
        console.log(`📦 Jami mahsulotlar: ${total}`);
        return total;
    }

    // Barcha mijozlar sonini olish (pagination bilan)
    async fetchTotalClients() {
        // Cache mavjud bo'lsa - ishlatamiz
        if (this.cache.clients !== null) {
            console.log(`⚡ Mijozlar cache dan: ${this.cache.clients}`);
            return this.cache.clients;
        }

        let total = 0;
        let page = 1;
        let hasMore = true;

        while (hasMore && page <= 10) {
            try {
                const data = await this.api.request('getClient', { page, limit: 1000 });
                if (data.result?.client?.length > 0) {
                    total += data.result.client.length;
                    if (data.result.client.length < 1000) hasMore = false;
                    else page++;
                } else {
                    hasMore = false;
                }
            } catch (e) {
                hasMore = false;
            }
        }

        // Cache ga saqlash
        this.cache.clients = total;
        console.log(`👥 Jami mijozlar: ${total}`);
        return total;
    }

    // Iroda agentlari savdosini hisoblash
    async fetchIrodaAgentsSales(allOrders) {
        // Iroda'ga bog'langan agentlar ID lari (Sales Doctor'dan olindi)
        const irodaAgentIds = new Set([
            'd0_2',   // Nilufarxon
            'd0_6',   // Usmonqulov Asadulloh
            'd0_7',   // Axmedova Xalimaxon
            'd0_8',   // Abduraxmonov Shuxrat
            'd0_10',  // Abduraximova Muxayyoxon
            'd0_11',  // Aliakbar Yusupov
            'd0_19',  // Soliev Ibrohimjon
            'd0_20',  // Oybek
            'd0_22',  // Tojiboyev Abubakir
            'd0_24',  // Xolmirzayeva Honzodaxon
            'd0_25',  // Xolmuxamedova Ziroatxon
            'd0_28'   // Matkarimov Bexruz
        ]);

        let totalUZS = 0;
        let totalUSD = 0;
        let matchedOrders = 0;
        const matchedAgentIds = new Set();

        // Har bir agent bo'yicha savdo
        const agentSales = {};
        irodaAgentIds.forEach(id => agentSales[id] = { name: '', count: 0, sum: 0 });

        // Debug: Xolmirzayeva buyurtmalarini ko'rish
        const xolmirzayevaOrders = [];

        allOrders.forEach(order => {
            const agentId = order.agent?.SD_id;

            if (agentId && irodaAgentIds.has(agentId)) {
                // "Возврат" (Qaytarish) buyurtmalarini o'tkazib yuborish
                // status = 4 bu Возврат, yoki totalReturnsSumma = totalSumma
                const orderStatus = order.status;
                const totalSumma = parseFloat(order.totalSumma) || 0;
                const returnsSumma = parseFloat(order.totalReturnsSumma) || 0;

                // status 4 = Возврат, status 5 = boshqa qaytarish
                if (orderStatus === 4 || orderStatus === 5 || (returnsSumma > 0 && returnsSumma === totalSumma)) {
                    return; // Bu qaytarishni hisoblamaymiz
                }

                const sum = parseFloat(order.totalSumma) || 0;
                const paymentTypeId = order.paymentType?.SD_id;

                agentSales[agentId].name = order.agent?.name || agentId;
                agentSales[agentId].count++;
                agentSales[agentId].sum += sum;

                // Xolmirzayeva buyurtmalarini saqlash
                if (agentId === 'd0_24') {
                    // 420,000 buyurtmani to'liq ko'rsatish
                    const sum = parseFloat(order.totalSumma) || 0;
                    if (Math.abs(sum - 420000) < 1000) {
                        console.log('🔴 420K BUYURTMA TO\'LIQ:', JSON.stringify(order, null, 2));
                    }
                    // Status ni to'liq ko'rsatish
                    console.log('Xolmirzayeva order:', order.nomer, 'status obj:', JSON.stringify(order.status), 'orderStatus obj:', JSON.stringify(order.orderStatus));
                    xolmirzayevaOrders.push({
                        nomer: order.nomer,
                        date: order.dateCreate || order.dateDocument,
                        client: order.client?.name,
                        sum: sum,
                        status: order.status?.name || order.orderStatus?.name || 'UNKNOWN'
                    });
                }

                // Faqat haqiqiy dollarli to'lovlarni alohida hisoblash
                if (paymentTypeId === 'd0_4') {
                    totalUSD += sum;
                } else {
                    totalUZS += sum;
                }
                matchedOrders++;
                matchedAgentIds.add(agentId);
            }
        });

        // Xolmirzayeva buyurtmalarini console'da ko'rsatish
        console.warn('========= XOLMIRZAYEVA BUYURTMALARI =========');
        xolmirzayevaOrders.forEach((o, i) => {
            console.warn(`${i + 1}. #${o.nomer} | ${o.client} | ${o.sum.toLocaleString()} so'm | ${o.status} | ${o.date}`);
        });
        console.warn('==============================================');

        console.log(`👥 Iroda agentlari: ${matchedOrders} buyurtma, ${(totalUZS / 1000000).toFixed(1)} mln so'm, $${totalUSD.toLocaleString()}`);
        console.log(`👥 Faol agentlar:`, [...matchedAgentIds]);


        // Har bir agent savdosini ko'rsatish
        console.log('📊 Agent bo\'yicha taqsimot:');
        Object.entries(agentSales).filter(([, v]) => v.count > 0).forEach(([id, data]) => {
            console.log(`   ${data.name}: ${data.count} ta, ${(data.sum / 1000000).toFixed(2)} mln`);
        });

        return { totalUZS, totalUSD, matchedOrders };
    }

    async loadDebtAndPaymentStats() {
        try {
            // Barcha balanslarni olish
            const allBalances = await this.fetchAllBalances();

            // Barcha to'lovlarni olish
            const allPayments = await this.fetchAllPayments();

            // Valyuta bo'yicha jami - BARCHA mijozlar uchun
            // d0_2 = Наличный Сум, d0_3 = Безналичный Сум, d0_4 = Доллар США
            const currencyTotals = {
                'd0_2': 0,  // Naqd so'm
                'd0_3': 0,  // Beznal so'm
                'd0_4': 0,  // Dollar
                'd0_5': 0   // Clic
            };

            let debtorCount = 0;
            let totalBalance = 0;  // Umumiy balans

            // BARCHA balanslarni yig'ish
            allBalances.forEach(b => {
                const balance = parseFloat(b.balance) || 0;
                totalBalance += balance;

                // by-currency mavjud bo'lsa, har bir valyutani yig'ish
                if (b['by-currency'] && Array.isArray(b['by-currency'])) {
                    b['by-currency'].forEach(curr => {
                        const amount = parseFloat(curr.amount) || 0;
                        if (currencyTotals.hasOwnProperty(curr.currency_id)) {
                            currencyTotals[curr.currency_id] += amount;
                        }
                    });
                }

                // Qarzdorlar sonini hisoblash (manfiy balanslar)
                if (balance < 0) {
                    debtorCount++;
                }
            });

            // To'lovlar hisoblash - paymentType.SD_id bo'yicha
            const paymentTotals = {
                'd0_2': 0,  // Naqd so'm
                'd0_3': 0,  // Beznal so'm
                'd0_4': 0   // Dollar
            };
            let paymentCount = allPayments.length;

            allPayments.forEach(p => {
                const amount = parseFloat(p.amount) || 0;
                const paymentTypeId = p.paymentType?.SD_id;

                if (paymentTotals.hasOwnProperty(paymentTypeId)) {
                    paymentTotals[paymentTypeId] += amount;
                } else {
                    // Noma'lum turlar naqd so'mga qo'shiladi
                    paymentTotals['d0_2'] += amount;
                }
            });

            // Jami to'lovlar (so'm)
            const totalPaymentsSum = paymentTotals['d0_2'] + paymentTotals['d0_3'];

            console.log(`💰 Umumiy balans: ${totalBalance.toLocaleString()}`);
            console.log(`💰 Qarzdorlik: Naqd=${currencyTotals['d0_2'].toLocaleString()}, Beznal=${currencyTotals['d0_3'].toLocaleString()}, Dollar=${currencyTotals['d0_4'].toLocaleString()}`);
            console.log(`👥 Qarzdorlar: ${debtorCount}`);

            // So'm = Naqd + Beznal
            const debtSomTotal = currencyTotals['d0_2'] + currencyTotals['d0_3'];

            // Formatlovchi funksiyalar - TO'LIQ RAQAM
            const formatMln = (value) => {
                const abs = Math.abs(value);
                const formatted = Math.round(abs).toLocaleString('ru-RU');
                return (value < 0 ? '-' : '') + formatted;
            };

            const formatDollar = (value) => {
                const formatted = this.formatNumber(Math.abs(value));
                return value < 0 ? `-${formatted}` : formatted;
            };

            // Premium Qarzdorlik qiymatlari
            const debtSomEl = document.getElementById('debtSom');
            const debtDollarEl = document.getElementById('debtDollar');
            const debtNaqdEl = document.getElementById('debtNaqd');
            const debtBeznalEl = document.getElementById('debtBeznal');

            if (debtSomEl) debtSomEl.textContent = formatMln(debtSomTotal);
            if (debtDollarEl) debtDollarEl.textContent = formatDollar(currencyTotals['d0_4']);
            if (debtNaqdEl) debtNaqdEl.textContent = formatMln(currencyTotals['d0_2']);
            if (debtBeznalEl) {
                const beznalVal = currencyTotals['d0_3'];
                debtBeznalEl.textContent = (beznalVal >= 0 ? '+' : '') + formatMln(beznalVal);
                debtBeznalEl.className = beznalVal >= 0 ? 'stat-val positive' : 'stat-val';
            }

            // Qarzdorlar soni
            const debtorEl = document.getElementById('debtorCount');
            if (debtorEl) debtorEl.textContent = debtorCount;

            // Bugungi sanani ko'rsatish
            const currentDateEl = document.getElementById('currentDate');
            if (currentDateEl) {
                const today = new Date();
                currentDateEl.textContent = today.toLocaleDateString('ru-RU');
            }

            // Yangi debt widget uchun
            const totalDebtUZSEl = document.getElementById('totalDebtUZS');
            const totalDebtUSDEl = document.getElementById('totalDebtUSD');
            if (totalDebtUZSEl) totalDebtUZSEl.textContent = formatMln(debtSomTotal);
            if (totalDebtUSDEl) totalDebtUSDEl.textContent = formatDollar(currencyTotals['d0_4']);

        } catch (error) {
            console.error('Qarz va to\'lov yuklash xatosi:', error);
        }
    }

    // Barcha balanslarni olish - CACHE SERVERDAN
    async fetchAllBalances() {
        try {
            // Avval xotiradagi cache dan
            if (this._cachedBalances) {
                console.log(`⚡ Balanslar xotiradan: ${this._cachedBalances.length}`);
                return this._cachedBalances;
            }
            // Cache serverdan olish
            const baseUrl = this.getCacheBaseUrl();
            const res = await fetch(`${baseUrl}/api/cache/balances`);
            const data = await res.json();
            if (data.status && data.result?.balance) {
                this._cachedBalances = data.result.balance;
                console.log(`⚡ Balanslar cache dan: ${this._cachedBalances.length}`);
                return this._cachedBalances;
            }
            // Fallback - API
            const apiData = await this.api.request('getBalance', { limit: 5000 });
            const balances = apiData.result?.balance || [];
            this._cachedBalances = balances;
            console.log(`📊 Balanslar API dan: ${balances.length}`);
            return balances;
        } catch (e) {
            console.error('Balance olish xatosi:', e);
            return [];
        }
    }

    // Barcha to'lovlarni olish - CACHE SERVERDAN
    async fetchAllPayments() {
        try {
            if (this._cachedPayments) {
                console.log(`⚡ To'lovlar xotiradan: ${this._cachedPayments.length}`);
                return this._cachedPayments;
            }
            const baseUrl = this.getCacheBaseUrl();
            const res = await fetch(`${baseUrl}/api/cache/payments`);
            const data = await res.json();
            if (data.status && data.result?.payment) {
                this._cachedPayments = data.result.payment;
                console.log(`⚡ To'lovlar cache dan: ${this._cachedPayments.length}`);
                return this._cachedPayments;
            }
        } catch (e) {
            console.log('Cache dan to\'lov olish xatosi, API dan olamiz...');
        }
        // Fallback - API
        let allPayments = [];
        let page = 1;
        let hasMore = true;

        while (hasMore && page <= 20) {
            try {
                const data = await this.api.request('getPayment', { page, limit: 1000 });
                if (data.result?.payment?.length > 0) {
                    allPayments = allPayments.concat(data.result.payment);
                    if (data.result.payment.length < 1000) hasMore = false;
                    else page++;
                } else {
                    hasMore = false;
                }
            } catch (e) {
                hasMore = false;
            }
        }
        console.log(`💵 Jami to'lovlar: ${allPayments.length}`);
        return allPayments;
    }

    async loadRealCharts() {
        try {
            // Cache'dan buyurtmalarni olish (loadRealStats da yuklanadi)
            const orders = this.cachedOrders || [];

            let chartData;

            if (orders.length > 0) {
                chartData = this.processOrdersForChart(orders);
            } else {
                // Fallback agar buyurtmalar yo'q bo'lsa
                chartData = {
                    labels: [],
                    revenue: [],
                    orders: [],
                    profit: []
                };
            }

            this.createMainChart(chartData);

            // Category data from orders
            const categoryData = this.processCategoryData(orders);
            this.createCategoryChart(categoryData);

        } catch (error) {
            console.error('Real charts yuklash xatosi:', error);
            // Fallback - bo'sh chart
            this.createMainChart({ labels: [], revenue: [], orders: [], profit: [] });
            this.createCategoryChart({ labels: [], values: [], colors: [] });
        }
    }

    // Kategoriyalarni buyurtmalardan hisoblash (brendlar bo'yicha)
    processCategoryData(orders) {
        // Mahsulot nomidan brendni aniqlash
        const getBrand = (productName) => {
            const name = (productName || '').toLowerCase();

            // ONLEM BREND (Pampers, advantage)
            if (name.includes('onlem') || name.includes('advantage')) {
                return 'ONLEM BREND';
            }
            // Sa gel
            if (name.includes('sa gel') || name.includes('sagel')) {
                return 'Sa gel';
            }
            // Unilever (Dove, Rexona, Axe, Clear, Sunsilk)
            if (name.includes('dove') || name.includes('rexona') || name.includes('axe') ||
                name.includes('clear') || name.includes('sunsilk') || name.includes('domestos')) {
                return 'Unilever';
            }
            // Procter & Gamble (Ariel, Tide, Pampers, Gillette, Head&Shoulders)
            if (name.includes('ariel') || name.includes('tide') || name.includes('gillette') ||
                name.includes('head') || name.includes('pantene') || name.includes('fairy')) {
                return 'Procter';
            }
            // Henkel (Persil, Pril, Schwarzkopf)
            if (name.includes('persil') || name.includes('pril') || name.includes('schwarzkopf') ||
                name.includes('henkel') || name.includes('fa ')) {
                return 'Henkel';
            }
            // AKX Walner
            if (name.includes('akx') || name.includes('walner')) {
                return 'AKX Walner';
            }
            // EKKO, MIF, RAKHSHA, CALGON
            if (name.includes('ekko') || name.includes('mif') || name.includes('rakhsha') ||
                name.includes('calgon') || name.includes('chistol')) {
                return 'Mahalliy brendlar';
            }
            return 'Aralash';
        };

        const brandSales = {};

        orders.forEach(order => {
            const items = order.orderProducts || order.product || order.items || [];
            items.forEach(item => {
                const productName = item.product?.name || item.name || '';
                const brand = getBrand(productName);
                const amount = parseFloat(item.summa) || parseFloat(item.totalSumma) || 0;

                if (!brandSales[brand]) {
                    brandSales[brand] = 0;
                }
                brandSales[brand] += amount;
            });
        });

        // Top 5 brend
        const sorted = Object.entries(brandSales)
            .filter(([_, val]) => val > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 7);

        const colors = [
            '#3b82f6', // blue - ONLEM
            '#22c55e', // green - Sa gel
            '#f97316', // orange - Unilever
            '#06b6d4', // cyan - Procter
            '#a855f7', // purple - Henkel
            '#ef4444', // red - AKX Walner
            '#eab308', // yellow - Mahalliy
            '#ec4899'  // pink - Aralash
        ];

        // Agar kategoriya ma'lumoti yo'q bo'lsa
        if (sorted.length === 0) {
            return {
                labels: ['Ma\'lumot yo\'q'],
                values: [100],
                colors: ['#666']
            };
        }

        return {
            labels: sorted.map(([name]) => name),
            values: sorted.map(([, val]) => val),
            colors: colors.slice(0, sorted.length)
        };
    }

    processOrdersForChart(orders) {
        const labels = [];
        const revenue = [];
        const ordersCount = [];
        const profit = [];

        // Oxirgi 30 kun
        const days = this.currentPeriod === 'week' ? 7 :
            this.currentPeriod === 'month' ? 30 :
                this.currentPeriod === 'year' ? 365 : 1;

        const dailyData = {};
        const now = new Date();

        // Initalize days
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            dailyData[dateStr] = { revenue: 0, orders: 0, profit: 0 };
        }

        // Process orders
        orders.forEach(order => {
            const orderDate = order.dateCreate || order.dateDocument || order.orderCreated;
            if (orderDate) {
                const dateStr = orderDate.split('T')[0].split(' ')[0];
                if (dailyData[dateStr]) {
                    dailyData[dateStr].revenue += parseFloat(order.totalSumma) || parseFloat(order.totalSummaAfterDiscount) || 0;
                    dailyData[dateStr].orders += 1;
                    dailyData[dateStr].profit += (parseFloat(order.totalSumma) || 0) * 0.15;
                }
            }
        });

        // Convert to arrays
        Object.keys(dailyData).sort().forEach(dateStr => {
            const date = new Date(dateStr);
            labels.push(date.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' }));
            revenue.push(dailyData[dateStr].revenue);
            ordersCount.push(dailyData[dateStr].orders);
            profit.push(dailyData[dateStr].profit);
        });

        return { labels, revenue, orders: ordersCount, profit };
    }

    async loadRealTables() {
        try {
            const allOrders = this.cachedOrders || [];

            // Agent nomlarini API dan olish (bir marta)
            if (!this.cachedAgentNames) {
                try {
                    const agentResp = await this.api.request('getAgent', { limit: 100 });
                    const agents = agentResp?.result?.agent || [];
                    this.cachedAgentNames = {};
                    agents.forEach(a => {
                        if (a.SD_id && a.name) {
                            this.cachedAgentNames[a.SD_id] = a.name;
                        }
                    });
                    console.log(`✅ ${agents.length} ta agent nomi yuklandi`);
                } catch (e) {
                    console.error('Agent nomlarini yuklash xatosi:', e);
                    this.cachedAgentNames = {};
                }
            }

            // Tanlangan davr bo'yicha filtrlash (API filter ishlamaydi!)
            const { startDate, endDate } = this.getDateRange();
            const orders = allOrders.filter(order => {
                const orderDate = (order.dateCreate || order.dateDocument || '').split('T')[0].split(' ')[0];
                return orderDate >= startDate && orderDate <= endDate;
            });

            console.log(`📊 Davr: ${startDate} - ${endDate}, Buyurtmalar: ${orders.length}/${allOrders.length}`);

            // Tan narxlarni olish
            const costPrices = await this.fetchCostPrices();

            // === TOP MAHSULOTLAR ===
            // Haqiqiy tan narx asosida foyda hisoblash
            const productStats = {};
            orders.forEach(order => {
                const items = order.orderProducts || [];
                items.forEach(item => {
                    const productId = item.product?.SD_id || item.product?.name || 'unknown';
                    const productName = item.product?.name || 'Noma\'lum';
                    const quantity = parseFloat(item.quantity) || 0;
                    const summa = parseFloat(item.summa) || 0;
                    const summaUZS = this.getSummaInUZS(summa);

                    // Tan narxdan foyda hisoblash - summaUZS ishlatish!
                    const costData = costPrices[productId];
                    const profit = this.calculateProfit(summaUZS, costData?.costPriceUZS || 0, quantity);

                    if (!productStats[productId]) {
                        productStats[productId] = {
                            name: productName,
                            sold: 0,
                            revenue: 0,
                            profit: 0
                        };
                    }
                    productStats[productId].sold += quantity;
                    productStats[productId].revenue += summaUZS;
                    productStats[productId].profit += profit;
                });
            });

            // Top 5 mahsulot (sotilgan miqdor bo'yicha)
            const topProducts = Object.values(productStats)
                .sort((a, b) => b.sold - a.sold)
                .slice(0, 5);

            const productsHtml = topProducts.length > 0 ? topProducts.map(p => `
                <tr>
                    <td>
                        <div class="product-info">
                            <div class="product-image">📦</div>
                            <span class="product-name">${p.name}</span>
                        </div>
                    </td>
                    <td>${this.formatNumber(p.sold)}</td>
                    <td>${this.formatCurrency(p.revenue)}</td>
                    <td>
                        <span class="profit-badge">
                            ${this.formatCurrency(p.profit)}
                        </span>
                    </td>
                </tr>
            `).join('') : '<tr><td colspan="4">Ma\'lumot yo\'q</td></tr>';

            document.getElementById('topProductsTable').innerHTML = productsHtml;

            // === TOP AGENTLAR ===
            // Agentlarni cachedAgentDebts dan olish (agar mavjud bo'lsa)
            let topAgents = [];

            if (this.cachedAgentDebts && this.cachedAgentDebts.length > 0) {
                // Qarzdorlik ma'lumotlaridan agentlarni olish
                topAgents = this.cachedAgentDebts
                    .slice(0, 5)
                    .map(a => ({
                        name: a.name || 'Noma\'lum',
                        initials: (a.name || 'NA').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
                        sales: Math.abs(a.totalSom || 0),
                        clients: a.clientCount || 0,
                        profit: Math.abs(a.totalSom || 0) * 0.15  // 15% foyda
                    }));
            } else {
                // Agent nomlari (ID -> Ism) - faqat API da ism yo'q bo'lsa ishlatiladi
                const agentNames = {
                    'd0_2': 'Nilufarxon',
                    'd0_3': 'Muxtorxon aka Onlem',
                    'd0_4': 'Ofis',
                    'd0_6': 'Usmonqulov Asadulloh',
                    'd0_7': 'Axmedova Xalimaxon',
                    'd0_10': 'Abduraximova Muxayyoxon',
                    'd0_11': 'Aliakbar Yusupov',
                    'd0_19': 'Soliev Ibrohimjon',
                    'd0_21': 'Maxmudov Abdulazizxon',
                    'd0_22': 'Tojiboyev Abubakir',
                    'd0_24': 'Xolmirzayeva Honzodaxon',
                    'd0_25': 'Xolmuxamedova Ziroatxon',
                    'd0_27': 'Muxtorxon aka Sleppy'
                };

                // Buyurtmalardan agentlarni olish
                // Haqiqiy tan narx asosida foyda hisoblash
                const agentStats = {};
                orders.forEach(order => {
                    const agentId = order.agent?.SD_id || 'unknown';
                    // MUHIM: Avval cachedAgentNames (API dan), keyin order.agent.name, keyin mapping
                    const cachedName = this.cachedAgentNames?.[agentId];
                    const orderAgentName = order.agent?.name || '';
                    const mappedName = agentNames[agentId];
                    const agentName = cachedName || orderAgentName || mappedName || `Agent ${agentId.replace('d0_', '')}`;

                    const clientId = order.client?.SD_id || 'unknown';
                    const summa = this.getSummaInUZS(parseFloat(order.totalSumma) || 0);

                    // Har bir mahsulot uchun foydani hisoblash
                    // item.summa dollarda, tan narxlar ham dollarda
                    let orderProfit = 0;
                    const USD_RATE = this.getUsdRate();
                    const orderProducts = order.orderProducts || [];

                    if (orderProducts.length > 0) {
                        orderProducts.forEach(item => {
                            const productId = item.product?.SD_id;
                            const quantity = parseFloat(item.quantity) || 0;
                            const rawSumma = parseFloat(item.summa) || 0;
                            // Valyutani aniqlash: > 100 = UZS, <= 100 = USD
                            const itemSummaUZS = rawSumma > 100 ? rawSumma : rawSumma * USD_RATE;

                            const costData = costPrices[productId];
                            const costPriceUZS = costData?.costPriceUZS || 0;

                            if (costPriceUZS <= 0) {
                                // Tan narx yo'q (bonus) - butun summa foyda
                                orderProfit += itemSummaUZS;
                            } else {
                                // Foyda = Sotish narxi - Tan narx * soni
                                const totalCost = costPriceUZS * quantity;
                                const itemProfit = itemSummaUZS - totalCost;
                                orderProfit += Math.max(0, itemProfit);
                            }
                        });
                    } else {
                        // orderProducts yo'q - 15% taxminiy foyda
                        orderProfit = summa * 0.15;
                    }

                    if (agentId !== 'unknown') {
                        if (!agentStats[agentId]) {
                            agentStats[agentId] = {
                                name: agentName || `Agent ${agentId}`,
                                sales: 0,
                                profit: 0,
                                clients: new Set()
                            };
                        }
                        agentStats[agentId].sales += summa;
                        agentStats[agentId].profit += orderProfit;
                        agentStats[agentId].clients.add(clientId);
                    }
                });

                topAgents = Object.entries(agentStats)
                    .sort(([, a], [, b]) => b.sales - a.sales)
                    .slice(0, 5)
                    .map(([id, a]) => ({
                        id: id,
                        name: a.name,
                        initials: a.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
                        sales: a.sales,
                        clients: a.clients.size,
                        profit: a.profit
                    }));
            }

            const agentsHtml = topAgents.length > 0 ? topAgents.map(a => `
                <tr class="clickable-row" onclick="window.app.openAgentDetail('${a.id || ''}', '${a.name}')" title="Mijozlarni ko'rish">
                    <td>
                        <div class="agent-info">
                            <div class="agent-avatar">${a.initials}</div>
                            <span>${a.name}</span>
                        </div>
                    </td>
                    <td>${this.formatCurrency(a.sales)}</td>
                    <td>${a.clients}</td>
                    <td>
                        <span class="profit-badge">${this.formatCurrency(a.profit)}</span>
                    </td>
                </tr>
            `).join('') : '<tr><td colspan="4">Ma\'lumot yo\'q</td></tr>';

            document.getElementById('topAgentsTable').innerHTML = agentsHtml;

        } catch (error) {
            console.error('Real tables yuklash xatosi:', error);
            // Fallback to demo
            await this.loadTables();
        }
    }

    async loadRealActivity() {
        // API dan so'nggi faoliyatni olish
        // Hozircha demo data ishlatamiz, chunki API strukturasi noma'lum
        await this.loadActivity();
    }

    // ============ DEMO DATA LOADING ============

    async loadStats() {
        const stats = this.demo.getDashboardStats();

        // Animate stat values
        this.animateValue('totalSales', 0, stats.totalSales, 1500, this.formatCurrency.bind(this));
        this.animateValue('totalOrders', 0, stats.totalOrders, 1200, this.formatNumber.bind(this));
        this.animateValue('totalClients', 0, stats.totalClients, 1000, this.formatNumber.bind(this));
        this.animateValue('totalProducts', 0, stats.totalProducts, 800, this.formatNumber.bind(this));

        // Update sparklines
        this.createSparkline('salesSparkline', this.demo.getSparklineData(), '#0071e3');
        this.createSparkline('ordersSparkline', this.demo.getSparklineData(), '#34c759');
        this.createSparkline('clientsSparkline', this.demo.getSparklineData(), '#af52de');
        this.createSparkline('productsSparkline', this.demo.getSparklineData(), '#ff9500');
    }

    async loadCharts() {
        const chartData = this.demo.getRevenueChartData(30);
        this.createMainChart(chartData);

        const categoryData = this.demo.getCategoryData();
        this.createCategoryChart(categoryData);
    }

    async loadTables() {
        // Top Products
        const products = this.demo.getTopProducts(5);
        const productsHtml = products.map(p => `
            <tr>
                <td>
                    <div class="product-info">
                        <div class="product-image">📦</div>
                        <span class="product-name">${p.name}</span>
                    </div>
                </td>
                <td>${this.formatNumber(p.sold)}</td>
                <td>${this.formatCurrency(p.revenue)}</td>
                <td>
                    <span class="trend-badge ${p.trend}">
                        ${p.trend === 'up' ? '↑' : '↓'} ${p.trendValue}%
                    </span>
                </td>
            </tr>
        `).join('');
        document.getElementById('topProductsTable').innerHTML = productsHtml;

        // Top Agents
        const agents = this.demo.getTopAgents(5);
        const agentsHtml = agents.map(a => `
            <tr>
                <td>
                    <div class="agent-info">
                        <div class="agent-avatar">${a.initials}</div>
                        <span>${a.name}</span>
                    </div>
                </td>
                <td>${this.formatCurrency(a.sales)}</td>
                <td>${a.clients}</td>
                <td>
                    <div class="rating">
                        <svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                        <span>${a.rating}</span>
                    </div>
                </td>
            </tr>
        `).join('');
        document.getElementById('topAgentsTable').innerHTML = agentsHtml;
    }

    async loadActivity() {
        const activities = this.demo.getRecentActivity(10);
        const icons = {
            sale: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
            order: '<svg viewBox="0 0 24 24" fill="none"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" stroke-width="2"/></svg>',
            client: '<svg viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="2"/></svg>',
            product: '<svg viewBox="0 0 24 24" fill="none"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" stroke="currentColor" stroke-width="2"/></svg>'
        };

        const html = activities.map(a => `
            <div class="activity-item">
                <div class="activity-icon ${a.icon}">${icons[a.icon]}</div>
                <div class="activity-content">
                    <div class="activity-title">${a.title}</div>
                    <div class="activity-description">${a.description}</div>
                </div>
                <div class="activity-time">${a.time}</div>
            </div>
        `).join('');

        const activityList = document.getElementById('activityList');
        if (activityList) {
            activityList.innerHTML = html;
        }
    }

    // Chart Creation
    createSparkline(canvasId, data, color) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 50);
        gradient.addColorStop(0, color + '40');
        gradient.addColorStop(1, color + '00');

        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map((_, i) => i),
                datasets: [{
                    data: data,
                    borderColor: color,
                    borderWidth: 2,
                    fill: true,
                    backgroundColor: gradient,
                    tension: 0.4,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                scales: { x: { display: false }, y: { display: false } }
            }
        });
    }

    createMainChart(data) {
        const canvas = document.getElementById('mainChart');
        if (!canvas) return;

        if (this.charts.mainChart) {
            this.charts.mainChart.destroy();
        }

        const ctx = canvas.getContext('2d');
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
        const textColor = isDark ? '#a1a1a6' : '#86868b';

        this.charts.mainChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Daromad',
                    data: data.revenue,
                    borderColor: '#0071e3',
                    backgroundColor: 'rgba(0, 113, 227, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { intersect: false, mode: 'index' },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: isDark ? '#2c2c2e' : '#ffffff',
                        titleColor: isDark ? '#f5f5f7' : '#1d1d1f',
                        bodyColor: isDark ? '#a1a1a6' : '#86868b',
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: (context) => this.formatCurrency(context.raw)
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: gridColor },
                        ticks: { color: textColor, maxRotation: 0 }
                    },
                    y: {
                        grid: { color: gridColor },
                        ticks: {
                            color: textColor,
                            callback: (value) => this.formatCompactNumber(value)
                        }
                    }
                }
            }
        });

        this.chartData = data;
    }

    updateMainChart(type) {
        if (!this.charts.mainChart || !this.chartData) return;

        const colors = {
            revenue: { border: '#0071e3', bg: 'rgba(0, 113, 227, 0.1)' },
            orders: { border: '#34c759', bg: 'rgba(52, 199, 89, 0.1)' },
            profit: { border: '#af52de', bg: 'rgba(175, 82, 222, 0.1)' }
        };

        const dataMap = {
            revenue: this.chartData.revenue,
            orders: this.chartData.orders,
            profit: this.chartData.profit
        };

        this.charts.mainChart.data.datasets[0].data = dataMap[type];
        this.charts.mainChart.data.datasets[0].borderColor = colors[type].border;
        this.charts.mainChart.data.datasets[0].backgroundColor = colors[type].bg;
        this.charts.mainChart.update();
    }

    createCategoryChart(data) {
        const canvas = document.getElementById('categoryChart');
        if (!canvas) return;


        if (this.charts.categoryChart) {
            this.charts.categoryChart.destroy();
        }

        const ctx = canvas.getContext('2d');

        // Data format: { labels: [], values: [], colors: [] }
        const labels = data.labels || [];
        const values = data.values || [];
        const colors = data.colors || ['#3b82f6', '#22c55e', '#f97316', '#06b6d4', '#a855f7'];

        // Foizga aylantirish
        const total = values.reduce((sum, v) => sum + v, 0);
        const percentages = values.map(v => total > 0 ? Math.round((v / total) * 100) : 0);

        this.charts.categoryChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderWidth: 0,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: { display: false }
                }
            }
        });

        // Create legend
        const legendHtml = labels.map((label, i) => `
            <div class="legend-item">
                <span class="legend-color" style="background: ${colors[i] || '#666'}"></span>
                <span>${label} (${percentages[i]}%)</span>
            </div>
        `).join('');

        const legendEl = document.getElementById('categoryLegend');
        if (legendEl) {
            legendEl.innerHTML = legendHtml;
        }
    }

    updateChartColors() {
        if (this.chartData) {
            this.createMainChart(this.chartData);
        }
    }

    // Utility Methods
    formatNumber(num) {
        return new Intl.NumberFormat('uz-UZ').format(num);
    }

    formatCurrency(num) {
        // To'liq raqam ko'rsatish (mln emas)
        return Math.round(Math.abs(num)).toLocaleString('ru-RU');
    }

    formatCompactNumber(num) {
        if (num >= 1000000000) return (num / 1000000000).toFixed(0) + 'B';
        if (num >= 1000000) return (num / 1000000).toFixed(0) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(0) + 'K';
        return num;
    }

    animateValue(elementId, start, end, duration, formatter) {
        const element = document.getElementById(elementId);
        if (!element) return;

        const startTime = performance.now();

        const update = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            const current = Math.floor(start + (end - start) * easeProgress);

            element.textContent = formatter(current);

            if (progress < 1) {
                requestAnimationFrame(update);
            }
        };

        requestAnimationFrame(update);
    }

    // Loading & Toast
    showLoading() {
        document.getElementById('loadingOverlay')?.classList.add('active');
    }

    hideLoading() {
        document.getElementById('loadingOverlay')?.classList.remove('active');
    }

    showToast(type, title, message) {
        const container = document.getElementById('toastContainer');
        const icons = {
            success: '<svg viewBox="0 0 24 24" fill="none"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" stroke-width="2"/><path d="M22 4L12 14.01l-3-3" stroke="currentColor" stroke-width="2"/></svg>',
            error: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" stroke-width="2"/></svg>',
            warning: '<svg viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" stroke-width="2"/><path d="M12 9v4M12 17h.01" stroke="currentColor" stroke-width="2"/></svg>',
            info: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 16v-4M12 8h.01" stroke="currentColor" stroke-width="2"/></svg>'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-icon">${icons[type]}</div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close">×</button>
        `;

        container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);

        const close = () => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        };

        toast.querySelector('.toast-close').addEventListener('click', close);
        setTimeout(close, 5000);
    }

    // Modal
    openConfigModal() {
        const config = this.api.config;
        document.getElementById('serverUrl').value = config.serverUrl || 'rafiq.salesdoc.io';
        document.getElementById('apiLogin').value = config.login || '';
        document.getElementById('apiPassword').value = '';
        document.getElementById('connectionStatus').style.display = 'none';
        document.getElementById('configModal').classList.add('active');
    }

    closeModal() {
        document.getElementById('configModal').classList.remove('active');
        document.getElementById('connectionStatus').style.display = 'none';
    }

    async saveApiConfig() {
        const serverUrl = document.getElementById('serverUrl').value.trim();
        const login = document.getElementById('apiLogin').value.trim();
        const password = document.getElementById('apiPassword').value;

        if (!serverUrl || !login || !password) {
            this.showConnectionStatus('error', 'Barcha maydonlarni to\'ldiring');
            return;
        }

        this.showConnectionStatus('loading', 'Ulanmoqda...');

        try {
            const result = await this.api.login(login, password, serverUrl);

            if (result.success) {
                this.useRealData = true; // Real data rejimini yoqish
                this.showConnectionStatus('success', 'Muvaffaqiyatli ulandi!');
                this.showToast('success', 'Ulandi', 'Sales Doctor API ga muvaffaqiyatli ulandi');

                setTimeout(() => {
                    this.closeModal();
                    this.loadDashboard(); // Real data bilan qayta yuklash
                }, 1500);
            } else {
                this.showConnectionStatus('error', result.error);
            }
        } catch (error) {
            this.showConnectionStatus('error', 'Serverga ulanib bo\'lmadi: ' + error.message);
        }
    }

    showConnectionStatus(type, message) {
        const statusDiv = document.getElementById('connectionStatus');
        const statusText = document.getElementById('statusText');

        statusDiv.style.display = 'block';
        statusText.textContent = message;

        statusDiv.style.background = type === 'success' ? 'rgba(52, 199, 89, 0.1)' :
            type === 'error' ? 'rgba(255, 59, 48, 0.1)' :
                'rgba(0, 113, 227, 0.1)';
        statusDiv.style.color = type === 'success' ? '#34c759' :
            type === 'error' ? '#ff3b30' : '#0071e3';
    }

    // Section Switching
    switchSection(section) {
        // Hide all sections
        document.querySelector('.dashboard-content')?.style.setProperty('display', 'none');
        document.getElementById('salesSection')?.style.setProperty('display', 'none');
        document.getElementById('productsSection')?.style.setProperty('display', 'none');
        document.getElementById('clientsSection')?.style.setProperty('display', 'none');
        document.getElementById('agentsSection')?.style.setProperty('display', 'none');
        document.getElementById('lowstockSection')?.style.setProperty('display', 'none');
        document.getElementById('reportsSection')?.style.setProperty('display', 'none');

        // Update page title
        const titles = {
            dashboard: { title: 'Dashboard', subtitle: 'Umumiy ko\'rinish' },
            sales: { title: 'Sotuvlar', subtitle: 'Barcha buyurtmalar' },
            products: { title: 'Mahsulotlar', subtitle: 'Mahsulotlar katalogi' },
            clients: { title: 'Mijozlar', subtitle: 'Mijozlar bazasi' },
            agents: { title: 'Agentlar', subtitle: 'Sotuvchilar ro\'yxati' },
            lowstock: { title: 'Buyurtma', subtitle: 'Kam qolgan mahsulotlar' },
            reports: { title: 'Hisobotlar', subtitle: 'Tahlil va hisobotlar' }
        };

        const pageTitle = titles[section] || titles.dashboard;
        document.querySelector('.page-title h1').textContent = pageTitle.title;
        document.querySelector('.page-subtitle').textContent = pageTitle.subtitle;

        // Show selected section and load data
        switch (section) {
            case 'dashboard':
                document.querySelector('.dashboard-content')?.style.setProperty('display', 'block');
                break;
            case 'sales':
                document.getElementById('salesSection')?.style.setProperty('display', 'block');
                this.loadSalesSection();
                break;
            case 'products':
                document.getElementById('productsSection')?.style.setProperty('display', 'block');
                this.loadProductsSection();
                break;
            case 'clients':
                document.getElementById('clientsSection')?.style.setProperty('display', 'block');
                this.loadClientsSection();
                break;
            case 'agents':
                document.getElementById('agentsSection')?.style.setProperty('display', 'block');
                this.loadAgentsSection();
                break;
            case 'lowstock':
                document.getElementById('lowstockSection')?.style.setProperty('display', 'block');
                this.loadLowstockSection();
                break;
            case 'reports':
                document.getElementById('reportsSection')?.style.setProperty('display', 'block');
                break;
        }
    }

    // Load Sales Section
    async loadSalesSection() {
        const tbody = document.getElementById('salesTableBody');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px;">Yuklanmoqda...</td></tr>';

        try {
            // Server cache dan period bo'yicha buyurtmalarni olish
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const CACHE_BASE_URL = isLocal
                ? 'http://localhost:3000'
                : 'https://sd-analitika-production.up.railway.app';

            const ordersRes = await this.fetchWithTimeout(`${CACHE_BASE_URL}/api/cache/orders/${this.currentPeriod}`, 5000);
            const ordersData = await ordersRes.json();
            const orders = (ordersData.status && ordersData.result?.order) ? ordersData.result.order : [];

            // Agent nomlarni cache dan olish
            let agentNameMap = {};
            try {
                const agentsRes = await this.fetchWithTimeout(`${CACHE_BASE_URL}/api/cache/agents`, 3000);
                const agentsData = await agentsRes.json();
                if (agentsData.status && agentsData.result?.agent) {
                    agentsData.result.agent.forEach(a => {
                        agentNameMap[a.SD_id] = a.name;
                    });
                }
            } catch (e) { }

            if (orders.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px;">Ma\'lumot topilmadi</td></tr>';
                return;
            }

            const USD_RATE = this.getUsdRate();

            // Sanasi bo'yicha tartiblash (eng yangi birinchi)
            const sortedOrders = [...orders].sort((a, b) => {
                const dateA = new Date(a.dateCreate || a.dateDocument || 0);
                const dateB = new Date(b.dateCreate || b.dateDocument || 0);
                return dateB - dateA;
            });

            tbody.innerHTML = sortedOrders.map(order => {
                const statusMap = {
                    0: { class: 'pending', text: 'Kutilmoqda' },
                    1: { class: 'active', text: 'Tasdiqlangan' },
                    2: { class: 'pending', text: 'Jarayonda' },
                    3: { class: 'active', text: 'Yuklandi' },
                    4: { class: 'inactive', text: 'Qaytarish' },
                    5: { class: 'inactive', text: 'Bekor' }
                };
                const statusInfo = statusMap[order.status] || { class: 'pending', text: 'Noma\'lum' };

                const clientName = order.client?.clientName || order.client?.clientLegalName || order.client?.name || 'Noma\'lum';
                const agentId = order.agent?.SD_id;
                const agentName = agentNameMap[agentId] || order.agent?.name || 'Noma\'lum';
                const date = order.dateCreate ? new Date(order.dateCreate).toLocaleDateString('uz-UZ') :
                    order.date ? new Date(order.date).toLocaleDateString('uz-UZ') : '-';

                const isDollar = this.isUsdOrder(order);
                const totalSumma = parseFloat(order.totalSumma) || 0;
                const summaUZS = isDollar ? totalSumma * USD_RATE : totalSumma;
                const sum = this.formatCurrency(summaUZS);
                const dollarTag = isDollar ? ' <span style="color: #10b981; font-size: 11px;">($)</span>' : '';

                return `
                    <tr>
                        <td>${order.SD_id || order.CS_id || '-'}</td>
                        <td>${date}</td>
                        <td>${clientName}</td>
                        <td>${agentName}</td>
                        <td><strong>${sum}</strong>${dollarTag}</td>
                        <td><span class="status-badge ${statusInfo.class}">${statusInfo.text}</span></td>
                    </tr>
                `;
            }).join('');
        } catch (error) {
            console.error('Sotuvlar yuklash xatosi:', error);
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #ff3b30;">Xatolik yuz berdi</td></tr>';
        }
    }

    // Load Products Section
    async loadProductsSection() {
        const grid = document.getElementById('productsGrid');
        const searchInput = document.getElementById('productSearch');
        if (!grid) return;

        grid.innerHTML = '<div style="text-align: center; padding: 40px; grid-column: 1/-1;">Yuklanmoqda...</div>';

        try {
            // Server cache dan mahsulotlarni olish
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const CACHE_BASE_URL = isLocal
                ? 'http://localhost:3000'
                : 'https://sd-analitika-production.up.railway.app';

            // Mahsulotlar va stock ni parallel yuklash
            const [productsRes, stockRes] = await Promise.all([
                this.fetchWithTimeout(`${CACHE_BASE_URL}/api/cache/products`, 5000),
                this.fetchWithTimeout(`${CACHE_BASE_URL}/api/cache/stock`, 5000)
            ]);

            const productsData = await productsRes.json();
            const stockData = await stockRes.json();

            const allProducts = (productsData.status && productsData.result?.product) ? productsData.result.product : [];
            const warehouses = (stockData.status && stockData.result?.warehouse) ? stockData.result.warehouse : [];

            console.log('🏷️ Jami mahsulotlar (cache):', allProducts.length);

            // Stock mapping
            const stockMap = {};
            warehouses.forEach(warehouse => {
                const products = warehouse.products || [];
                products.forEach(item => {
                    const productId = item.SD_id;
                    const quantity = parseFloat(item.quantity) || 0;
                    if (productId && quantity > 0) {
                        stockMap[productId] = (stockMap[productId] || 0) + quantity;
                    }
                });
            });

            console.log('📦 Stock map (cache):', Object.keys(stockMap).length, 'ta mahsulot');

            if (allProducts.length === 0) {
                grid.innerHTML = '<div style="text-align: center; padding: 40px; grid-column: 1/-1;">Mahsulot topilmadi</div>';
                return;
            }

            // Mahsulotlarni cache qilish qidiruv uchun
            this.cachedProducts = allProducts;
            this.stockMap = stockMap;

            // Qidiruvni sozlash
            if (searchInput) {
                searchInput.oninput = () => this.filterProducts(searchInput.value);
            }

            this.renderProductsGrid(allProducts, stockMap);
        } catch (error) {
            console.error('Mahsulotlar yuklash xatosi:', error);
            grid.innerHTML = '<div style="text-align: center; padding: 40px; grid-column: 1/-1; color: #ff3b30;">Xatolik yuz berdi</div>';
        }
    }

    // Mahsulotlarni filterlash
    filterProducts(query) {
        // Debounce uchun
        clearTimeout(this.filterTimeout);
        this.filterTimeout = setTimeout(() => {
            const products = this.cachedProducts || [];
            const q = query.toLowerCase().trim();

            console.log(`🔍 Qidiruv: "${q}" (${products.length} ta mahsulot ichida)`);

            if (!q) {
                this.renderProductsGrid(products, this.stockMap);
                return;
            }

            // So'zlarni ajratish va har birini alohida qidirish
            const words = q.split(/\s+/).filter(w => w.length > 0);

            const filtered = products.filter(p => {
                const name = (p.name || '').toLowerCase();
                const category = (p.category?.name || '').toLowerCase();
                const id = (p.SD_id || '').toLowerCase();
                const searchText = `${name} ${category} ${id}`;

                // Barcha so'zlar mavjud bo'lishi kerak
                return words.every(word => searchText.includes(word));
            });

            console.log(`✅ Topildi: ${filtered.length} ta`);
            this.renderProductsGrid(filtered, this.stockMap);
        }, 300);
    }

    // Mahsulotlar gridini render qilish
    renderProductsGrid(products, stockMap = {}) {
        const grid = document.getElementById('productsGrid');
        if (!grid) return;

        if (products.length === 0) {
            grid.innerHTML = '<div style="text-align: center; padding: 40px; grid-column: 1/-1;">Mahsulot topilmadi</div>';
            return;
        }

        grid.innerHTML = products.slice(0, 100).map(product => {
            const productId = product.SD_id || product.CS_id;
            const stock = stockMap[productId] || 0;
            const stockColor = stock > 10 ? '#10b981' : stock > 0 ? '#f59e0b' : '#ef4444';
            const stockText = stock > 0 ? stock.toLocaleString() : 'Yo\'q';

            return `
                <div class="product-card">
                    <div class="product-card-image">📦</div>
                    <div class="product-card-title">${product.name || 'Noma\'lum'}</div>
                    <div class="product-card-price">${product.category?.name || 'Kategoriyasiz'}</div>
                    <div class="product-card-stock" style="margin-top: 8px; font-size: 13px;">
                        <span style="color: #888;">Qoldiq:</span>
                        <span style="color: ${stockColor}; font-weight: 600;">${stockText}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Load Clients Section
    async loadClientsSection() {
        const tbody = document.getElementById('clientsTableBody');
        const searchInput = document.getElementById('clientSearch');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px;">Yuklanmoqda... (Mijozlar)</td></tr>';

        try {
            // 1. Barcha mijozlarni yuklash - CACHE dan
            let allClients = [];
            try {
                const baseUrl = this.getCacheBaseUrl();
                const cRes = await fetch(`${baseUrl}/api/cache/clients`);
                const cData = await cRes.json();
                if (cData.status && cData.result?.client) {
                    allClients = cData.result.client;
                    console.log('⚡ Mijozlar cache dan:', allClients.length);
                }
            } catch (e) {
                // Fallback
                for (let page = 1; page <= 20; page++) {
                    const clientsRes = await this.api.getClients({ page, limit: 500 });
                    const clients = clientsRes?.result?.client || [];
                    if (clients.length === 0) break;
                    allClients = allClients.concat(clients);
                    if (clients.length < 500) break;
                }
            }
            console.log('👥 Jami mijozlar:', allClients.length);

            // 2. Qarzdorlikni yuklash - CACHE dan (tezkor!)
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px;">Yuklanmoqda... (Qarzdorlik)</td></tr>';
            const balances = await this.fetchAllBalances();

            console.log('📊 Balanslar:', balances.length, 'ta');

            // Client ID -> Qarzdorlik map (DOLLAR bo'yicha)
            // by-currency[].currency_id === 'd0_4' = dollar
            const debtMap = {};
            const clientNameMap = {}; // Nomga qarab map

            balances.forEach(b => {
                const clientId = b.SD_id; // Balance o'zida SD_id bor
                const clientName = (b.name || '').toLowerCase().trim();

                // by-currency dan dollar olish
                const byCurrency = b['by-currency'] || [];
                let dollarDebt = 0;

                byCurrency.forEach(c => {
                    const amount = parseFloat(c.amount) || 0;
                    if (c.currency_id === 'd0_4') { // Dollar
                        dollarDebt = amount;
                    }
                });

                // Faqat qarz (minus) bo'lsa saqlash
                if (clientId && dollarDebt < 0) {
                    debtMap[clientId] = Math.abs(dollarDebt);
                }
                if (clientName && dollarDebt < 0) {
                    clientNameMap[clientName] = Math.abs(dollarDebt);
                }
            });

            // Shuningdek, nomga qarab ham map qilish
            this.clientNameDebtMap = clientNameMap;

            console.log('💰 Qarzdorlik ID bo\'yicha:', Object.keys(debtMap).length, 'ta');
            console.log('💰 Qarzdorlik nom bo\'yicha:', Object.keys(clientNameMap).length, 'ta');

            if (allClients.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px;">Mijoz topilmadi</td></tr>';
                return;
            }

            // Mijozlarni cache qilish
            this.cachedClients = allClients;
            this.clientDebtMap = debtMap;

            // Qidiruvni sozlash
            if (searchInput) {
                searchInput.oninput = () => this.filterClients(searchInput.value);
            }

            this.renderClientsTable(allClients, debtMap);
        } catch (error) {
            console.error('Mijozlar yuklash xatosi:', error);
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #ff3b30;">Xatolik yuz berdi</td></tr>';
        }
    }

    // Mijozlarni filterlash
    filterClients(query) {
        clearTimeout(this.clientFilterTimeout);
        this.clientFilterTimeout = setTimeout(() => {
            const clients = this.cachedClients || [];
            const debtMap = this.clientDebtMap || {};
            const q = query.toLowerCase().trim();

            console.log(`🔍 Mijoz qidiruv: "${q}" (${clients.length} ta ichida)`);

            if (!q) {
                this.renderClientsTable(clients, debtMap);
                return;
            }

            const words = q.split(/\s+/).filter(w => w.length > 0);
            const filtered = clients.filter(c => {
                const name = (c.name || '').toLowerCase();
                const address = (c.address || '').toLowerCase();
                const tel = (c.tel || '').toLowerCase();
                const agent = (c.agents?.[0]?.name || '').toLowerCase();
                const searchText = `${name} ${address} ${tel} ${agent}`;
                return words.every(word => searchText.includes(word));
            });

            console.log(`✅ Topildi: ${filtered.length} ta mijoz`);
            this.renderClientsTable(filtered, debtMap);
        }, 300);
    }

    // Mijozlar jadvalini render qilish
    renderClientsTable(clients, debtMap = {}) {
        const tbody = document.getElementById('clientsTableBody');
        if (!tbody) return;

        if (clients.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px;">Mijoz topilmadi</td></tr>';
            return;
        }

        const usdRate = this.getUsdRate();
        const nameDebtMap = this.clientNameDebtMap || {};

        tbody.innerHTML = clients.slice(0, 100).map(client => {
            const status = client.active === 'Y' ? 'active' : 'inactive';
            const statusText = client.active === 'Y' ? 'Faol' : 'Nofaol';
            const agentName = client.agents?.[0]?.name || 'Belgilanmagan';
            const clientId = client.SD_id || client.CS_id;
            const clientName = (client.name || '').toLowerCase().trim();

            // Avval ID bo'yicha, keyin nom bo'yicha qidiramiz
            // debtMap allaqachon DOLLAR miqdorini saqlaydi
            let debtDollar = debtMap[clientId] || 0;
            if (debtDollar === 0 && clientName) {
                debtDollar = nameDebtMap[clientName] || 0;
            }

            // Qarzdorlik rang
            let debtColor = '#6b7280'; // Kulrang - qarz yo'q
            let debtText = '-';
            if (debtDollar > 0) {
                debtColor = '#ef4444'; // Qizil - qarz bor
                debtText = `$${debtDollar.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
            }

            return `
                <tr>
                    <td><strong>${client.name || 'Noma\'lum'}</strong></td>
                    <td>${client.address || '-'}</td>
                    <td>${client.tel || '-'}</td>
                    <td style="color: ${debtColor}; font-weight: bold;">${debtText}</td>
                    <td>${agentName}</td>
                    <td><span class="status-badge ${status}">${statusText}</span></td>
                </tr>
            `;
        }).join('');
    }

    // Load Agents Section
    async loadAgentsSection(period) {
        const grid = document.getElementById('agentsGrid');
        if (!grid) return;

        // Period ni aniqlash
        const activePeriod = period || this.currentPeriod || 'today';

        // Filter tugmalarni yangilash
        document.querySelectorAll('.agents-period-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.period === activePeriod) btn.classList.add('active');
        });

        grid.innerHTML = '<div style="text-align: center; padding: 40px; grid-column: 1/-1;">Yuklanmoqda...</div>';

        try {
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const CACHE_BASE_URL = isLocal
                ? 'http://localhost:3000'
                : 'https://sd-analitika-production.up.railway.app';

            // Barchasini parallel yuklash
            const [agentsRes, ordersRes, balancesRes] = await Promise.all([
                this.fetchWithTimeout(`${CACHE_BASE_URL}/api/cache/agents`, 3000),
                this.fetchWithTimeout(`${CACHE_BASE_URL}/api/cache/orders/${activePeriod}`, 5000),
                this.fetchWithTimeout(`${CACHE_BASE_URL}/api/cache/balances`, 5000)
            ]);

            const agentsData = await agentsRes.json();
            const ordersData = await ordersRes.json();
            const balancesData = await balancesRes.json();

            const agents = (agentsData.status && agentsData.result?.agent) ? agentsData.result.agent : [];
            const orders = (ordersData.status && ordersData.result?.order) ? ordersData.result.order : [];
            const balances = (balancesData.status && balancesData.result?.balance) ? balancesData.result.balance : [];

            if (agents.length === 0) {
                grid.innerHTML = '<div style="text-align: center; padding: 40px; grid-column: 1/-1;">Agent topilmadi</div>';
                return;
            }

            const usdRate = this.getUsdRate();

            // Agent → mijoz mapping (buyurtmalardan)
            const clientToAgent = {};
            const agentStats = {};

            orders.forEach(order => {
                // Qaytarishlarni o'tkazib yuborish
                if (order.status === 4 || order.status === 5) return;
                const returnsSumma = parseFloat(order.totalReturnsSumma) || 0;
                const totalSumma = parseFloat(order.totalSumma) || 0;
                if (returnsSumma > 0 && returnsSumma === totalSumma) return;

                const agentId = order.agent?.SD_id;
                const clientId = order.client?.SD_id;
                if (!agentId) return;

                if (clientId) clientToAgent[clientId] = agentId;

                if (!agentStats[agentId]) {
                    agentStats[agentId] = { salesUZS: 0, salesUSD: 0, clients: new Set(), debt: 0, orders: 0 };
                }

                const isDollar = this.isUsdOrder(order);
                if (isDollar) {
                    agentStats[agentId].salesUSD += totalSumma;
                    agentStats[agentId].salesUZS += totalSumma * usdRate;
                } else {
                    agentStats[agentId].salesUZS += totalSumma;
                    agentStats[agentId].salesUSD += totalSumma / usdRate;
                }

                agentStats[agentId].orders++;
                if (clientId) agentStats[agentId].clients.add(clientId);
            });

            // Qarzdorlikni hisoblash
            balances.forEach(b => {
                const clientId = b.SD_id;
                const agentId = clientToAgent[clientId];
                if (!agentId) return;

                const byCurrency = b['by-currency'] || [];
                byCurrency.forEach(c => {
                    if (c.currency_id === 'd0_4') { // Dollar
                        const amount = parseFloat(c.amount) || 0;
                        if (amount < 0) {
                            if (!agentStats[agentId]) {
                                agentStats[agentId] = { salesUZS: 0, salesUSD: 0, clients: new Set(), debt: 0, orders: 0 };
                            }
                            agentStats[agentId].debt += Math.abs(amount);
                        }
                    }
                });
            });

            const periodNames = { 'today': 'Bugun', 'yesterday': 'Kecha', 'week': 'Hafta', 'month': 'Oy', 'year': 'Yil' };

            // Agentlarni sotuvlar bo'yicha tartiblash
            const sortedAgents = [...agents].sort((a, b) => {
                const salesA = agentStats[a.SD_id]?.salesUZS || 0;
                const salesB = agentStats[b.SD_id]?.salesUZS || 0;
                return salesB - salesA;
            });

            grid.innerHTML = sortedAgents.map(agent => {
                const agentId = agent.SD_id;
                const initials = (agent.name || 'NA').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                const isActive = agent.active === 'Y';
                const stats = agentStats[agentId] || { salesUZS: 0, salesUSD: 0, clients: new Set(), debt: 0, orders: 0 };
                const salesUSD = Math.round(stats.salesUSD);
                const salesFormatted = salesUSD >= 1000 ? `$${(salesUSD / 1000).toFixed(1)}k` : `$${salesUSD.toLocaleString()}`;
                const clientCount = stats.clients.size || 0;
                const debtK = stats.debt > 1000 ? `$${(stats.debt / 1000).toFixed(0)}k` : stats.debt > 0 ? `$${stats.debt.toFixed(0)}` : '-';

                return `
                    <div class="agent-card" onclick="window.app?.showAgentClients('${agentId}')" style="cursor: pointer;">
                        <div class="agent-card-avatar">${initials}</div>
                        <div class="agent-card-name">${agent.name || 'Noma\'lum'}</div>
                        <div class="agent-card-role">${isActive ? '✅ Faol' : '❌ Nofaol'}</div>
                        <div class="agent-card-stats">
                            <div class="agent-stat">
                                <div class="agent-stat-value" style="color: #10b981;">${salesFormatted}</div>
                                <div class="agent-stat-label">Sotuvlar</div>
                            </div>
                            <div class="agent-stat">
                                <div class="agent-stat-value">${clientCount}</div>
                                <div class="agent-stat-label">Mijozlar</div>
                            </div>
                            <div class="agent-stat">
                                <div class="agent-stat-value" style="color: ${stats.debt > 0 ? '#ef4444' : '#6b7280'};">${debtK}</div>
                                <div class="agent-stat-label">Qarzdorlik</div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('Agentlar yuklash xatosi:', error);
            grid.innerHTML = '<div style="text-align: center; padding: 40px; grid-column: 1/-1; color: #ff3b30;">Xatolik yuz berdi</div>';
        }
    }

    // Load Low Stock Section - Prixod bo'lgan lekin 0 qolgan mahsulotlar
    async loadLowstockSection() {
        const tbody = document.getElementById('lowstockTableBody');
        const searchInput = document.getElementById('lowstockSearch');
        const countSpan = document.getElementById('lowstockCount');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 40px;">Yuklanmoqda...</td></tr>';

        try {
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const CACHE_BASE_URL = isLocal
                ? 'http://localhost:3000'
                : 'https://sd-analitika-production.up.railway.app';

            // Barchasini parallel yuklash
            const [purchasesRes, stockRes, productsRes] = await Promise.all([
                this.fetchWithTimeout(`${CACHE_BASE_URL}/api/cache/purchases`, 5000),
                this.fetchWithTimeout(`${CACHE_BASE_URL}/api/cache/stock`, 5000),
                this.fetchWithTimeout(`${CACHE_BASE_URL}/api/cache/products`, 5000)
            ]);

            const purchasesData = await purchasesRes.json();
            const stockData = await stockRes.json();
            const productsData = await productsRes.json();

            // 1. Prixod bo'lgan mahsulotlar
            const purchases = (purchasesData.status && purchasesData.result?.warehouse) ? purchasesData.result.warehouse : [];
            let purchasedProductIds = new Set();
            let purchasedProductNames = {};

            purchases.forEach(p => {
                (p.detail || []).forEach(item => {
                    if (item.SD_id) {
                        purchasedProductIds.add(item.SD_id);
                        if (item.name) {
                            purchasedProductNames[item.SD_id] = item.name;
                        }
                    }
                });
            });
            console.log('📥 Prixod bo\'lgan mahsulotlar (cache):', purchasedProductIds.size);

            // 2. Stock mapping
            const warehouses = (stockData.status && stockData.result?.warehouse) ? stockData.result.warehouse : [];
            const stockMap = {};
            warehouses.forEach(warehouse => {
                (warehouse.products || []).forEach(item => {
                    const productId = item.SD_id;
                    const quantity = parseFloat(item.quantity) || 0;
                    stockMap[productId] = (stockMap[productId] || 0) + quantity;
                });
            });

            // 3. Mahsulot nomlari
            const products = (productsData.status && productsData.result?.product) ? productsData.result.product : [];
            products.forEach(p => {
                if (p.SD_id && p.name) {
                    purchasedProductNames[p.SD_id] = p.name;
                }
            });

            // 4. Prixod bo'lgan, 100 donadan KAM qolgan mahsulotlarni filterlash
            const outOfStockProducts = Array.from(purchasedProductIds)
                .map(id => ({
                    id: id,
                    name: purchasedProductNames[id] || `Mahsulot #${id}`,
                    stock: stockMap[id] || 0
                }))
                .filter(p => p.stock < 100)
                .sort((a, b) => a.stock - b.stock);

            console.log('⚠️ Prixod bo\'lgan, 100 dan kam qolgan (cache):', outOfStockProducts.length);

            // Cache qilish
            this.cachedOutOfStock = outOfStockProducts;

            // Qidiruvni sozlash
            if (searchInput) {
                searchInput.oninput = () => this.filterLowstock(searchInput.value);
            }

            // Count ko'rsatish
            if (countSpan) {
                countSpan.textContent = `Prixod bo'lgan, ${outOfStockProducts.length} qolgan`;
            }

            this.renderLowstockTable(outOfStockProducts);

        } catch (error) {
            console.error('Low stock yuklash xatosi:', error);
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 40px; color: #ff3b30;">Xatolik yuz berdi</td></tr>';
        }
    }

    // Lowstock qidirish
    filterLowstock(query) {
        clearTimeout(this.lowstockFilterTimeout);
        this.lowstockFilterTimeout = setTimeout(() => {
            const products = this.cachedOutOfStock || [];
            const q = query.toLowerCase().trim();

            console.log(`🔍 Lowstock qidiruv: "${q}"`);

            if (!q) {
                this.renderLowstockTable(products);
                return;
            }

            const filtered = products.filter(p =>
                p.name.toLowerCase().includes(q)
            );

            console.log(`✅ Topildi: ${filtered.length} ta mahsulot`);
            this.renderLowstockTable(filtered);
        }, 300);
    }

    // Lowstock jadvalini render qilish
    renderLowstockTable(products) {
        const tbody = document.getElementById('lowstockTableBody');
        const countSpan = document.getElementById('lowstockCount');
        if (!tbody) return;

        if (countSpan) {
            countSpan.textContent = `${products.length} ta mahsulot`;
        }

        if (products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 40px; color: #10b981;">✅ Barcha mahsulotlar yetarli (100+)</td></tr>';
            return;
        }

        tbody.innerHTML = products.map((product, index) => {
            // Status va rang aniqlash
            let statusText, stockColor;
            if (product.stock === 0) {
                statusText = '🔴 Tugagan';
                stockColor = '#ef4444';
            } else if (product.stock < 20) {
                statusText = '🟠 Juda kam';
                stockColor = '#f97316';
            } else if (product.stock < 50) {
                statusText = '🟡 Kam';
                stockColor = '#eab308';
            } else {
                statusText = '🟢 Yetarli emas';
                stockColor = '#10b981';
            }

            return `
                <tr>
                    <td>${index + 1}</td>
                    <td><strong>${product.name}</strong></td>
                    <td style="color: ${stockColor}; font-weight: bold;">${product.stock} dona</td>
                    <td>${statusText}</td>
                </tr>
            `;
        }).join('');
    }

    // ============================================
    // DETAIL MODAL SYSTEM
    // ============================================

    setupStatCardClicks() {
        const cards = document.querySelectorAll('.stat-card');
        cards.forEach((card, index) => {
            // Skip cards that already have onclick handlers
            if (card.hasAttribute('onclick')) return;

            card.classList.add('clickable');
            card.addEventListener('click', () => {
                const label = card.querySelector('.stat-label')?.textContent || '';
                this.openDetailModal(label, index);
            });
        });
    }

    openDetailModal(label, index) {
        const modal = document.getElementById('detailModal');
        const title = document.getElementById('modalTitle');
        const body = document.getElementById('modalBody');

        if (!modal || !title || !body) return;

        // Map label to content generator
        let content = '';
        if (label.includes('Jami Sotuvlar') || label.includes('Sotuvlar')) {
            title.textContent = 'Sotuvlar bo\'yicha batafsil';
            content = this.renderSalesDetail();
        } else if (label.includes('Buyurtmalar')) {
            title.textContent = 'Buyurtmalar ro\'yxati';
            content = this.renderOrdersDetail();
        } else if (label.includes('Mijozlar')) {
            title.textContent = 'Mijozlar ro\'yxati';
            content = this.renderClientsDetail();
        } else if (label.includes('Mahsulotlar')) {
            title.textContent = 'Mahsulotlar ro\'yxati';
            content = this.renderProductsDetail();
        } else if (label.includes('Iroda')) {
            title.textContent = 'Iroda agentlari savdosi';
            content = this.renderIrodaAgentsDetail();
        } else {
            title.textContent = label;
            content = '<p>Ma\'lumot mavjud emas</p>';
        }

        body.innerHTML = content;
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    // ============ MAHSULOTLAR MODALI ============
    // Buyurtma dollar yoki so'mda ekanligini aniqlash
    isUsdOrder(order) {
        const paymentTypeId = order.paymentType?.SD_id;
        const priceTypeId = order.priceType?.SD_id;
        const dollarPriceTypes = new Set(['d0_4', 'd0_7', 'd0_8', 'd0_11', 'd0_9', 'd0_6']);
        // Agar paymentType dollar bo'lsa YOKI priceType dollar bo'lsa
        if (dollarPriceTypes.has(paymentTypeId) || dollarPriceTypes.has(priceTypeId)) return true;
        // Yoki totalSumma < 10000 bo'lsa (kichik raqam = dollar)
        const totalSumma = parseFloat(order.totalSumma) || 0;
        if (totalSumma > 0 && totalSumma < 10000) return true;
        return false;
    }

    async openProductsModal() {
        const modal = document.getElementById('detailModal');
        const title = document.getElementById('modalTitle');
        const body = document.getElementById('modalBody');
        if (!modal || !title || !body) return;

        const periodNames = { today: 'Bugun', yesterday: 'Kecha', week: 'Hafta', month: 'Oy', year: 'Yil', custom: 'Tanlangan' };
        title.textContent = `Barcha Mahsulotlar (${periodNames[this.currentPeriod] || 'Bugun'})`;
        body.innerHTML = '<p>Yuklanmoqda...</p>';
        modal.classList.add('active');

        try {
            // Server cache dan period bo'yicha buyurtmalarni olish
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const CACHE_BASE_URL = isLocal
                ? 'http://localhost:3000'
                : 'https://sd-analitika-production.up.railway.app';

            const ordersRes = await this.fetchWithTimeout(`${CACHE_BASE_URL}/api/cache/orders/${this.currentPeriod}`, 5000);
            const ordersData = await ordersRes.json();

            const orders = (ordersData.status && ordersData.result?.order) ? ordersData.result.order : (this.cachedOrders || []);
            const costPrices = await this.fetchCostPrices();
            const USD_RATE = this.getUsdRate();
            const productStats = {};

            orders.forEach(order => {
                // Qaytarishlarni o'tkazib yuborish
                if (order.status === 4 || order.status === 5) return;
                const returnsSumma = parseFloat(order.totalReturnsSumma) || 0;
                const totalSumma = parseFloat(order.totalSumma) || 0;
                if (returnsSumma > 0 && returnsSumma === totalSumma) return;

                const isDollar = this.isUsdOrder(order);
                const items = order.orderProducts || [];

                items.forEach(item => {
                    const productId = item.product?.SD_id || item.product?.name || 'unknown';
                    const productName = item.product?.name || 'Noma\'lum';
                    const quantity = parseFloat(item.quantity) || 0;
                    const rawSumma = parseFloat(item.summa) || 0;

                    // Dollar buyurtma bo'lsa, summa ni so'mga aylantirish
                    const summaUZS = isDollar ? rawSumma * USD_RATE : rawSumma;

                    // Foyda hisoblash - so'mdagi summa bilan
                    const costData = costPrices[productId];
                    const costPriceUZS = costData?.costPriceUZS || 0;
                    let profit = 0;
                    if (costPriceUZS > 0) {
                        profit = summaUZS - (costPriceUZS * quantity);
                        if (profit < 0) profit = 0;
                        if (profit > summaUZS * 0.50) profit = summaUZS * 0.15;
                    } else {
                        profit = summaUZS * 0.15; // Tan narx yo'q - 15% taxminiy
                    }

                    if (!productStats[productId]) {
                        productStats[productId] = { name: productName, sold: 0, revenue: 0, profit: 0 };
                    }
                    productStats[productId].sold += quantity;
                    productStats[productId].revenue += summaUZS;
                    productStats[productId].profit += profit;
                });
            });

            const allProducts = Object.values(productStats)
                .sort((a, b) => b.sold - a.sold);

            // Jami summa va foyda
            const totalRevenue = allProducts.reduce((s, p) => s + p.revenue, 0);
            const totalProfit = allProducts.reduce((s, p) => s + p.profit, 0);

            const html = `
            <div style="display: flex; gap: 16px; margin-bottom: 16px;">
                <div style="flex: 1; background: rgba(16,185,129,0.1); border-radius: 12px; padding: 12px; text-align: center;">
                    <div style="color: var(--text-secondary); font-size: 12px;">Jami summa</div>
                    <div style="font-size: 20px; font-weight: bold; color: #10b981;">${this.formatCurrency(totalRevenue)}</div>
                </div>
                <div style="flex: 1; background: rgba(139,92,246,0.1); border-radius: 12px; padding: 12px; text-align: center;">
                    <div style="color: var(--text-secondary); font-size: 12px;">Jami foyda</div>
                    <div style="font-size: 20px; font-weight: bold; color: #8b5cf6;">${this.formatCurrency(totalProfit)}</div>
                </div>
                <div style="flex: 1; background: rgba(59,130,246,0.1); border-radius: 12px; padding: 12px; text-align: center;">
                    <div style="color: var(--text-secondary); font-size: 12px;">Jami mahsulotlar</div>
                    <div style="font-size: 20px; font-weight: bold; color: #3b82f6;">${allProducts.length}</div>
                </div>
            </div>
            <div class="modal-table-wrapper">
                <table class="modal-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Mahsulot</th>
                            <th>Soni</th>
                            <th>Summa</th>
                            <th>Foyda</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${allProducts.map((p, i) => `
                            <tr>
                                <td>${i + 1}</td>
                                <td>${p.name}</td>
                                <td>${this.formatNumber(p.sold)}</td>
                                <td>${this.formatCurrency(p.revenue)}</td>
                                <td class="profit">${this.formatCurrency(p.profit)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

            body.innerHTML = html;
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        } catch (error) {
            console.error('Mahsulotlar modal xatosi:', error);
            body.innerHTML = '<p style="color: #ef4444;">Ma\'lumotlarni yuklashda xato yuz berdi</p>';
        }
    }

    async openProductsDetailModal() {
        const modal = document.getElementById('detailModal');
        const title = document.getElementById('modalTitle');
        const body = document.getElementById('modalBody');
        if (!modal || !title || !body) return;

        title.textContent = 'Mahsulotlar - Tan narx va Ostatka';
        body.innerHTML = '<p>Yuklanmoqda...</p>';
        modal.classList.add('active');

        try {
            // Server cache dan ma'lumot olish
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const CACHE_BASE_URL = isLocal
                ? 'http://localhost:3000'
                : 'https://sd-analitika-production.up.railway.app';

            // Cache holati va statistika olish
            const statusRes = await fetch(`${CACHE_BASE_URL}/api/cache/status`);
            const statusData = await statusRes.json();

            if (!statusData.hasData) {
                body.innerHTML = '<p style="color: #f59e0b;">Server cache hali tayyor emas. Biroz kuting...</p>';
                return;
            }

            // Tayyor statistika - cache dan
            const productsCount = statusData.counts.products || 0;

            // Stock, Products va Purchases dan statistika hisoblash uchun cache dan olamiz
            const [productsRes, purchasesRes, stockRes] = await Promise.all([
                fetch(`${CACHE_BASE_URL}/api/cache/products`),
                fetch(`${CACHE_BASE_URL}/api/cache/purchases`),
                fetch(`${CACHE_BASE_URL}/api/cache/stock`)
            ]);

            const productsData = await productsRes.json();
            const purchasesData = await purchasesRes.json();
            const stockData = await stockRes.json();

            const products = productsData.result?.product || [];
            const purchases = purchasesData.result?.warehouse || [];
            const warehouses = stockData.result?.warehouse || [];

            // Stock map yaratish (sklad bo'yicha)
            const stockMap = {};
            warehouses.forEach(warehouse => {
                (warehouse.products || []).forEach(item => {
                    const productId = item.SD_id;
                    const quantity = parseFloat(item.quantity) || 0;
                    stockMap[productId] = (stockMap[productId] || 0) + quantity;
                });
            });

            // Tan narxlarni map qilish
            const usdRate = this.getUsdRate();
            const priceMap = {};
            purchases.forEach(p => {
                (p.detail || []).forEach(item => {
                    const productId = item.SD_id;
                    const price = parseFloat(item.price) || 0;
                    if (price > 0) {
                        priceMap[productId] = price;
                    }
                });
            });

            // Statistikani hisoblash
            let totalOstatka = 0;
            let totalStockValueUSD = 0;
            let productsWithStock = 0;

            products.forEach(product => {
                const productId = product.SD_id;
                // stockMap dan ostatka olish (getStock dan to'g'ri ma'lumot)
                const ostatka = stockMap[productId] || 0;
                const rawPrice = priceMap[productId] || 0;

                let costPriceUSD = 0;
                if (rawPrice > 0) {
                    costPriceUSD = rawPrice < 100 ? rawPrice : rawPrice / usdRate;
                }

                const stockValueUSD = costPriceUSD * ostatka;

                if (ostatka > 0) {
                    productsWithStock++;
                    totalOstatka += ostatka;
                    totalStockValueUSD += stockValueUSD;
                }
            });

            // Faqat YIGINDI ko'rsatish (ro'yxatsiz - tez!)
            const html = `
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px;">
                    <div style="background:linear-gradient(135deg,rgba(99,102,241,0.15),rgba(99,102,241,0.05));border:1px solid rgba(99,102,241,0.25);border-radius:10px;padding:10px;text-align:center;">
                        <div style="color:#a5b4fc;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">📦 Mahsulotlar</div>
                        <div style="color:#818cf8;font-size:16px;font-weight:800;">${productsWithStock.toLocaleString()}</div>
                        <div style="color:#6b7280;font-size:10px;margin-top:2px;">ta aktiv</div>
                    </div>
                    <div style="background:linear-gradient(135deg,rgba(16,185,129,0.15),rgba(16,185,129,0.05));border:1px solid rgba(16,185,129,0.25);border-radius:10px;padding:10px;text-align:center;">
                        <div style="color:#6ee7b7;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">📊 Jami Ostatka</div>
                        <div style="color:#10b981;font-size:16px;font-weight:800;">${totalOstatka.toLocaleString()}</div>
                        <div style="color:#6b7280;font-size:10px;margin-top:2px;">dona</div>
                    </div>
                    <div style="background:linear-gradient(135deg,rgba(245,158,11,0.15),rgba(245,158,11,0.05));border:1px solid rgba(245,158,11,0.25);border-radius:10px;padding:10px;text-align:center;">
                        <div style="color:#fcd34d;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">💰 Ostatka Qiymati</div>
                        <div style="color:#f59e0b;font-size:16px;font-weight:800;">$${totalStockValueUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                        <div style="color:#6b7280;font-size:10px;margin-top:2px;">dollar</div>
                    </div>
                    <div style="background:linear-gradient(135deg,rgba(59,130,246,0.15),rgba(59,130,246,0.05));border:1px solid rgba(59,130,246,0.25);border-radius:10px;padding:10px;text-align:center;">
                        <div style="color:#93c5fd;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">📈 O'rtacha narx</div>
                        <div style="color:#60a5fa;font-size:16px;font-weight:800;">$${productsWithStock > 0 ? Math.round(totalStockValueUSD / productsWithStock).toLocaleString() : 0}</div>
                        <div style="color:#6b7280;font-size:10px;margin-top:2px;">har mahsulot</div>
                    </div>
                </div>
                <div style="text-align:center;padding:8px 0;color:#6b7280;font-size:11px;">
                    📅 Cache: ${new Date(statusData.lastUpdate).toLocaleString('uz-UZ')} &nbsp;|&nbsp; 💡 Batafsil: Sales Doctor paneli
                </div>
            `;

            body.innerHTML = html;
        } catch (error) {
            console.error('Products modal xatosi:', error);
            body.innerHTML = '<p style="color: #ef4444; text-align: center;">Xatolik yuz berdi</p>';
        }

        document.body.style.overflow = 'hidden';
    }

    // ============ MIJOZLAR MODALI ============
    async openClientsModal() {
        const modal = document.getElementById('detailModal');
        const title = document.getElementById('modalTitle');
        const body = document.getElementById('modalBody');
        if (!modal || !title || !body) return;

        // Tanlangan davr
        const { startDate, endDate } = this.getDateRange();
        const periodNames = { 'today': 'Bugun', 'week': 'Hafta', 'month': 'Oy', 'quarter': 'Kvartal', 'year': 'Yil' };

        title.textContent = `Barcha Mijozlar(${periodNames[this.currentPeriod] || 'Bugun'})`;
        body.innerHTML = '<p>Yuklanmoqda...</p>';
        modal.classList.add('active');

        // Tanlangan davr bo'yicha filtrlash
        const allOrders = this.cachedOrders || [];
        const orders = allOrders.filter(order => {
            const orderDate = (order.dateCreate || order.dateDocument || '').split('T')[0].split(' ')[0];
            return orderDate >= startDate && orderDate <= endDate;
        });

        const costPrices = await this.fetchCostPrices();

        // Mijozlar bo'yicha statistika
        const clientStats = {};
        orders.forEach(order => {
            const clientId = order.client?.SD_id || 'unknown';
            const clientName = order.client?.clientName || order.client?.name || 'Noma\'lum mijoz';
            const rawSumma = parseFloat(order.totalSumma) || 0;
            const summa = this.getSummaInUZS(rawSumma);

            // Har bir mahsulot uchun foydani hisoblash
            let orderProfit = 0;
            (order.orderProducts || []).forEach(item => {
                const productId = item.product?.SD_id;
                const quantity = parseFloat(item.quantity) || 0;
                const itemSumma = parseFloat(item.summa) || 0;
                const costData = costPrices[productId];
                orderProfit += this.calculateProfit(itemSumma, costData?.costPriceUZS || 0, quantity);
            });

            if (!clientStats[clientId]) {
                clientStats[clientId] = {
                    name: clientName,
                    orders: 0,
                    sales: 0,
                    profit: 0
                };
            }
            clientStats[clientId].orders += 1;
            clientStats[clientId].sales += summa;
            clientStats[clientId].profit += orderProfit;
        });

        const allClients = Object.entries(clientStats)
            .map(([id, data]) => ({ id, ...data }))
            .sort((a, b) => b.sales - a.sales);

        const totalSales = allClients.reduce((s, c) => s + c.sales, 0);
        const totalProfit = allClients.reduce((s, c) => s + c.profit, 0);
        const totalOrders = allClients.reduce((s, c) => s + c.orders, 0);

        const html = `
            <div class="modal-stats-summary" style="display: flex; gap: 20px; margin-bottom: 20px; flex-wrap: wrap;">
                <div class="stat-box" style="flex: 1; min-width: 150px; background: rgba(99,102,241,0.1); padding: 15px; border-radius: 10px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: var(--primary);">${allClients.length}</div>
                    <div style="color: var(--text-secondary); font-size: 12px;">Mijozlar</div>
                </div>
                <div class="stat-box" style="flex: 1; min-width: 150px; background: rgba(16,185,129,0.1); padding: 15px; border-radius: 10px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #10b981;">${totalOrders}</div>
                    <div style="color: var(--text-secondary); font-size: 12px;">Buyurtmalar</div>
                </div>
                <div class="stat-box" style="flex: 1; min-width: 150px; background: rgba(245,158,11,0.1); padding: 15px; border-radius: 10px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #f59e0b;">${this.formatCurrency(totalSales)}</div>
                    <div style="color: var(--text-secondary); font-size: 12px;">Jami sotuv</div>
                </div>
                <div class="stat-box" style="flex: 1; min-width: 150px; background: rgba(139,92,246,0.1); padding: 15px; border-radius: 10px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #8b5cf6;">${this.formatCurrency(totalProfit)}</div>
                    <div style="color: var(--text-secondary); font-size: 12px;">Jami foyda</div>
                </div>
            </div>
            <div class="modal-table-wrapper">
                <table class="modal-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Mijoz</th>
                            <th>Buyurtmalar</th>
                            <th>Sotuvlar</th>
                            <th>Foyda</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${allClients.slice(0, 100).map((c, i) => `
                            <tr>
                                <td>${i + 1}</td>
                                <td>${c.name}</td>
                                <td>${c.orders}</td>
                                <td>${this.formatCurrency(c.sales)}</td>
                                <td><span class="profit-badge">${this.formatCurrency(c.profit)}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ${allClients.length > 100 ? `<p style="text-align: center; color: var(--text-secondary); margin-top: 10px;">... va yana ${allClients.length - 100} ta mijoz</p>` : ''}
        `;

        body.innerHTML = html;
        document.body.style.overflow = 'hidden';
    }

    // ============ BUYURTMALAR MODALI ============
    async openOrdersModal() {
        const modal = document.getElementById('detailModal');
        const title = document.getElementById('modalTitle');
        const body = document.getElementById('modalBody');
        if (!modal || !title || !body) return;

        const { startDate, endDate } = this.getDateRange();
        const periodNames = { 'today': 'Bugun', 'week': 'Hafta', 'month': 'Oy', 'quarter': 'Kvartal', 'year': 'Yil' };

        title.textContent = `Buyurtmalar (${periodNames[this.currentPeriod] || 'Bugun'})`;
        body.innerHTML = '<p style="text-align: center; padding: 40px;">Yuklanmoqda...</p>';
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Faqat filtrlangan buyurtmalarni olish
        const allOrders = this.cachedOrders || [];
        const orders = allOrders.filter(order => {
            const orderDate = (order.dateCreate || order.dateDocument || '').split('T')[0].split(' ')[0];
            return orderDate >= startDate && orderDate <= endDate;
        }).filter(order => {
            // Qaytarishlarni o'tkazib yuborish
            if (order.status === 4 || order.status === 5) return false;
            const returnsSumma = parseFloat(order.totalReturnsSumma) || 0;
            const totalSumma = parseFloat(order.totalSumma) || 0;
            if (returnsSumma > 0 && returnsSumma === totalSumma) return false;
            return true;
        });

        // Buyurtmalarni summa bo'yicha tartiblash
        const sortedOrders = orders.sort((a, b) => {
            const sumA = parseFloat(a.totalSumma) || 0;
            const sumB = parseFloat(b.totalSumma) || 0;
            return sumB - sumA;
        });

        const totalSales = sortedOrders.reduce((s, o) => s + (parseFloat(o.totalSumma) || 0), 0);
        const uniqueClients = new Set(sortedOrders.map(o => o.client?.SD_id)).size;

        const avgOrder = sortedOrders.length > 0 ? Math.round(totalSales / sortedOrders.length) : 0;

        const html = `
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px;">
                <div style="background:linear-gradient(135deg,rgba(59,130,246,0.15),rgba(59,130,246,0.05));border:1px solid rgba(59,130,246,0.25);border-radius:10px;padding:10px;text-align:center;">
                    <div style="color:#93c5fd;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">📦 Buyurtmalar</div>
                    <div style="color:#60a5fa;font-size:16px;font-weight:800;">${sortedOrders.length}</div>
                    <div style="color:#6b7280;font-size:10px;margin-top:2px;">ta buyurtma</div>
                </div>
                <div style="background:linear-gradient(135deg,rgba(16,185,129,0.15),rgba(16,185,129,0.05));border:1px solid rgba(16,185,129,0.25);border-radius:10px;padding:10px;text-align:center;">
                    <div style="color:#6ee7b7;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">👥 Mijozlar</div>
                    <div style="color:#10b981;font-size:16px;font-weight:800;">${uniqueClients}</div>
                    <div style="color:#6b7280;font-size:10px;margin-top:2px;">ta xaridor</div>
                </div>
                <div style="background:linear-gradient(135deg,rgba(52,199,89,0.15),rgba(52,199,89,0.05));border:1px solid rgba(52,199,89,0.25);border-radius:10px;padding:10px;text-align:center;">
                    <div style="color:#6ee7b7;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">💰 Jami sotuv</div>
                    <div style="color:#34c759;font-size:16px;font-weight:800;">${this.formatCurrency(totalSales)}</div>
                    <div style="color:#6b7280;font-size:10px;margin-top:2px;">so'm</div>
                </div>
                <div style="background:linear-gradient(135deg,rgba(245,158,11,0.15),rgba(245,158,11,0.05));border:1px solid rgba(245,158,11,0.25);border-radius:10px;padding:10px;text-align:center;">
                    <div style="color:#fcd34d;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">📊 O'rtacha</div>
                    <div style="color:#f59e0b;font-size:16px;font-weight:800;">${this.formatCurrency(avgOrder)}</div>
                    <div style="color:#6b7280;font-size:10px;margin-top:2px;">har buyurtma</div>
                </div>
            </div>
            <div class="data-table-wrapper" style="max-height: 55vh; overflow-y: auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Sana</th>
                            <th>Mijoz</th>
                            <th>Agent</th>
                            <th>Summa</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sortedOrders.slice(0, 200).map((o, i) => {
            const date = (o.dateCreate || o.dateDocument || '').split('T')[0].split(' ')[0];
            const clientName = o.client?.clientName || o.client?.name || 'Noma\'lum';
            const agentName = o.agent?.name || 'Noma\'lum';
            const summa = parseFloat(o.totalSumma) || 0;
            return `
                            <tr>
                                <td>${i + 1}</td>
                                <td style="color:#93c5fd;font-size:13px;">${date}</td>
                                <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${clientName}</td>
                                <td style="color:#d8b4fe;">${agentName}</td>
                                <td style="font-weight:600;color:#10b981;">${this.formatCurrency(summa)}</td>
                            </tr>
                        `;
        }).join('')}
                    </tbody>
                </table>
            </div>
            ${sortedOrders.length > 200 ? `<p style="text-align:center;color:var(--text-secondary);margin-top:8px;font-size:12px;">... va yana ${sortedOrders.length - 200} ta buyurtma</p>` : ''}
        `;

        body.innerHTML = html;
    }

    // ============ AKTIV MIJOZLAR MODALI (AKB) - TEZROQ ============
    async openActiveClientsModal() {
        const modal = document.getElementById('detailModal');
        const title = document.getElementById('modalTitle');
        const body = document.getElementById('modalBody');
        if (!modal || !title || !body) return;

        const { startDate, endDate } = this.getDateRange();
        const periodNames = { 'today': 'Bugun', 'week': 'Hafta', 'month': 'Oy', 'quarter': 'Kvartal', 'year': 'Yil' };

        title.textContent = `Aktiv Mijozlar - AKB (${periodNames[this.currentPeriod] || 'Bugun'})`;
        body.innerHTML = '<p style="text-align: center; padding: 40px;">Yuklanmoqda...</p>';
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Faqat filtrlangan buyurtmalardan aktiv mijozlarni olish
        const allOrders = this.cachedOrders || [];
        const orders = allOrders.filter(order => {
            const orderDate = (order.dateCreate || order.dateDocument || '').split('T')[0].split(' ')[0];
            return orderDate >= startDate && orderDate <= endDate;
        });

        // Mijozlar statistikasi - TEZROQ (foydasiz)
        const clientStats = {};
        orders.forEach(order => {
            const clientId = order.client?.SD_id || 'unknown';
            const clientName = order.client?.clientName || order.client?.name || 'Noma\'lum mijoz';
            const summa = parseFloat(order.totalSumma) || 0;

            if (!clientStats[clientId]) {
                clientStats[clientId] = { name: clientName, orders: 0, sales: 0 };
            }
            clientStats[clientId].orders++;
            clientStats[clientId].sales += summa;
        });

        const akbClients = Object.entries(clientStats)
            .map(([id, data]) => ({ id, ...data }))
            .sort((a, b) => b.sales - a.sales);

        const totalSales = akbClients.reduce((s, c) => s + c.sales, 0);
        const totalOrders = akbClients.reduce((s, c) => s + c.orders, 0);

        const avgSales = akbClients.length > 0 ? Math.round(totalSales / akbClients.length) : 0;

        const html = `
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px;">
                <div style="background:linear-gradient(135deg,rgba(16,185,129,0.15),rgba(16,185,129,0.05));border:1px solid rgba(16,185,129,0.25);border-radius:10px;padding:10px;text-align:center;">
                    <div style="color:#6ee7b7;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">👥 Aktiv Mijozlar</div>
                    <div style="color:#10b981;font-size:16px;font-weight:800;">${akbClients.length}</div>
                    <div style="color:#6b7280;font-size:10px;margin-top:2px;">ta xaridor</div>
                </div>
                <div style="background:linear-gradient(135deg,rgba(52,199,89,0.15),rgba(52,199,89,0.05));border:1px solid rgba(52,199,89,0.25);border-radius:10px;padding:10px;text-align:center;">
                    <div style="color:#6ee7b7;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">💰 Jami sotuv</div>
                    <div style="color:#34c759;font-size:16px;font-weight:800;">${this.formatCurrency(totalSales)}</div>
                    <div style="color:#6b7280;font-size:10px;margin-top:2px;">so'm</div>
                </div>
                <div style="background:linear-gradient(135deg,rgba(168,85,247,0.15),rgba(168,85,247,0.05));border:1px solid rgba(168,85,247,0.25);border-radius:10px;padding:10px;text-align:center;">
                    <div style="color:#d8b4fe;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">📦 Buyurtmalar</div>
                    <div style="color:#a855f7;font-size:16px;font-weight:800;">${totalOrders}</div>
                    <div style="color:#6b7280;font-size:10px;margin-top:2px;">ta buyurtma</div>
                </div>
                <div style="background:linear-gradient(135deg,rgba(245,158,11,0.15),rgba(245,158,11,0.05));border:1px solid rgba(245,158,11,0.25);border-radius:10px;padding:10px;text-align:center;">
                    <div style="color:#fcd34d;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">📊 O'rtacha</div>
                    <div style="color:#f59e0b;font-size:16px;font-weight:800;">${this.formatCurrency(avgSales)}</div>
                    <div style="color:#6b7280;font-size:10px;margin-top:2px;">har mijoz</div>
                </div>
            </div>
            <div class="data-table-wrapper" style="max-height: 55vh; overflow-y: auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Mijoz</th>
                            <th>Buyurtmalar</th>
                            <th>Sotuvlar</th>
                            <th style="width:100px;">Ulush</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${akbClients.slice(0, 200).map((c, i) => {
            const percent = totalSales > 0 ? Math.round((c.sales / totalSales) * 100) : 0;
            return `
                            <tr>
                                <td>${i + 1}</td>
                                <td><strong>${c.name}</strong></td>
                                <td style="color:#d8b4fe;">${c.orders} ta</td>
                                <td style="color:#34c759;font-weight:600;">${this.formatCurrency(c.sales)}</td>
                                <td>
                                    <div style="display:flex;align-items:center;gap:4px;">
                                        <div style="flex:1;height:4px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;">
                                            <div style="height:100%;width:${percent}%;background:linear-gradient(90deg,#10b981,#34c759);border-radius:2px;"></div>
                                        </div>
                                        <span style="font-size:10px;color:#6b7280;min-width:24px;text-align:right;">${percent}%</span>
                                    </div>
                                </td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>
            </div>
            ${akbClients.length > 200 ? `<p style="text-align:center;color:var(--text-secondary);margin-top:8px;font-size:12px;">... va yana ${akbClients.length - 200} ta mijoz</p>` : ''}
        `;

        body.innerHTML = html;
    }

    // ============ AGENTLAR MODALI ============
    async openAgentsModal() {
        const modal = document.getElementById('detailModal');
        const title = document.getElementById('modalTitle');
        const body = document.getElementById('modalBody');
        if (!modal || !title || !body) return;

        const periodNames = { 'today': 'Bugun', 'yesterday': 'Kecha', 'week': 'Hafta', 'month': 'Oy', 'quarter': 'Kvartal', 'year': 'Yil' };

        title.textContent = `Barcha Agentlar (${periodNames[this.currentPeriod] || 'Bugun'})`;
        body.innerHTML = '<p>Yuklanmoqda...</p>';
        modal.classList.add('active');

        try {
            // Server cache dan period bo'yicha buyurtmalarni olish
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const CACHE_BASE_URL = isLocal
                ? 'http://localhost:3000'
                : 'https://sd-analitika-production.up.railway.app';

            const ordersRes = await this.fetchWithTimeout(`${CACHE_BASE_URL}/api/cache/orders/${this.currentPeriod}`, 5000);
            const ordersData = await ordersRes.json();
            const orders = (ordersData.status && ordersData.result?.order) ? ordersData.result.order : (this.cachedOrders || []);

            // Agent nomlarni cache dan olish
            let agentNameMap = {};
            try {
                const agentsRes = await this.fetchWithTimeout(`${CACHE_BASE_URL}/api/cache/agents`, 3000);
                const agentsData = await agentsRes.json();
                if (agentsData.status && agentsData.result?.agent) {
                    agentsData.result.agent.forEach(a => {
                        agentNameMap[a.SD_id] = a.name;
                    });
                }
            } catch (e) { console.log('Agent nomlar yuklanmadi'); }

            const costPrices = await this.fetchCostPrices();
            const USD_RATE = this.getUsdRate();

            const agentStats = {};
            orders.forEach(order => {
                // Qaytarishlarni o'tkazib yuborish
                if (order.status === 4 || order.status === 5) return;
                const returnsSumma = parseFloat(order.totalReturnsSumma) || 0;
                const totalSumma = parseFloat(order.totalSumma) || 0;
                if (returnsSumma > 0 && returnsSumma === totalSumma) return;

                const agentId = order.agent?.SD_id || 'unknown';
                const agentName = agentNameMap[agentId] || order.agent?.name || `Agent ${agentId}`;
                const clientId = order.client?.SD_id || 'unknown';
                const isDollar = this.isUsdOrder(order);
                const summaUZS = isDollar ? totalSumma * USD_RATE : totalSumma;

                // Foyda hisoblash
                let orderProfit = 0;
                (order.orderProducts || []).forEach(item => {
                    const productId = item.product?.SD_id;
                    const quantity = parseFloat(item.quantity) || 0;
                    const rawSumma = parseFloat(item.summa) || 0;
                    const itemSummaUZS = isDollar ? rawSumma * USD_RATE : rawSumma;
                    const costData = costPrices[productId];
                    const costPriceUZS = costData?.costPriceUZS || 0;
                    if (costPriceUZS > 0) {
                        let p = itemSummaUZS - (costPriceUZS * quantity);
                        if (p < 0) p = 0;
                        if (p > itemSummaUZS * 0.50) p = itemSummaUZS * 0.15;
                        orderProfit += p;
                    } else {
                        orderProfit += itemSummaUZS * 0.15;
                    }
                });

                if (agentId !== 'unknown') {
                    if (!agentStats[agentId]) {
                        agentStats[agentId] = { name: agentName, sales: 0, profit: 0, clients: new Set(), orders: 0 };
                    }
                    agentStats[agentId].sales += summaUZS;
                    agentStats[agentId].profit += orderProfit;
                    agentStats[agentId].clients.add(clientId);
                    agentStats[agentId].orders += 1;
                }
            });

            const allAgents = Object.entries(agentStats)
                .sort(([, a], [, b]) => b.sales - a.sales)
                .map(([id, a]) => ({ id, ...a, clients: a.clients.size }));

            // Jami ko'rsatkichlar
            const totalSales = allAgents.reduce((s, a) => s + a.sales, 0);
            const totalProfit = allAgents.reduce((s, a) => s + a.profit, 0);
            const totalOrders = allAgents.reduce((s, a) => s + a.orders, 0);

            const html = `
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px;">
                    <div style="background: linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.05)); border: 1px solid rgba(16,185,129,0.2); border-radius: 12px; padding: 14px; text-align: center;">
                        <div style="color: var(--text-secondary); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Jami sotuvlar</div>
                        <div style="font-size: 18px; font-weight: 700; color: #10b981; margin-top: 4px;">${this.formatCurrency(totalSales)}</div>
                    </div>
                    <div style="background: linear-gradient(135deg, rgba(139,92,246,0.15), rgba(139,92,246,0.05)); border: 1px solid rgba(139,92,246,0.2); border-radius: 12px; padding: 14px; text-align: center;">
                        <div style="color: var(--text-secondary); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Jami foyda</div>
                        <div style="font-size: 18px; font-weight: 700; color: #8b5cf6; margin-top: 4px;">${this.formatCurrency(totalProfit)}</div>
                    </div>
                    <div style="background: linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.05)); border: 1px solid rgba(59,130,246,0.2); border-radius: 12px; padding: 14px; text-align: center;">
                        <div style="color: var(--text-secondary); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Buyurtmalar</div>
                        <div style="font-size: 18px; font-weight: 700; color: #3b82f6; margin-top: 4px;">${totalOrders}</div>
                    </div>
                    <div style="background: linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05)); border: 1px solid rgba(245,158,11,0.2); border-radius: 12px; padding: 14px; text-align: center;">
                        <div style="color: var(--text-secondary); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Agentlar</div>
                        <div style="font-size: 18px; font-weight: 700; color: #f59e0b; margin-top: 4px;">${allAgents.length}</div>
                    </div>
                </div>
                <div class="modal-table-wrapper">
                    <table class="modal-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Agent</th>
                                <th>Sotuvlar</th>
                                <th>Foyda</th>
                                <th>Buyurtmalar</th>
                                <th>Mijozlar</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${allAgents.map((a, i) => `
                                <tr class="clickable-row" onclick="window.app.openAgentDetail('${a.id}', '${a.name.replace(/'/g, "\\'")}')" title="Mijozlarni ko'rish" style="cursor: pointer;">
                                    <td>${i + 1}</td>
                                    <td style="font-weight: 600;">${a.name}</td>
                                    <td style="color: #10b981; font-weight: 600;">${this.formatCurrency(a.sales)}</td>
                                    <td style="color: #8b5cf6; font-weight: 600;">${this.formatCurrency(a.profit)}</td>
                                    <td>${a.orders}</td>
                                    <td>${a.clients}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;

            body.innerHTML = html;
            document.body.style.overflow = 'hidden';
        } catch (error) {
            console.error('Agentlar modal xatosi:', error);
            body.innerHTML = '<p style="color: #ef4444;">Ma\'lumotlarni yuklashda xato yuz berdi</p>';
        }
    }

    // ============ FOYDA MODAL - AGENTLAR BO'YICHA ============
    async openProfitModal() {
        const modal = document.getElementById('detailModal');
        const title = document.getElementById('modalTitle');
        const body = document.getElementById('modalBody');
        if (!modal || !title || !body) return;

        const periodNames = { 'today': 'Bugun', 'yesterday': 'Kecha', 'week': 'Hafta', 'month': 'Oy', 'quarter': 'Kvartal', 'year': 'Yil' };
        title.textContent = `Agentlar bo'yicha Foyda (${periodNames[this.currentPeriod] || 'Bugun'})`;
        body.innerHTML = '<p style="text-align: center; padding: 40px;">Yuklanmoqda...</p>';
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        try {
            // Server cache dan period bo'yicha buyurtmalarni olish
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const CACHE_BASE_URL = isLocal
                ? 'http://localhost:3000'
                : 'https://sd-analitika-production.up.railway.app';

            const ordersRes = await this.fetchWithTimeout(`${CACHE_BASE_URL}/api/cache/orders/${this.currentPeriod}`, 5000);
            const ordersData = await ordersRes.json();
            const orders = (ordersData.status && ordersData.result?.order) ? ordersData.result.order : (this.cachedOrders || []);

            // Agent nomlarni cache dan olish
            let agentNameMap = {};
            try {
                const agentsRes = await this.fetchWithTimeout(`${CACHE_BASE_URL}/api/cache/agents`, 3000);
                const agentsData = await agentsRes.json();
                if (agentsData.status && agentsData.result?.agent) {
                    agentsData.result.agent.forEach(a => {
                        agentNameMap[a.SD_id] = a.name;
                    });
                }
            } catch (e) { console.log('Agent nomlar yuklanmadi'); }

            const costPrices = await this.fetchCostPrices();
            const USD_RATE = this.getUsdRate();

            const agentProfit = {};
            orders.forEach(order => {
                // Qaytarishlarni o'tkazib yuborish
                if (order.status === 4 || order.status === 5) return;
                const returnsSumma = parseFloat(order.totalReturnsSumma) || 0;
                const totalSumma = parseFloat(order.totalSumma) || 0;
                if (returnsSumma > 0 && returnsSumma === totalSumma) return;

                const agentId = order.agent?.SD_id;
                if (!agentId) return;
                const agentName = agentNameMap[agentId] || order.agent?.name || `Agent ${agentId}`;
                const isDollar = this.isUsdOrder(order);
                const summaUZS = isDollar ? totalSumma * USD_RATE : totalSumma;

                if (!agentProfit[agentId]) {
                    agentProfit[agentId] = { name: agentName, sales: 0, profit: 0, orders: 0, clients: new Set() };
                }

                agentProfit[agentId].sales += summaUZS;
                agentProfit[agentId].orders++;
                if (order.client?.SD_id) agentProfit[agentId].clients.add(order.client.SD_id);

                // Foyda hisoblash
                (order.orderProducts || []).forEach(item => {
                    const productId = item.product?.SD_id;
                    const quantity = parseFloat(item.quantity) || 0;
                    const rawSumma = parseFloat(item.summa) || 0;
                    const itemSummaUZS = isDollar ? rawSumma * USD_RATE : rawSumma;
                    const costData = costPrices[productId];
                    const costPriceUZS = costData?.costPriceUZS || 0;
                    if (costPriceUZS > 0) {
                        let p = itemSummaUZS - (costPriceUZS * quantity);
                        if (p < 0) p = 0;
                        if (p > itemSummaUZS * 0.50) p = itemSummaUZS * 0.15;
                        agentProfit[agentId].profit += p;
                    } else {
                        agentProfit[agentId].profit += itemSummaUZS * 0.15;
                    }
                });
            });

            // Jami hisoblash
            let totalProfit = 0;
            let totalSales = 0;
            Object.values(agentProfit).forEach(a => {
                totalProfit += a.profit;
                totalSales += a.sales;
            });

            const sortedAgents = Object.entries(agentProfit)
                .map(([id, data]) => ({
                    id,
                    name: data.name,
                    sales: data.sales,
                    profit: data.profit,
                    profitUSD: Math.round(data.profit / USD_RATE),
                    orders: data.orders,
                    clients: data.clients.size
                }))
                .sort((a, b) => b.profit - a.profit);

            const html = `
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px;">
                    <div style="background: linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.05)); border: 1px solid rgba(16,185,129,0.2); border-radius: 12px; padding: 14px; text-align: center;">
                        <div style="color: var(--text-secondary); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Jami Foyda</div>
                        <div style="font-size: 18px; font-weight: 700; color: #10b981; margin-top: 4px;">${this.formatCurrency(totalProfit)}</div>
                        <div style="font-size: 12px; color: #10b981; opacity: 0.7;">$${Math.round(totalProfit / USD_RATE).toLocaleString()}</div>
                    </div>
                    <div style="background: linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.05)); border: 1px solid rgba(59,130,246,0.2); border-radius: 12px; padding: 14px; text-align: center;">
                        <div style="color: var(--text-secondary); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Jami Sotuvlar</div>
                        <div style="font-size: 18px; font-weight: 700; color: #3b82f6; margin-top: 4px;">${this.formatCurrency(totalSales)}</div>
                    </div>
                    <div style="background: linear-gradient(135deg, rgba(139,92,246,0.15), rgba(139,92,246,0.05)); border: 1px solid rgba(139,92,246,0.2); border-radius: 12px; padding: 14px; text-align: center;">
                        <div style="color: var(--text-secondary); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Marja</div>
                        <div style="font-size: 18px; font-weight: 700; color: #8b5cf6; margin-top: 4px;">${totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(1) : 0}%</div>
                    </div>
                    <div style="background: linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05)); border: 1px solid rgba(245,158,11,0.2); border-radius: 12px; padding: 14px; text-align: center;">
                        <div style="color: var(--text-secondary); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Agentlar</div>
                        <div style="font-size: 18px; font-weight: 700; color: #f59e0b; margin-top: 4px;">${sortedAgents.length}</div>
                    </div>
                </div>
                <div class="modal-table-wrapper">
                    <table class="modal-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Agent</th>
                                <th>Foyda</th>
                                <th>$ Foyda</th>
                                <th>Sotuvlar</th>
                                <th>Marja</th>
                                <th>Buyurtmalar</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sortedAgents.map((a, i) => `
                                <tr class="clickable-row" onclick="window.app.openAgentDetail('${a.id}', '${a.name.replace(/'/g, "\\'")}')" title="Mijozlarni ko'rish" style="cursor: pointer;">
                                    <td>${i + 1}</td>
                                    <td style="font-weight: 600;">${a.name}</td>
                                    <td style="color: #10b981; font-weight: 700;">${this.formatCurrency(a.profit)}</td>
                                    <td style="color: #10b981;">$${a.profitUSD.toLocaleString()}</td>
                                    <td>${this.formatCurrency(a.sales)}</td>
                                    <td style="color: #8b5cf6;">${a.sales > 0 ? ((a.profit / a.sales) * 100).toFixed(1) : 0}%</td>
                                    <td>${a.orders}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;

            body.innerHTML = html;
        } catch (error) {
            console.error('Foyda modal xatosi:', error);
            body.innerHTML = `<p style="color: #ef4444; text-align: center; padding: 40px;">Xatolik: ${error.message}</p>`;
        }
    }

    // ============ AGENT DETAIL MODAL - MIJOZLAR BO'YICHA ============
    async openAgentDetail(agentId, agentName) {
        const modal = document.getElementById('detailModal');
        const title = document.getElementById('modalTitle');
        const body = document.getElementById('modalBody');
        if (!modal || !title || !body) return;

        title.textContent = `${agentName} - Mijozlar`;
        body.innerHTML = '<p style="text-align: center; padding: 40px;">Yuklanmoqda...</p>';
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        try {
            // Tanlangan davr bo'yicha filtrlash
            const { startDate, endDate } = this.getDateRange();
            const allOrders = this.cachedOrders || [];
            const orders = allOrders.filter(order => {
                const orderDate = (order.dateCreate || order.dateDocument || '').split('T')[0].split(' ')[0];
                const isInDateRange = orderDate >= startDate && orderDate <= endDate;
                const isThisAgent = order.agent?.SD_id === agentId;
                return isInDateRange && isThisAgent;
            });

            // === DEBUG START ===
            console.log(`🔍🔍🔍 openAgentDetail DEBUG: agentId=${agentId}, agentName=${agentName}`);
            console.log(`📊 Jami orders: ${allOrders.length}, Filtrlangan: ${orders.length}`);
            if (orders.length > 0) {
                const firstOrder = orders[0];
                console.log(`📦 Birinchi order: ${firstOrder.SD_id}, products: ${firstOrder.orderProducts?.length || 0}`);
                if (firstOrder.orderProducts?.length > 0) {
                    console.log(`   Birinchi product summa: ${firstOrder.orderProducts[0].summa}`);
                }
            }
            // === DEBUG END ===

            // Tan narxlarni olish
            const costPrices = await this.fetchCostPrices();

            // Mijozlar bo'yicha statistika
            const clientStats = {};
            orders.forEach(order => {
                const clientId = order.client?.SD_id || 'unknown';
                const clientName = order.client?.clientName || order.client?.name || 'Noma\'lum mijoz';
                const rawSumma = parseFloat(order.totalSumma) || 0;
                const summa = this.getSummaInUZS(rawSumma);

                // Har bir mahsulot uchun foydani hisoblash
                // Tan narx = 0 bo'lsa, butun summa = foyda
                let orderProfit = 0;
                const products = order.orderProducts || [];

                // DEBUG
                if (products.length > 0 && clientStats[clientId] === undefined) {
                    console.log(`🔍 DEBUG: ${clientName} - ${products.length} mahsulot, birinchi summa: ${products[0]?.summa}`);
                }

                // Foyda hisoblash - item.summa dollarda, tan narxlar ham dollarda
                const USD_RATE = this.getUsdRate(); // Dollar kursi

                if (products.length > 0) {
                    products.forEach(item => {
                        const productId = item.product?.SD_id;
                        const quantity = parseFloat(item.quantity) || 0;
                        const rawSumma = parseFloat(item.summa) || 0;
                        // Valyutani aniqlash: > 100 = UZS, <= 1000 = USD
                        const itemSummaUZS = rawSumma > 100 ? rawSumma : rawSumma * USD_RATE;

                        const costData = costPrices[productId];
                        // costPriceUZS allaqachon to'g'ri valyutada (fetchCostPrices da hisoblangan)
                        const costPriceUZS = costData?.costPriceUZS || 0;

                        if (costPriceUZS <= 0) {
                            // Tan narx yo'q (bonus) - butun summa foyda
                            orderProfit += itemSummaUZS;
                        } else {
                            // Foyda = Sotish narxi - Tan narx * soni
                            const totalCost = costPriceUZS * quantity;
                            const itemProfit = itemSummaUZS - totalCost;
                            // Manfiy bo'lsa 0 qo'shamiz
                            orderProfit += Math.max(0, itemProfit);
                        }
                    });
                } else {
                    // Mahsulotlar yo'q - buyurtma summasi foyda
                    orderProfit = summa;
                }

                // DEBUG
                if (orderProfit > 0 && !clientStats[clientId]) {
                    console.log(`✅ Foyda: ${clientName} = ${orderProfit.toLocaleString()} so'm`);
                }

                if (!clientStats[clientId]) {
                    clientStats[clientId] = {
                        name: clientName,
                        orders: 0,
                        sales: 0,
                        profit: 0
                    };
                }
                clientStats[clientId].orders += 1;
                clientStats[clientId].sales += summa;
                clientStats[clientId].profit += orderProfit;
            });

            const allClients = Object.entries(clientStats)
                .map(([id, data]) => ({ id, ...data }))
                .sort((a, b) => b.sales - a.sales);

            const html = `
            <div class="modal-stats-summary" style="display: flex; gap: 20px; margin-bottom: 20px; flex-wrap: wrap;">
                    <div class="stat-box" style="flex: 1; min-width: 150px; background: rgba(99,102,241,0.1); padding: 15px; border-radius: 10px; text-align: center;">
                        <div style="font-size: 24px; font-weight: bold; color: var(--primary);">${allClients.length}</div>
                        <div style="color: var(--text-secondary); font-size: 12px;">Mijozlar</div>
                    </div>
                    <div class="stat-box" style="flex: 1; min-width: 150px; background: rgba(16,185,129,0.1); padding: 15px; border-radius: 10px; text-align: center;">
                        <div style="font-size: 24px; font-weight: bold; color: #10b981;">${orders.length}</div>
                        <div style="color: var(--text-secondary); font-size: 12px;">Buyurtmalar</div>
                    </div>
                    <div class="stat-box" style="flex: 1; min-width: 150px; background: rgba(245,158,11,0.1); padding: 15px; border-radius: 10px; text-align: center;">
                        <div style="font-size: 24px; font-weight: bold; color: #f59e0b;">${this.formatCurrency(allClients.reduce((s, c) => s + c.sales, 0))}</div>
                        <div style="color: var(--text-secondary); font-size: 12px;">Jami sotuv</div>
                    </div>
                    <div class="stat-box" style="flex: 1; min-width: 150px; background: rgba(139,92,246,0.1); padding: 15px; border-radius: 10px; text-align: center;">
                        <div style="font-size: 24px; font-weight: bold; color: #8b5cf6;">${this.formatCurrency(allClients.reduce((s, c) => s + c.profit, 0))}</div>
                        <div style="color: var(--text-secondary); font-size: 12px;">Jami foyda</div>
                    </div>
                </div>
            <div class="modal-table-wrapper">
                <table class="modal-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Mijoz</th>
                            <th>Buyurtmalar</th>
                            <th>Sotuvlar</th>
                            <th>Foyda</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${allClients.map((c, i) => `
                                <tr>
                                    <td>${i + 1}</td>
                                    <td>${c.name}</td>
                                    <td>${c.orders}</td>
                                    <td>${this.formatCurrency(c.sales)}</td>
                                    <td><span class="profit-badge">${this.formatCurrency(c.profit)}</span></td>
                                </tr>
                            `).join('')}
                    </tbody>
                </table>
            </div>
        `;

            body.innerHTML = html;
        } catch (error) {
            console.error('Agent detail yuklash xatosi:', error);
            body.innerHTML = '<p style="color: #ef4444; text-align: center;">Xatolik yuz berdi</p>';
        }
    }

    // Qarzdorlik modali - agentlar bo'yicha
    async openDebtModal(currency = 'all') {
        const modal = document.getElementById('detailModal');
        const title = document.getElementById('modalTitle');
        const body = document.getElementById('modalBody');

        if (!modal || !title || !body) return;

        // Sarlavha
        const titles = {
            'all': 'Qarzdorlik - Umumiy',
            'som': 'Qarzdorlik - Faqat So\'m',
            'dollar': 'Qarzdorlik - Faqat Dollar'
        };
        title.textContent = titles[currency] || titles['all'];
        body.innerHTML = '<p style="text-align: center; padding: 40px;">Yuklanmoqda...</p>';
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Currency ni saqlash
        this.currentDebtCurrency = currency;

        try {
            // Cache serverdan tayyor agentDebts olish (barcha hisob server tomonida!)
            const baseUrl = this.getCacheBaseUrl();
            const debtRes = await fetch(`${baseUrl}/api/cache/agentDebts?currency=${currency}`);
            const debtData = await debtRes.json();

            if (!debtData.status || !debtData.result?.agents) {
                body.innerHTML = '<p style="text-align: center; padding: 40px;">Ma\'lumot topilmadi</p>';
                return;
            }

            const sortedAgents = debtData.result.agents;
            const totalSom = debtData.totalSom || 0;
            const totalDollar = debtData.totalDollar || 0;

            // Cache qilish
            this.cachedAgentDebts = sortedAgents;

            // Jadval ustunlarini currency ga qarab ko'rsatish
            let tableHeaders = '';
            let tableRows = '';

            if (currency === 'som') {
                tableHeaders = `
                    <th>#</th>
                    <th>Agent ismi</th>
                    <th>Mijozlar</th>
                    <th>So'm qarzi</th>
                `;
                tableRows = sortedAgents.map((a, i) => `
                    <tr style="cursor: pointer;" onclick="window.app?.showAgentClients('${a.id}')">
                        <td>${i + 1}</td>
                        <td>${a.name}</td>
                        <td>${a.clientCount} ta</td>
                        <td style="color: #ef4444;">${this.formatCurrency(a.totalSom)}</td>
                    </tr>
                `).join('');
            } else if (currency === 'dollar') {
                tableHeaders = `
                    <th>#</th>
                    <th>Agent ismi</th>
                    <th>Mijozlar</th>
                    <th>Dollar qarzi</th>
                `;
                tableRows = sortedAgents.map((a, i) => `
                    <tr style="cursor: pointer;" onclick="window.app?.showAgentClients('${a.id}')">
                        <td>${i + 1}</td>
                        <td>${a.name}</td>
                        <td>${a.clientCount} ta</td>
                        <td style="color: #ef4444;">$${Math.abs(a.totalDollar).toLocaleString()}</td>
                    </tr>
                `).join('');
            } else {
                tableHeaders = `
                    <th>#</th>
                    <th>Agent ismi</th>
                    <th>Mijozlar</th>
                    <th>So'm</th>
                    <th>Dollar</th>
                `;
                tableRows = sortedAgents.map((a, i) => `
                    <tr style="cursor: pointer;" onclick="window.app?.showAgentClients('${a.id}')">
                        <td>${i + 1}</td>
                        <td>${a.name}</td>
                        <td>${a.clientCount} ta</td>
                        <td style="color: #ef4444;">${this.formatCurrency(a.totalSom)}</td>
                        <td style="color: #ef4444;">$${Math.abs(a.totalDollar).toLocaleString()}</td>
                    </tr>
                `).join('');
            }

            // Barcha agentlardan umumiy srok statistikani hisoblash
            let allOverdueClients = 0;
            let allOverdueDollar = 0;
            let allOverdueSom = 0;
            let allTotalClients = 0;
            let maxOverdueDays = 0;
            sortedAgents.forEach(a => {
                (a.clients || []).forEach(c => {
                    allTotalClients++;
                    if (c.isOverdue) {
                        allOverdueClients++;
                        allOverdueDollar += Math.abs(c.dollarDebt || 0);
                        allOverdueSom += Math.abs(c.somDebt || 0);
                        if ((c.overdueDays || 0) > maxOverdueDays) maxOverdueDays = c.overdueDays;
                    }
                });
            });
            const totalDollarAbs = Math.abs(totalDollar);
            const overduePercent = totalDollarAbs > 0 ? Math.round((allOverdueDollar / totalDollarAbs) * 100) : 0;

            // Agent table ga srok ustun qo'shish
            if (currency === 'dollar') {
                tableHeaders = `
                    <th>#</th>
                    <th>Agent ismi</th>
                    <th>Mijozlar</th>
                    <th>Dollar</th>
                    <th>🔴 Srok o'tgan</th>
                `;
                tableRows = sortedAgents.map((a, i) => {
                    const agentOverdue = (a.clients || []).filter(c => c.isOverdue);
                    const agentOverdueDollar = agentOverdue.reduce((s, c) => s + Math.abs(c.dollarDebt || 0), 0);
                    const agentMaxDays = agentOverdue.length > 0 ? Math.max(...agentOverdue.map(c => c.overdueDays || 0)) : 0;
                    return `
                    <tr style="cursor: pointer;" onclick="window.app?.showAgentClients('${a.id}')">
                        <td>${i + 1}</td>
                        <td>${a.name}</td>
                        <td>${a.clientCount} ta</td>
                        <td style="color: #ef4444;">$${Math.abs(a.totalDollar).toLocaleString()}</td>
                        <td style="text-align:center;">${agentOverdue.length > 0
                            ? `<span style="color:#ef4444;font-weight:700;">$${agentOverdueDollar.toLocaleString()}</span> <span style="color:#fca5a5;font-size:11px;">(${agentOverdue.length})</span>`
                            : '<span style="color:#10b981;">✓</span>'
                        }</td>
                    </tr>
                `}).join('');
            } else {
                tableHeaders = `
                    <th>#</th>
                    <th>Agent ismi</th>
                    <th>Mijozlar</th>
                    <th>So'm</th>
                    <th>Dollar</th>
                    <th>🔴 Srok o'tgan</th>
                `;
                tableRows = sortedAgents.map((a, i) => {
                    const agentOverdue = (a.clients || []).filter(c => c.isOverdue);
                    const agentOverdueDollar = agentOverdue.reduce((s, c) => s + Math.abs(c.dollarDebt || 0), 0);
                    return `
                    <tr style="cursor: pointer;" onclick="window.app?.showAgentClients('${a.id}')">
                        <td>${i + 1}</td>
                        <td>${a.name}</td>
                        <td>${a.clientCount} ta</td>
                        <td style="color: #ef4444;">${this.formatCurrency(a.totalSom)}</td>
                        <td style="color: #ef4444;">$${Math.abs(a.totalDollar).toLocaleString()}</td>
                        <td style="text-align:center;">${agentOverdue.length > 0
                            ? `<span style="color:#ef4444;font-weight:700;">$${agentOverdueDollar.toLocaleString()}</span> <span style="color:#fca5a5;font-size:11px;">(${agentOverdue.length})</span>`
                            : '<span style="color:#10b981;">✓</span>'
                        }</td>
                    </tr>
                `}).join('');
            }

            body.innerHTML = `
                <div style="
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 8px;
                    margin-bottom: 10px;
                ">
                    <div style="background: linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.05)); border: 1px solid rgba(59,130,246,0.25); border-radius: 10px; padding: 10px; text-align: center;">
                        <div style="color: #93c5fd; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Jami qarz</div>
                        <div style="color: #60a5fa; font-size: 16px; font-weight: 800;">$${totalDollarAbs.toLocaleString()}</div>
                        <div style="color: #6b7280; font-size: 10px; margin-top: 2px;">${allTotalClients} ta mijoz</div>
                    </div>
                    <div style="background: linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.05)); border: 1px solid rgba(239,68,68,0.35); border-radius: 10px; padding: 10px; text-align: center;">
                        <div style="color: #fca5a5; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">🔴 Srok o'tgan</div>
                        <div style="color: #ef4444; font-size: 16px; font-weight: 800;">$${allOverdueDollar.toLocaleString()}</div>
                        <div style="color: #ef4444; font-size: 10px; margin-top: 2px; font-weight: 600;">${overduePercent}% — ${allOverdueClients} mijoz</div>
                    </div>
                    <div style="background: linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05)); border: 1px solid rgba(245,158,11,0.3); border-radius: 10px; padding: 10px; text-align: center;">
                        <div style="color: #fcd34d; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">⚠️ Max kechikish</div>
                        <div style="color: #f59e0b; font-size: 16px; font-weight: 800;">${maxOverdueDays} kun</div>
                        <div style="color: #6b7280; font-size: 10px; margin-top: 2px;">eng uzoq muddat</div>
                    </div>
                    <div style="background: linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.05)); border: 1px solid rgba(16,185,129,0.25); border-radius: 10px; padding: 10px; text-align: center;">
                        <div style="color: #6ee7b7; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">✅ Muddatida</div>
                        <div style="color: #10b981; font-size: 16px; font-weight: 800;">$${(totalDollarAbs - allOverdueDollar).toLocaleString()}</div>
                        <div style="color: #10b981; font-size: 10px; margin-top: 2px;">${100 - overduePercent}% — ${allTotalClients - allOverdueClients} mijoz</div>
                    </div>
                </div>
                <div style="height:4px;background:rgba(16,185,129,0.3);border-radius:2px;margin-bottom:10px;overflow:hidden;">
                    <div style="height:100%;width:${overduePercent}%;background:linear-gradient(90deg,#ef4444,#f97316);border-radius:2px;"></div>
                </div>
                <div class="data-table-wrapper" style="max-height: 50vh; overflow-y: auto;">
                    <table class="data-table">
                        <thead>
                            <tr>${tableHeaders}</tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
            `;
        } catch (error) {
            console.error('Qarzdorlik modali xatosi:', error);
            body.innerHTML = '<p style="text-align: center; color: #ff3b30; padding: 40px;">Ma\'lumot yuklashda xatolik</p>';
        }
    }

    // Agent mijozlarini ko'rsatish (срок bilan) - CACHE dan tayyor
    async showAgentClients(agentId) {
        const agent = this.cachedAgentDebts?.find(a => a.id === agentId);
        if (!agent) return;

        const title = document.getElementById('modalTitle');
        const body = document.getElementById('modalBody');

        title.textContent = `${agent.name} - Qarzdor mijozlar`;

        // cachedAgentDebts da allaqachon srok bilan clients bor!
        // Kuni o'tib ketgani bo'yicha tartiblash (eng ko'p muddati o'tgan birinchi)
        const sortedClients = (agent.clients || []).sort((a, b) => {
            const aOverdue = a.isOverdue ? a.overdueDays : -(a.daysLeft || 9999);
            const bOverdue = b.isOverdue ? b.overdueDays : -(b.daysLeft || 9999);
            return bOverdue - aOverdue; // Eng ko'p muddati o'tgan birinchi
        }).map(c => ({
            name: c.name,
            balanceTotal: c.somDebt || 0,
            balanceCash: c.somDebt || 0,
            balanceDollar: c.dollarDebt || 0,
            srokDate: c.srokDate || '',
            overdueDays: c.overdueDays || 0,
            daysLeft: c.daysLeft || 0,
            isOverdue: c.isOverdue || false
        }));

        // Срок ustunini ko'rsatish funksiyasi - FAQAT KUN HOLATI
        const formatSrok = (client) => {
            if (!client.srokDate) return '<span style="color: #6b7280;">—</span>';

            // Muddati o'tgan bo'lsa - qizil, minus bilan
            if (client.isOverdue || client.overdueDays > 0) {
                const days = client.overdueDays || 0;
                return `<span style="color: #ef4444; font-weight: 700; font-size: 14px;">-${days} kun</span>`;
            } else {
                // Muddati o'tmagan - yashil, plus bilan
                const days = client.daysLeft || 0;
                return `<span style="color: #10b981; font-weight: 700; font-size: 14px;">+${days} kun</span>`;
            }
        };

        // Srok o'tgan statistikani hisoblash
        const overdueClients = sortedClients.filter(c => c.isOverdue);
        const overdueDollarSum = overdueClients.reduce((s, c) => s + Math.abs(c.balanceDollar || 0), 0);
        const overdueSomSum = overdueClients.reduce((s, c) => s + Math.abs(c.balanceTotal || 0), 0);
        const totalDollarAbs = Math.abs(agent.totalDollar || 0);
        const overduePercent = totalDollarAbs > 0 ? Math.round((overdueDollarSum / totalDollarAbs) * 100) : 0;
        const maxOverdueDays = overdueClients.length > 0 ? Math.max(...overdueClients.map(c => c.overdueDays || 0)) : 0;

        body.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px;">
                <div style="background:linear-gradient(135deg,rgba(59,130,246,0.15),rgba(59,130,246,0.05));border:1px solid rgba(59,130,246,0.25);border-radius:10px;padding:10px;text-align:center;">
                    <div style="color:#93c5fd;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Jami qarz</div>
                    <div style="color:#60a5fa;font-size:16px;font-weight:800;">$${totalDollarAbs.toLocaleString()}</div>
                    <div style="color:#6b7280;font-size:10px;margin-top:2px;">${sortedClients.length} ta mijoz</div>
                </div>
                <div style="background:linear-gradient(135deg,rgba(239,68,68,0.2),rgba(239,68,68,0.05));border:1px solid rgba(239,68,68,0.35);border-radius:10px;padding:10px;text-align:center;">
                    <div style="color:#fca5a5;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">🔴 Srok o'tgan</div>
                    <div style="color:#ef4444;font-size:16px;font-weight:800;">$${overdueDollarSum.toLocaleString()}</div>
                    <div style="color:#ef4444;font-size:10px;margin-top:2px;font-weight:600;">${overduePercent}% — ${overdueClients.length} mijoz</div>
                </div>
                <div style="background:linear-gradient(135deg,rgba(245,158,11,0.15),rgba(245,158,11,0.05));border:1px solid rgba(245,158,11,0.3);border-radius:10px;padding:10px;text-align:center;">
                    <div style="color:#fcd34d;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">⚠️ Max kechikish</div>
                    <div style="color:#f59e0b;font-size:16px;font-weight:800;">${maxOverdueDays} kun</div>
                    <div style="color:#6b7280;font-size:10px;margin-top:2px;">eng uzoq muddat</div>
                </div>
                <div style="background:linear-gradient(135deg,rgba(16,185,129,0.15),rgba(16,185,129,0.05));border:1px solid rgba(16,185,129,0.25);border-radius:10px;padding:10px;text-align:center;">
                    <div style="color:#6ee7b7;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">✅ Muddatida</div>
                    <div style="color:#10b981;font-size:16px;font-weight:800;">$${(totalDollarAbs - overdueDollarSum).toLocaleString()}</div>
                    <div style="color:#10b981;font-size:10px;margin-top:2px;">${100 - overduePercent}% — ${sortedClients.length - overdueClients.length} mijoz</div>
                </div>
            </div>
            <div style="height:4px;background:rgba(16,185,129,0.3);border-radius:2px;margin-bottom:8px;overflow:hidden;">
                <div style="height:100%;width:${overduePercent}%;background:linear-gradient(90deg,#ef4444,#f97316);border-radius:2px;"></div>
            </div>
            <button onclick="window.app?.openDebtModal()" style="
                background: rgba(0, 113, 227, 0.2);
                border: 1px solid rgba(0, 113, 227, 0.5);
                color: #0071e3;
                padding: 6px 14px;
                border-radius: 8px;
                cursor: pointer;
                margin-bottom: 10px;
                font-size: 13px;
            ">← Orqaga</button>
            <div class="data-table-wrapper" style="max-height: 50vh; overflow-y: auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th class="rank">#</th>
                            <th>Mijoz nomi</th>
                            <th>So'm</th>
                            <th>Dollar</th>
                            <th>Срок</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sortedClients.map((c, i) => {
            const rowBg = c.isOverdue
                ? 'background: rgba(239,68,68,0.06);'
                : (c.srokDate ? '' : '');
            return `
                            <tr style="${rowBg}">
                                <td class="rank">${i + 1}</td>
                                <td class="name">${c.name}</td>
                                <td class="amount" style="color: #ef4444;">${this.formatCurrency(c.balanceTotal || c.balanceCash || 0)}</td>
                                <td class="amount" style="color: #ef4444;">$${(c.balanceDollar || 0).toLocaleString()}</td>
                                <td style="text-align: center;">${formatSrok(c)}</td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }


    // Sotuvlar batafsil
    renderSalesDetail() {
        const orders = this.cachedOrders || [];
        const { startDate, endDate } = this.getDateRange(this.currentPeriod);

        const filteredOrders = orders.filter(order => {
            const orderDate = (order.dateCreate || order.dateDocument || '').split('T')[0].split(' ')[0];
            if (startDate && endDate) {
                return orderDate >= startDate && orderDate <= endDate;
            }
            return true;
        });

        // Mijozlar bo'yicha guruhlash
        const clientSales = {};
        filteredOrders.forEach(order => {
            const clientName = order.client?.clientName || order.client?.clientLegalName || 'Noma\'lum';
            const clientId = order.client?.SD_id || 'unknown';
            const sum = parseFloat(order.totalSumma) || 0;

            if (!clientSales[clientId]) {
                clientSales[clientId] = { name: clientName, total: 0, count: 0 };
            }
            clientSales[clientId].total += sum;
            clientSales[clientId].count++;
        });

        // Saralash (ko'pdan kamga)
        const sorted = Object.values(clientSales).sort((a, b) => b.total - a.total).slice(0, 50);
        const totalSum = sorted.reduce((sum, c) => sum + c.total, 0);

        return `
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px;">
                <div style="background:linear-gradient(135deg,rgba(52,199,89,0.15),rgba(52,199,89,0.05));border:1px solid rgba(52,199,89,0.25);border-radius:10px;padding:10px;text-align:center;">
                    <div style="color:#6ee7b7;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">💰 Jami summa</div>
                    <div style="color:#34c759;font-size:16px;font-weight:800;">${this.formatCurrency(totalSum)}</div>
                    <div style="color:#6b7280;font-size:10px;margin-top:2px;">so'm</div>
                </div>
                <div style="background:linear-gradient(135deg,rgba(59,130,246,0.15),rgba(59,130,246,0.05));border:1px solid rgba(59,130,246,0.25);border-radius:10px;padding:10px;text-align:center;">
                    <div style="color:#93c5fd;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">👥 Mijozlar</div>
                    <div style="color:#60a5fa;font-size:16px;font-weight:800;">${sorted.length}</div>
                    <div style="color:#6b7280;font-size:10px;margin-top:2px;">ta xaridor</div>
                </div>
                <div style="background:linear-gradient(135deg,rgba(168,85,247,0.15),rgba(168,85,247,0.05));border:1px solid rgba(168,85,247,0.25);border-radius:10px;padding:10px;text-align:center;">
                    <div style="color:#d8b4fe;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">📦 Buyurtmalar</div>
                    <div style="color:#a855f7;font-size:16px;font-weight:800;">${filteredOrders.length}</div>
                    <div style="color:#6b7280;font-size:10px;margin-top:2px;">ta buyurtma</div>
                </div>
                <div style="background:linear-gradient(135deg,rgba(245,158,11,0.15),rgba(245,158,11,0.05));border:1px solid rgba(245,158,11,0.25);border-radius:10px;padding:10px;text-align:center;">
                    <div style="color:#fcd34d;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">📊 O'rtacha</div>
                    <div style="color:#f59e0b;font-size:16px;font-weight:800;">${this.formatCurrency(filteredOrders.length > 0 ? Math.round(totalSum / filteredOrders.length) : 0)}</div>
                    <div style="color:#6b7280;font-size:10px;margin-top:2px;">har buyurtma</div>
                </div>
            </div>
            <div class="data-table-wrapper" style="max-height: 55vh; overflow-y: auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th class="rank">#</th>
                            <th>Mijoz nomi</th>
                            <th>Buyurtmalar</th>
                            <th>Jami summa</th>
                            <th style="width:120px;">Ulush</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sorted.map((c, i) => {
            const percent = totalSum > 0 ? Math.round((c.total / totalSum) * 100) : 0;
            return `
                            <tr>
                                <td class="rank">${i + 1}</td>
                                <td class="name">${c.name}</td>
                                <td class="count">${c.count} ta</td>
                                <td class="amount" style="color:#34c759;">${this.formatCurrency(c.total)}</td>
                                <td>
                                    <div style="display:flex;align-items:center;gap:6px;">
                                        <div style="flex:1;height:4px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;">
                                            <div style="height:100%;width:${percent}%;background:linear-gradient(90deg,#34c759,#30d158);border-radius:2px;"></div>
                                        </div>
                                        <span style="font-size:11px;color:#6b7280;min-width:30px;text-align:right;">${percent}%</span>
                                    </div>
                                </td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    // Buyurtmalar batafsil
    renderOrdersDetail() {
        const orders = this.cachedOrders || [];
        const { startDate, endDate } = this.getDateRange(this.currentPeriod);

        const filteredOrders = orders.filter(order => {
            const orderDate = (order.dateCreate || order.dateDocument || '').split('T')[0].split(' ')[0];
            if (startDate && endDate) {
                return orderDate >= startDate && orderDate <= endDate;
            }
            return true;
        }).slice(0, 100);

        const totalSum = filteredOrders.reduce((s, o) => s + (parseFloat(o.totalSumma) || 0), 0);

        return `
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px;">
                <div style="background:linear-gradient(135deg,rgba(168,85,247,0.15),rgba(168,85,247,0.05));border:1px solid rgba(168,85,247,0.25);border-radius:10px;padding:10px;text-align:center;">
                    <div style="color:#d8b4fe;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">📦 Buyurtmalar</div>
                    <div style="color:#a855f7;font-size:16px;font-weight:800;">${filteredOrders.length}</div>
                    <div style="color:#6b7280;font-size:10px;margin-top:2px;">ta ko'rsatilgan</div>
                </div>
                <div style="background:linear-gradient(135deg,rgba(52,199,89,0.15),rgba(52,199,89,0.05));border:1px solid rgba(52,199,89,0.25);border-radius:10px;padding:10px;text-align:center;">
                    <div style="color:#6ee7b7;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">💰 Jami summa</div>
                    <div style="color:#34c759;font-size:16px;font-weight:800;">${this.formatCurrency(totalSum)}</div>
                    <div style="color:#6b7280;font-size:10px;margin-top:2px;">so'm</div>
                </div>
                <div style="background:linear-gradient(135deg,rgba(245,158,11,0.15),rgba(245,158,11,0.05));border:1px solid rgba(245,158,11,0.25);border-radius:10px;padding:10px;text-align:center;">
                    <div style="color:#fcd34d;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">📊 O'rtacha</div>
                    <div style="color:#f59e0b;font-size:16px;font-weight:800;">${this.formatCurrency(filteredOrders.length > 0 ? Math.round(totalSum / filteredOrders.length) : 0)}</div>
                    <div style="color:#6b7280;font-size:10px;margin-top:2px;">har buyurtma</div>
                </div>
            </div>
            <div class="data-table-wrapper" style="max-height: 55vh; overflow-y: auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th class="rank">#</th>
                            <th>Sana</th>
                            <th>Mijoz</th>
                            <th>Agent</th>
                            <th>Summa</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredOrders.map((o, i) => `
                            <tr>
                                <td class="rank">${i + 1}</td>
                                <td style="color:#93c5fd;font-size:13px;">${(o.dateCreate || o.dateDocument || '').split('T')[0]}</td>
                                <td class="name">${o.client?.clientName || o.client?.clientLegalName || '-'}</td>
                                <td style="color:#d8b4fe;">${o.agent?.SD_id || '-'}</td>
                                <td class="amount" style="color:#34c759;">${this.formatCurrency(parseFloat(o.totalSumma) || 0)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    // Mijozlar batafsil - placeholder
    renderClientsDetail() {
        return `
            <div class="modal-summary">
                <div class="summary-item">
                    <span class="summary-label">Jami mijozlar</span>
                    <span class="summary-value">${document.getElementById('totalClientsOKB')?.textContent || '0'}</span>
                </div>
            </div>
            <p style="text-align: center; color: var(--text-secondary); padding: 40px;">
                Mijozlar ro'yxati yuklanmoqda...
            </p>
        `;
    }

    // Mahsulotlar batafsil - placeholder
    renderProductsDetail() {
        return `
            <div class="modal-summary">
                <div class="summary-item">
                    <span class="summary-label">Jami mahsulotlar</span>
                    <span class="summary-value">${document.getElementById('totalProducts')?.textContent || '0'}</span>
                </div>
            </div>
            <p style="text-align: center; color: var(--text-secondary); padding: 40px;">
                Mahsulotlar ro'yxati yuklanmoqda...
            </p>
        `;
    }

    // Iroda agentlari batafsil
    renderIrodaAgentsDetail() {
        const orders = this.cachedOrders || [];
        const { startDate, endDate } = this.getDateRange(this.currentPeriod);

        const filteredOrders = orders.filter(order => {
            const orderDate = (order.dateCreate || order.dateDocument || '').split('T')[0].split(' ')[0];
            if (startDate && endDate) {
                return orderDate >= startDate && orderDate <= endDate;
            }
            return true;
        });

        // Iroda agentlari
        const irodaAgentIds = {
            'd0_2': 'Nilufarxon',
            'd0_6': 'Usmonqulov Asadulloh',
            'd0_7': 'Axmedova Xalimaxon',
            'd0_8': 'Abduraxmonov Shuxrat',
            'd0_10': 'Abduraximova Muxayyoxon',
            'd0_11': 'Aliakbar Yusupov',
            'd0_19': 'Soliev Ibrohimjon',
            'd0_20': 'Oybek',
            'd0_22': 'Tojiboyev Abubakir',
            'd0_24': 'Xolmirzayeva Honzodaxon',
            'd0_25': 'Xolmuxamedova Ziroatxon',
            'd0_28': 'Matkarimov Bexruz'
        };

        // Agent bo'yicha savdolarni hisoblash
        const agentSales = {};
        Object.keys(irodaAgentIds).forEach(id => {
            agentSales[id] = { name: irodaAgentIds[id], totalUZS: 0, totalUSD: 0, count: 0 };
        });

        filteredOrders.forEach(order => {
            const agentId = order.agent?.SD_id;
            if (agentId && agentSales[agentId]) {
                const sum = parseFloat(order.totalSumma) || 0;
                const paymentTypeId = order.paymentType?.SD_id;

                if (paymentTypeId === 'd0_4') {
                    agentSales[agentId].totalUSD += sum;
                } else {
                    agentSales[agentId].totalUZS += sum;
                }
                agentSales[agentId].count++;
            }
        });

        // Saralash
        const sorted = Object.values(agentSales)
            .filter(a => a.count > 0)
            .sort((a, b) => b.totalUZS - a.totalUZS);

        const totalUZS = sorted.reduce((sum, a) => sum + a.totalUZS, 0);
        const totalUSD = sorted.reduce((sum, a) => sum + a.totalUSD, 0);
        const totalOrders = sorted.reduce((sum, a) => sum + a.count, 0);

        return `
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px;">
                <div style="background:linear-gradient(135deg,rgba(52,199,89,0.15),rgba(52,199,89,0.05));border:1px solid rgba(52,199,89,0.25);border-radius:10px;padding:10px;text-align:center;">
                    <div style="color:#6ee7b7;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">💰 Jami so'm</div>
                    <div style="color:#34c759;font-size:16px;font-weight:800;">${this.formatCurrency(totalUZS)}</div>
                    <div style="color:#6b7280;font-size:10px;margin-top:2px;">so'm</div>
                </div>
                <div style="background:linear-gradient(135deg,rgba(59,130,246,0.15),rgba(59,130,246,0.05));border:1px solid rgba(59,130,246,0.25);border-radius:10px;padding:10px;text-align:center;">
                    <div style="color:#93c5fd;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">💵 Jami dollar</div>
                    <div style="color:#60a5fa;font-size:16px;font-weight:800;">$${totalUSD.toLocaleString()}</div>
                    <div style="color:#6b7280;font-size:10px;margin-top:2px;">dollar</div>
                </div>
                <div style="background:linear-gradient(135deg,rgba(168,85,247,0.15),rgba(168,85,247,0.05));border:1px solid rgba(168,85,247,0.25);border-radius:10px;padding:10px;text-align:center;">
                    <div style="color:#d8b4fe;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">📦 Buyurtmalar</div>
                    <div style="color:#a855f7;font-size:16px;font-weight:800;">${totalOrders}</div>
                    <div style="color:#6b7280;font-size:10px;margin-top:2px;">ta buyurtma</div>
                </div>
                <div style="background:linear-gradient(135deg,rgba(245,158,11,0.15),rgba(245,158,11,0.05));border:1px solid rgba(245,158,11,0.25);border-radius:10px;padding:10px;text-align:center;">
                    <div style="color:#fcd34d;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">👥 Agentlar</div>
                    <div style="color:#f59e0b;font-size:16px;font-weight:800;">${sorted.length}</div>
                    <div style="color:#6b7280;font-size:10px;margin-top:2px;">ta aktiv</div>
                </div>
            </div>
            <div class="data-table-wrapper" style="max-height: 55vh; overflow-y: auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th class="rank">#</th>
                            <th>Agent ismi</th>
                            <th>Buyurtmalar</th>
                            <th>Savdo (so'm)</th>
                            <th>Savdo ($)</th>
                            <th style="width:100px;">Ulush</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sorted.map((a, i) => {
            const percent = totalUZS > 0 ? Math.round((a.totalUZS / totalUZS) * 100) : 0;
            return `
                            <tr>
                                <td class="rank">${i + 1}</td>
                                <td class="name">${a.name}</td>
                                <td style="color:#d8b4fe;">${a.count} ta</td>
                                <td style="color:#34c759;font-weight:600;">${this.formatCurrency(a.totalUZS)}</td>
                                <td style="color:#60a5fa;font-weight:600;">$${a.totalUSD.toLocaleString()}</td>
                                <td>
                                    <div style="display:flex;align-items:center;gap:4px;">
                                        <div style="flex:1;height:4px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;">
                                            <div style="height:100%;width:${percent}%;background:linear-gradient(90deg,#34c759,#30d158);border-radius:2px;"></div>
                                        </div>
                                        <span style="font-size:10px;color:#6b7280;min-width:24px;text-align:right;">${percent}%</span>
                                    </div>
                                </td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    formatCurrency(value) {
        // To'liq raqam ko'rsatish (mln emas)
        const abs = Math.abs(value);
        const formatted = Math.round(abs).toLocaleString('ru-RU');
        return (value < 0 ? '-' : '') + formatted;
    }

}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    window.app = new SalesDoctorApp();
});
