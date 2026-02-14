/**
 * Sales Doctor Analytics - Caching Proxy Server
 * 🚀 Tez yuklash uchun server-side cache
 */

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS ni yoqish
app.use(cors());
app.use(express.json());

// Static fayllarni xizmat qilish
app.use(express.static(path.join(__dirname)));

// =============================================================================
// 🚀 SERVER-SIDE CACHE SYSTEM
// =============================================================================

const CACHE_CONFIG = {
    REFRESH_INTERVAL: 10 * 60 * 1000, // 10 daqiqa
    API_CREDENTIALS: {
        serverUrl: 'rafiq.salesdoc.io',
        login: 'admin',
        password: '1234567rafiq',
        userId: null,  // Login orqali olinadi
        token: null    // Login orqali olinadi
    }
};

// Cache xotirasi
let serverCache = {
    orders: null,           // Barcha buyurtmalar
    products: null,         // Barcha mahsulotlar
    clients: null,          // Barcha mijozlar
    balances: null,         // Barcha qarzlar
    payments: null,         // Barcha to'lovlar
    purchases: null,        // Barcha prixodlar (tan narx uchun)
    stock: null,            // Ostatka (getStock dan)
    priceTypes: null,       // Narx turlari
    agents: null,           // Agentlar
    transactions: null,     // Web panel transactions (SROK bilan!)
    catalogPrices: null,    // Web paneldan barcha narxlar (product -> priceType -> price)
    stats: null,            // Hisoblangan statistika
    lastUpdate: null,       // Oxirgi yangilanish
    isLoading: false,       // Yuklanish holati
    error: null             // Xato
};

// 🔐 Login funksiyasi - yangi token olish
async function refreshToken() {
    const { serverUrl, login, password } = CACHE_CONFIG.API_CREDENTIALS;
    const apiUrl = `https://${serverUrl}/api/v2/`;

    console.log('🔐 Login qilinyapti...');

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                method: 'login',
                auth: { login, password }
            })
        });

        const data = await response.json();

        if (data.status && data.result) {
            CACHE_CONFIG.API_CREDENTIALS.userId = data.result.userId;
            CACHE_CONFIG.API_CREDENTIALS.token = data.result.token;
            console.log(`✅ Login muvaffaqiyatli! userId: ${data.result.userId}`);
            return true;
        } else {
            console.error('❌ Login xatosi:', data.error);
            return false;
        }
    } catch (error) {
        console.error('❌ Login network xatosi:', error.message);
        return false;
    }
}

// 🌐 Web panel login - session cookie olish (srok uchun)
let webSessionCookies = {};
async function webLogin() {
    try {
        const { serverUrl, login, password } = CACHE_CONFIG.API_CREDENTIALS;
        const webBase = `https://${serverUrl}`;

        // 1. Login sahifasi - cookie olish
        const page1 = await fetch(webBase + '/site/login', {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            redirect: 'manual'
        });
        (page1.headers.raw()['set-cookie'] || []).forEach(c => {
            const parts = c.split(';')[0].split('=');
            webSessionCookies[parts[0].trim()] = parts.slice(1).join('=').trim();
        });

        // 2. Login POST
        const cookieStr = Object.keys(webSessionCookies).map(k => k + '=' + webSessionCookies[k]).join('; ');
        const loginRes = await fetch(webBase + '/site/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': cookieStr,
                'User-Agent': 'Mozilla/5.0'
            },
            body: `LoginForm[username]=${login}&LoginForm[password]=${password}&LoginForm[rememberMe]=1`,
            redirect: 'manual'
        });
        (loginRes.headers.raw()['set-cookie'] || []).forEach(c => {
            const parts = c.split(';')[0].split('=');
            webSessionCookies[parts[0].trim()] = parts.slice(1).join('=').trim();
        });

        // 3. Follow redirect
        const loc = loginRes.headers.get('location');
        if (loc) {
            const fullUrl = loc.startsWith('http') ? loc : webBase + loc;
            const rr = await fetch(fullUrl, {
                headers: { 'Cookie': cookieStr, 'User-Agent': 'Mozilla/5.0' },
                redirect: 'manual'
            });
            (rr.headers.raw()['set-cookie'] || []).forEach(c => {
                const parts = c.split(';')[0].split('=');
                webSessionCookies[parts[0].trim()] = parts.slice(1).join('=').trim();
            });
        }

        console.log('✅ Web panel login muvaffaqiyatli!');
        return true;
    } catch (error) {
        console.error('❌ Web login xatosi:', error.message);
        return false;
    }
}

// 📊 Web paneldan transactions + SROK ma'lumotlarini olish
async function fetchTransactionsData() {
    try {
        const { serverUrl } = CACHE_CONFIG.API_CREDENTIALS;
        const webBase = `https://${serverUrl}`;
        const cookieStr = Object.keys(webSessionCookies).map(k => k + '=' + webSessionCookies[k]).join('; ');

        // Session yaratish (sahifa ochish)
        await fetch(webBase + '/clients/transactions', {
            headers: { 'Cookie': cookieStr, 'User-Agent': 'Mozilla/5.0' }
        });

        // JsonData endpointidan ma'lumot olish
        const res = await fetch(webBase + '/clients/transactions/JsonData?hand=1', {
            headers: {
                'Cookie': cookieStr,
                'User-Agent': 'Mozilla/5.0',
                'X-Requested-With': 'XMLHttpRequest',
                'Accept': 'application/json, text/plain, */*'
            }
        });
        const body = await res.text();
        const json = JSON.parse(body);

        if (!json.data || !Array.isArray(json.data)) {
            console.error('❌ JsonData ma\'lumot formati noto\'g\'ri');
            return null;
        }

        // Ma'lumotlarni parse qilish
        // [0]=clientId, [2]=name, [6]=territory, [11]=totalDebt, [12]=cashDebt,
        // [13]=dollarDebt, [14]=totalDebt2, [16]=srokDate(HTML), [17]=overdueDays,
        // [24]=agentName
        const clients = json.data.map(row => {
            // Srok sanasini HTML dan olish: <span style="...">2026-02-04</span>
            let srokDate = '';
            let isOverdue = false;
            const srokHtml = String(row[16] || '');
            const dateMatch = srokHtml.match(/(\d{4}-\d{2}-\d{2})/);
            if (dateMatch) {
                srokDate = dateMatch[1];
                isOverdue = srokHtml.indexOf('#e74c3c') >= 0; // Qizil = muddati o'tgan
            }

            const overdueDays = parseInt(row[17]) || 0;

            // Qarz summalarini parse qilish (vergul va nuqta bilan)
            const parseNum = (val) => {
                if (!val) return 0;
                return parseFloat(String(val).replace(/,/g, '').replace(/\s/g, '')) || 0;
            };

            return {
                clientId: row[0] || '',
                name: row[2] || '',
                territory: row[6] || '',
                totalDebt: parseNum(row[11]),
                cashDebt: parseNum(row[12]),
                dollarDebt: parseNum(row[13]),
                srokDate: srokDate,
                overdueDays: overdueDays,
                isOverdue: isOverdue,
                agentName: row[24] || '',
                agentCode: row[25] || ''
            };
        });

        console.log(`   ✅ ${clients.length} ta mijoz (srok bilan)`);
        return clients;
    } catch (error) {
        console.error('❌ Transactions fetch xatosi:', error.message);
        return null;
    }
}

// 📊 Web paneldan barcha narxlarni olish (catalog prices)
async function fetchCatalogPrices() {
    try {
        const { serverUrl } = CACHE_CONFIG.API_CREDENTIALS;
        const webBase = `https://${serverUrl}`;
        const cookieStr = Object.keys(webSessionCookies).map(k => k + '=' + webSessionCookies[k]).join('; ');

        const res = await fetch(webBase + '/catalog', {
            method: 'POST',
            headers: {
                'Cookie': cookieStr,
                'User-Agent': 'Mozilla/5.0',
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({
                active: {
                    priceTypes: ['id', 'name', 'type', 'currency'],
                },
                all: {
                    prices: ['id', 'price_type_id', 'product_id', 'price'],
                    currencies: ['id', 'name', 'code', 'title'],
                }
            })
        });

        if (res.status !== 200) {
            throw new Error(`Catalog status: ${res.status}`);
        }

        const data = await res.json();

        // Transform data — priceTypes jadvalidagi birinchi qator = sarlavhalar
        const priceTypesData = {};
        if (data.priceTypes && data.priceTypes.length > 1) {
            const headers = data.priceTypes[0]; // ['id', 'name', 'type', 'currency']
            for (let i = 1; i < data.priceTypes.length; i++) {
                const row = data.priceTypes[i];
                const obj = {};
                headers.forEach((h, idx) => obj[h] = row[idx]);
                priceTypesData[obj.id] = obj;
            }
        }

        // Transform currencies
        const currenciesData = {};
        if (data.currencies && data.currencies.length > 1) {
            const headers = data.currencies[0];
            for (let i = 1; i < data.currencies.length; i++) {
                const row = data.currencies[i];
                const obj = {};
                headers.forEach((h, idx) => obj[h] = row[idx]);
                currenciesData[obj.id] = obj;
            }
        }

        // Transform prices — product -> priceType -> price
        const productPrices = {};
        if (data.prices && data.prices.length > 1) {
            const headers = data.prices[0]; // ['id', 'price_type_id', 'product_id', 'price']
            for (let i = 1; i < data.prices.length; i++) {
                const row = data.prices[i];
                const obj = {};
                headers.forEach((h, idx) => obj[h] = row[idx]);

                const productId = obj.product_id;
                const priceTypeId = obj.price_type_id;
                const price = parseFloat(obj.price) || 0;

                if (!productPrices[productId]) {
                    productPrices[productId] = {};
                }
                productPrices[productId][priceTypeId] = price;
            }
        }

        return {
            priceTypes: priceTypesData,
            currencies: currenciesData,
            productPrices: productPrices
        };
    } catch (error) {
        console.error('❌ Catalog prices fetch xatosi:', error.message);
        return null;
    }
}

// API so'rov helper
async function apiRequest(method, params = {}, retried = false) {
    const { serverUrl, userId, token } = CACHE_CONFIG.API_CREDENTIALS;
    const apiUrl = `https://${serverUrl}/api/v2/`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                auth: { userId, token },
                method: method,
                params: params
            })
        });

        const data = await response.json();

        // Token expired — auto re-login
        if (data.status === false && !retried) {
            const errMsg = (typeof data.error === 'string' ? data.error : JSON.stringify(data.error || '')).toLowerCase();
            if (errMsg.includes('token') || errMsg.includes('auth') || errMsg.includes('unauthorized') || errMsg.includes('user not found')) {
                console.log(`   🔄 Token expired, qayta login...`);
                const loginOk = await refreshToken();
                if (loginOk) {
                    return apiRequest(method, params, true); // retry
                }
            }
        }

        // Xato tekshirish
        if (data.status === false) {
            console.error(`   ⚠️ API ${method} xatosi:`, data.error);
        }

        return data;
    } catch (error) {
        console.error(`   ❌ API ${method} network xatosi:`, error.message);
        return { status: false, error: error.message };
    }
}

// Pagination bilan barcha ma'lumotlarni olish
async function fetchAllPaginated(method, resultKey, limit = 1000, maxPages = 20, dateFilter = null) {
    let allItems = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= maxPages) {
        try {
            const params = { page, limit, filter: { status: 'all' } };

            // Sana filtri qo'shish (buyurtmalar uchun)
            if (dateFilter && dateFilter.startDate && dateFilter.endDate) {
                params.filter.startDate = dateFilter.startDate;
                params.filter.endDate = dateFilter.endDate;
            }

            const data = await apiRequest(method, params);
            const items = data?.result?.[resultKey] || [];

            if (items.length > 0) {
                allItems = allItems.concat(items);
                hasMore = items.length === limit;
                page++;
            } else {
                hasMore = false;
            }
        } catch (e) {
            console.error(`❌ ${method} sahifa ${page} xatosi:`, e.message);
            hasMore = false;
        }
    }

    return allItems;
}

// To'lovlarni alohida olish — SD API pagination muammosi uchun
async function fetchAllPayments() {
    let allPayments = [];
    let page = 1;
    const maxPages = 10;
    const limit = 1000;

    while (page <= maxPages) {
        try {
            const data = await apiRequest('getPayment', { page, limit });
            const items = data?.result?.payment || [];

            console.log(`   📄 getPayment sahifa ${page}: ${items.length} ta`);

            if (items.length === 0) break;

            allPayments = allPayments.concat(items);
            page++;
        } catch (e) {
            console.error(`❌ getPayment sahifa ${page} xatosi:`, e.message);
            break;
        }
    }

    return allPayments;
}

// Cache yangilash - BARCHA MA'LUMOTLARNI YUKLASH
async function refreshCache() {
    if (serverCache.isLoading) {
        console.log('⏳ Cache yangilanmoqda, kutilmoqda...');
        return;
    }

    serverCache.isLoading = true;
    serverCache.error = null;
    const startTime = Date.now();

    console.log('');
    console.log('╔════════════════════════════════════════════════╗');
    console.log('║  🔄 CACHE YANGILANMOQDA...                     ║');
    console.log('╚════════════════════════════════════════════════╝');

    // Avval login qilish (yangi token olish)
    const loginSuccess = await refreshToken();
    if (!loginSuccess) {
        console.error('❌ Login muvaffaqiyatsiz - cache yangilanmadi');
        serverCache.isLoading = false;
        serverCache.error = 'Login xatosi';
        return;
    }

    try {
        // 1. Buyurtmalar - BARCHA buyurtmalarni olish
        // MUHIM: SD API dateFilter bilan faqat cheklangan natija qaytaradi (1500 ta),
        // Shuning uchun dateFilter SIZ barcha buyurtmalarni olib, server tomondan filtrlash kerak
        console.log('� Buyurtmalar yuklanmoqda (barcha)...');

        // Max pages 100 * 500 = 50,000 buyurtma
        serverCache.orders = await fetchAllPaginated('getOrder', 'order', 500, 100);
        console.log(`   ✅ ${serverCache.orders.length} ta buyurtma`);

        // 2. Mahsulotlar
        console.log('📦 Mahsulotlar yuklanmoqda...');
        serverCache.products = await fetchAllPaginated('getProduct', 'product', 500);
        console.log(`   ✅ ${serverCache.products.length} ta mahsulot`);

        // 3. Mijozlar
        console.log('👥 Mijozlar yuklanmoqda...');
        serverCache.clients = await fetchAllPaginated('getClient', 'client', 500);
        console.log(`   ✅ ${serverCache.clients.length} ta mijoz`);

        // 4. Qarzlar (Balance)
        console.log('💰 Qarzlar yuklanmoqda...');
        serverCache.balances = await fetchAllPaginated('getBalance', 'balance', 1000);
        console.log(`   ✅ ${serverCache.balances.length} ta balance`);

        // 5. To'lovlar (alohida funksiya — pagination muammosi uchun)
        console.log('💳 Tolovlar yuklanmoqda...');
        serverCache.payments = await fetchAllPayments();
        console.log(`   ✅ ${serverCache.payments.length} ta to'lov`);

        // 6. Prixodlar (tan narx uchun)
        console.log('📥 Prixodlar yuklanmoqda...');
        // Max pages 50 * 500 = 25,000 prixod
        serverCache.purchases = await fetchAllPaginated('getPurchase', 'warehouse', 500, 50);
        console.log(`   ✅ ${serverCache.purchases.length} ta prixod`);

        // 6.5. Stock (ostatka)
        console.log('📦 Stock yuklanmoqda...');
        const stockRes = await apiRequest('getStock', { limit: 500 });
        serverCache.stock = stockRes?.result?.warehouse || [];
        console.log(`   ✅ ${serverCache.stock.length} ta sklad`);

        // 7. Narx turlari
        console.log('💵 Narx turlari yuklanmoqda...');
        const priceTypesRes = await apiRequest('getPriceType', {});
        serverCache.priceTypes = priceTypesRes?.result?.priceType || [];
        console.log(`   ✅ ${serverCache.priceTypes.length} ta narx turi`);

        // 8. Agentlar
        console.log('🧑‍💼 Agentlar yuklanmoqda...');
        const agentsRes = await apiRequest('getAgent', { page: 1, limit: 100 });
        serverCache.agents = agentsRes?.result?.agent || [];
        console.log(`   ✅ ${serverCache.agents.length} ta agent`);

        // 8.5. Web paneldan transactions + SROK ma'lumotlarini olish
        console.log('📅 Srok ma\'lumotlari yuklanmoqda (web panel)...');
        const webLoggedIn = await webLogin();
        if (webLoggedIn) {
            serverCache.transactions = await fetchTransactionsData();

            // 8.6. Web paneldan barcha narxlarni olish (catalog prices)
            console.log('💰 Catalog narxlar yuklanmoqda (web panel)...');
            try {
                serverCache.catalogPrices = await fetchCatalogPrices();
                const totalPrices = serverCache.catalogPrices ? Object.keys(serverCache.catalogPrices.productPrices || {}).length : 0;
                console.log(`   ✅ ${totalPrices} ta mahsulot narxi yuklandi`);
            } catch (err) {
                console.log(`   ⚠️ Catalog narxlar yuklanmadi: ${err.message}`);
            }
        } else {
            console.log('   ⚠️ Web login muvaffaqiyatsiz, srok eski hisoblanadi');
        }

        // 9. Statistikani hisoblash
        console.log('📊 Statistika hisoblanmoqda...');
        serverCache.stats = calculateStats();

        serverCache.lastUpdate = new Date();
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);

        console.log('');
        console.log('╔════════════════════════════════════════════════╗');
        console.log(`║  ✅ CACHE YANGILANDI (${duration}s)                  ║`);
        console.log(`║  📅 ${serverCache.lastUpdate.toLocaleString('uz-UZ')}         ║`);
        console.log('╚════════════════════════════════════════════════╝');
        console.log('');

    } catch (error) {
        console.error('❌ Cache yangilash xatosi:', error);
        serverCache.error = error.message;
    } finally {
        serverCache.isLoading = false;
    }
}

// Statistikani hisoblash
function calculateStats() {
    const USD_RATE = 12200;
    const orders = serverCache.orders || [];
    const products = serverCache.products || [];
    const clients = serverCache.clients || [];
    const balances = serverCache.balances || [];
    const purchases = serverCache.purchases || [];

    // Tan narxlarni hisoblash
    const costPrices = {};
    purchases.forEach(p => {
        (p.detail || []).forEach(item => {
            const productId = item.SD_id;
            const rawPrice = parseFloat(item.price) || 0;
            if (rawPrice <= 0) return;

            const isUSD = rawPrice < 100;
            const costPriceUZS = isUSD ? rawPrice * USD_RATE : rawPrice;

            if (!costPrices[productId] || costPrices[productId].date < p.date) {
                costPrices[productId] = {
                    name: item.name,
                    costPriceUZS,
                    currency: isUSD ? 'USD' : 'UZS',
                    date: p.date
                };
            }
        });
    });

    // Dollar narx turlari
    const dollarPriceTypes = new Set(['d0_7', 'd0_8', 'd0_11', 'd0_9', 'd0_6']);
    (serverCache.priceTypes || []).forEach(pt => {
        if (pt.name && (pt.name.includes('$') || pt.name.toLowerCase().includes('dollar'))) {
            dollarPriceTypes.add(pt.SD_id);
        }
    });

    // Har bir davr uchun statistika hisoblash
    const periods = ['today', 'yesterday', 'week', 'month', 'year'];
    const stats = {};

    periods.forEach(period => {
        const dateRange = getDateRange(period);
        const filteredOrders = filterOrdersByDate(orders, dateRange);

        let totalSalesUZS = 0;
        let totalSalesUSD = 0;
        let totalProfitUZS = 0;
        let totalProfitUSD = 0;
        const activeClients = new Set();

        filteredOrders.forEach(order => {
            // Qaytarishlarni o'tkazib yuborish
            if (order.status === 4 || order.status === 5) return;
            const returnsSumma = parseFloat(order.totalReturnsSumma) || 0;
            const totalSumma = parseFloat(order.totalSumma) || 0;
            if (returnsSumma > 0 && returnsSumma === totalSumma) return;

            const sum = totalSumma || parseFloat(order.totalSummaAfterDiscount) || 0;
            const paymentTypeId = order.paymentType?.SD_id;
            const priceTypeId = order.priceType?.SD_id;

            // Aktiv mijozlar
            if (order.client?.SD_id) activeClients.add(order.client.SD_id);

            // Buyurtma dollar yoki so'mda ekanligini aniqlash
            const isUsdOrder = paymentTypeId === 'd0_4' || dollarPriceTypes.has(priceTypeId);

            // Valyutani aniqlash
            if (isUsdOrder) {
                totalSalesUSD += sum;
            } else {
                totalSalesUZS += sum;
            }

            // Foyda hisoblash - valyuta bo'yicha alohida
            (order.orderProducts || []).forEach(item => {
                const productId = item.product?.SD_id;
                const quantity = parseFloat(item.quantity) || 0;
                const rawSumma = parseFloat(item.summa) || 0;

                if (isUsdOrder) {
                    // Dollar buyurtma - foydani USD da hisoblash
                    const costPriceUSD = costPrices[productId]?.currency === 'USD'
                        ? (costPrices[productId]?.costPriceUZS || 0) / USD_RATE
                        : (costPrices[productId]?.costPriceUZS || 0) / USD_RATE;

                    if (costPriceUSD > 0) {
                        const profit = rawSumma - (costPriceUSD * quantity);
                        if (profit > 0 && profit <= rawSumma * 0.40) {
                            totalProfitUSD += profit;
                        } else if (profit > rawSumma * 0.40) {
                            totalProfitUSD += rawSumma * 0.15;
                        }
                    } else {
                        totalProfitUSD += rawSumma * 0.15;
                    }
                } else {
                    // So'm buyurtma - foydani UZS da hisoblash
                    const costPriceUZS = costPrices[productId]?.costPriceUZS || 0;

                    if (costPriceUZS > 0) {
                        const profit = rawSumma - (costPriceUZS * quantity);
                        if (profit > 0 && profit <= rawSumma * 0.40) {
                            totalProfitUZS += profit;
                        } else if (profit > rawSumma * 0.40) {
                            totalProfitUZS += rawSumma * 0.15;
                        }
                    } else {
                        totalProfitUZS += rawSumma * 0.15;
                    }
                }
            });
        });

        // Iroda agentlari hisoblash
        const irodaAgentIds = new Set([
            'd0_2', 'd0_6', 'd0_7', 'd0_8', 'd0_10', 'd0_11',
            'd0_19', 'd0_20', 'd0_22', 'd0_24', 'd0_25', 'd0_28'
        ]);
        let irodaSalesUZS = 0;
        let irodaSalesUSD = 0;
        let irodaOrders = 0;

        filteredOrders.forEach(order => {
            const agentId = order.agent?.SD_id;
            if (agentId && irodaAgentIds.has(agentId)) {
                const orderStatus = order.status;
                const totalSumma = parseFloat(order.totalSumma) || 0;
                const returnsSumma = parseFloat(order.totalReturnsSumma) || 0;
                if (orderStatus === 4 || orderStatus === 5 || (returnsSumma > 0 && returnsSumma === totalSumma) || totalSumma === 0) return;

                const sum = totalSumma;
                const paymentTypeId = order.paymentType?.SD_id;
                if (paymentTypeId === 'd0_4') {
                    irodaSalesUSD += sum;
                } else {
                    irodaSalesUZS += sum;
                }
                irodaOrders++;
            }
        });

        // Ostatka qiymatini hisoblash (dollar) — modal bilan bir xil usulda
        const warehouses = serverCache.stock || [];
        const stockMap = {};
        warehouses.forEach(warehouse => {
            (warehouse.products || []).forEach(item => {
                const productId = item.SD_id;
                const quantity = parseFloat(item.quantity) || 0;
                stockMap[productId] = (stockMap[productId] || 0) + quantity;
            });
        });

        // priceMap — modal bilan bir xil usul (oxirgi occurrence)
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

        let stockValueUSD = 0;
        products.forEach(product => {
            const productId = product.SD_id;
            const ostatka = stockMap[productId] || 0;
            const rawPrice = priceMap[productId] || 0;

            if (ostatka > 0 && rawPrice > 0) {
                const costPriceUSD = rawPrice < 100 ? rawPrice : rawPrice / USD_RATE;
                stockValueUSD += costPriceUSD * ostatka;
            }
        });

        stats[period] = {
            totalSalesUZS,
            totalSalesUSD,
            totalOrders: filteredOrders.length,
            totalClientsOKB: clients.length,
            totalClientsAKB: activeClients.size,
            totalProducts: products.length,
            stockValueUSD: Math.round(stockValueUSD),
            totalProfitUZS,
            totalProfitUSD: Math.round(totalProfitUSD),
            irodaSalesUZS,
            irodaSalesUSD,
            irodaOrders
        };
    });

    // Qarz statistikasi
    const debtors = balances.filter(b => b.balance < 0);
    stats.debts = {
        totalDebtors: debtors.length,
        totalDebtUZS: debtors.reduce((sum, d) => sum + Math.abs(d.balance), 0)
    };

    // Tan narxlarni cache qilish (frontend uchun)
    serverCache.costPrices = costPrices;

    return stats;
}

// Lokal sanani formatlash (timezone muammosini hal qilish)
// O'zbekiston vaqtini olish (UTC+5)
function getNowUzbekistan() {
    const now = new Date();
    // UTC vaqtiga +5 soat qo'shish
    const uzTime = new Date(now.getTime() + 5 * 60 * 60 * 1000);
    return uzTime;
}

function formatLocalDate(date) {
    // getNowUzbekistan allaqachon UTC+5 qo'shgan, shuning uchun UTC komponentlarini ishlatamiz
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

// Sana oralig'ini olish (O'zbekiston vaqtiga qarab)
function getDateRange(period) {
    const now = getNowUzbekistan();
    const endDate = formatLocalDate(now);
    let startDate;

    switch (period) {
        case 'today': startDate = endDate; break;
        case 'yesterday':
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            startDate = formatLocalDate(yesterday);
            return { startDate, endDate: startDate }; // Faqat kecha
        case 'week':
            const weekAgo = new Date(now);
            weekAgo.setDate(weekAgo.getDate() - 7);
            startDate = formatLocalDate(weekAgo);
            break;
        case 'month':
            // Joriy oyning 1-sanasi
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            startDate = formatLocalDate(monthStart);
            break;
        case 'year':
            // Joriy yilning 1-yanvar
            const yearStart = new Date(now.getFullYear(), 0, 1);
            startDate = formatLocalDate(yearStart);
            break;
        default: startDate = endDate;
    }

    return { startDate, endDate };
}

// Buyurtmalarni sana bo'yicha filtrlash
function filterOrdersByDate(orders, { startDate, endDate }) {
    return orders.filter(order => {
        const orderDate = (order.dateCreate || order.dateDocument || '').split('T')[0].split(' ')[0];
        return orderDate >= startDate && orderDate <= endDate;
    });
}

// =============================================================================
// 🌐 CACHE API ENDPOINTS
// =============================================================================

// Cache holati
app.get('/api/cache/status', (req, res) => {
    res.json({
        status: true,
        hasData: !!serverCache.orders,
        lastUpdate: serverCache.lastUpdate,
        isLoading: serverCache.isLoading,
        error: serverCache.error,
        counts: {
            orders: serverCache.orders?.length || 0,
            products: serverCache.products?.length || 0,
            clients: serverCache.clients?.length || 0,
            balances: serverCache.balances?.length || 0,
            payments: serverCache.payments?.length || 0
        }
    });
});

// Statistika endpoint (TEZKOR - cache'dan)
app.get('/api/cache/stats/:period', (req, res) => {
    const period = req.params.period || 'today';
    const { startDate, endDate } = req.query;

    // Custom sana oraligi
    if (period === 'custom' && startDate && endDate) {
        if (!serverCache.orders) {
            return res.json({ status: false, error: 'Cache hali tayyor emas' });
        }

        // Custom statistikani hisoblash
        const orders = filterOrdersByDate(serverCache.orders, { startDate, endDate });
        const stats = calculateStatsForOrders(orders);

        return res.json({
            status: true,
            result: stats,
            lastUpdate: serverCache.lastUpdate
        });
    }

    if (!serverCache.stats || !serverCache.stats[period]) {
        return res.json({
            status: false,
            error: 'Cache hali tayyor emas',
            isLoading: serverCache.isLoading
        });
    }

    res.json({
        status: true,
        result: serverCache.stats[period],
        serverRate: 12200,
        lastUpdate: serverCache.lastUpdate
    });
});

// Buyurtmalar (period bilan)
app.get('/api/cache/orders/:period', (req, res) => {
    const period = req.params.period || 'today';

    if (!serverCache.orders) {
        return res.json({ status: false, error: 'Cache hali tayyor emas' });
    }

    const dateRange = getDateRange(period);
    const orders = filterOrdersByDate(serverCache.orders, dateRange);

    res.json({
        status: true,
        result: { order: orders },
        total: orders.length,
        lastUpdate: serverCache.lastUpdate
    });
});

// Barcha buyurtmalar
app.get('/api/cache/orders', (req, res) => {
    if (!serverCache.orders) {
        return res.json({ status: false, error: 'Cache hali tayyor emas' });
    }

    res.json({
        status: true,
        result: { order: serverCache.orders },
        total: serverCache.orders.length,
        lastUpdate: serverCache.lastUpdate
    });
});

// Qarzlar
app.get('/api/cache/balances', (req, res) => {
    if (!serverCache.balances) {
        return res.json({ status: false, error: 'Cache hali tayyor emas' });
    }

    res.json({
        status: true,
        result: { balance: serverCache.balances },
        total: serverCache.balances.length,
        lastUpdate: serverCache.lastUpdate
    });
});

// Mijozlar
app.get('/api/cache/clients', (req, res) => {
    if (!serverCache.clients) {
        return res.json({ status: false, error: 'Cache hali tayyor emas' });
    }

    res.json({
        status: true,
        result: { client: serverCache.clients },
        total: serverCache.clients.length,
        lastUpdate: serverCache.lastUpdate
    });
});

// Mahsulotlar
app.get('/api/cache/products', (req, res) => {
    if (!serverCache.products) {
        return res.json({ status: false, error: 'Cache hali tayyor emas' });
    }

    res.json({
        status: true,
        result: { product: serverCache.products },
        total: serverCache.products.length,
        lastUpdate: serverCache.lastUpdate
    });
});

// Tan narxlar (prixodlardan)
app.get('/api/cache/purchases', (req, res) => {
    if (!serverCache.purchases) {
        return res.json({ status: false, error: 'Cache hali tayyor emas' });
    }

    res.json({
        status: true,
        result: { warehouse: serverCache.purchases },
        total: serverCache.purchases.length,
        lastUpdate: serverCache.lastUpdate
    });
});

// ============================================
// NARX TEKSHIRISH — Prixod bo'yicha narxlar
// ============================================
app.get('/api/cache/priceCheck', (req, res) => {
    if (!serverCache.purchases || !serverCache.priceTypes) {
        return res.json({ status: false, error: 'Cache hali tayyor emas' });
    }

    const purchases = serverCache.purchases || [];
    const priceTypes = serverCache.priceTypes || [];
    const catalog = serverCache.catalogPrices || null;

    // PriceType xaritasi — ID -> name, currency (API dan)
    const priceTypeMap = {};
    priceTypes.forEach(pt => {
        priceTypeMap[pt.SD_id] = {
            name: pt.name,
            paymentTypeId: pt.paymentType?.SD_id || '',
            currency: pt.paymentType?.SD_id === 'd0_4' ? 'USD' : 'UZS'
        };
    });

    // Catalog dan kelgan priceTypes (web panel dan)
    // catalog.priceTypes = { id: { id, name, type, currency(currencyId) } }
    // catalog.currencies = { id: { id, name, code, title } }
    // catalog.productPrices = { productId: { priceTypeId: price } }
    const catalogPriceTypes = catalog?.priceTypes || {};
    const catalogCurrencies = catalog?.currencies || {};
    const catalogProductPrices = catalog?.productPrices || {};

    // Narx turlari ro'yxati — faqat sotish narxlari (type=2)
    // type=1 kirim (purchase) — allaqachon kirim narx ustunida ko'rsatiladi
    const allPriceTypesList = [];
    // Keraksiz narx turlarini chiqarib tashlash
    const hiddenPriceTypes = new Set(['d0_7', 'd0_8', 'd0_13', 'd0_14']); // Chakana $, Optom $, Nodir aka dokon, Elaro Narx
    Object.values(catalogPriceTypes).forEach(pt => {
        if (pt.type === '1' || pt.type === 1) return; // Kirim narxlarni o'tkazib yuborish
        if (hiddenPriceTypes.has(pt.id)) return; // Keraksiz narx turlarini o'tkazib yuborish
        const currencyInfo = catalogCurrencies[pt.currency] || {};
        const currencyCode = currencyInfo.code || '';
        const isUsd = currencyCode.toLowerCase().includes('usd') ||
            currencyCode.toLowerCase().includes('dollar') ||
            currencyInfo.name?.toLowerCase().includes('dollar');
        allPriceTypesList.push({
            id: pt.id,
            name: pt.name,
            type: pt.type,
            currency: isUsd ? 'USD' : 'UZS',
            currencyName: currencyInfo.name || ''
        });
    });

    // Prixod hujjatlarini sanasi bo'yicha tartiblash (eng yangi birinchi)
    const documents = purchases
        .map(p => {
            const ptId = p.priceType?.SD_id || 'unknown';
            const ptInfo = priceTypeMap[ptId] || { name: 'Noma\'lum', currency: 'UZS' };
            return {
                id: p.purchase_id || p.SD_id,
                date: p.date || '',
                warehouseName: p.name || '',
                shipperName: p.shipper?.name || '',
                priceType: {
                    id: ptId,
                    name: ptInfo.name,
                    currency: ptInfo.currency
                },
                items: (p.detail || []).map(item => {
                    const productId = item.SD_id;

                    // Catalog dan barcha narxlarni olish
                    const catalogPricesForProduct = catalogProductPrices[productId] || {};
                    const otherPrices = {};

                    allPriceTypesList.forEach(pt => {
                        // Hozirgi prixodning o'z priceType dan tashqari barcha narxlarni
                        if (pt.id !== ptId && catalogPricesForProduct[pt.id] !== undefined) {
                            otherPrices[pt.id] = {
                                price: catalogPricesForProduct[pt.id],
                                currency: pt.currency,
                                name: pt.name
                            };
                        }
                    });

                    return {
                        productId: productId,
                        name: item.name,
                        quantity: parseFloat(item.quantity) || 0,
                        price: parseFloat(item.price) || 0,
                        amount: parseFloat(item.amount) || 0,
                        currency: ptInfo.currency,
                        otherPrices: otherPrices
                    };
                })
            };
        })
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    // Barcha narx turlari xaritasi (frontend uchun)
    const fullPriceTypeMap = {};
    allPriceTypesList.forEach(pt => {
        fullPriceTypeMap[pt.id] = {
            name: pt.name,
            currency: pt.currency,
            type: pt.type
        };
    });

    // Dollar kursini catalog narxlardan hisoblash
    // d0_1 = Приходная цена ($), d0_12 = Приходная цена (сум)
    let usdRate = 12800; // default
    const rates = [];
    Object.values(catalogProductPrices).forEach(prices => {
        const usdPrice = prices['d0_1'];
        const uzsPrice = prices['d0_12'];
        if (usdPrice > 0 && uzsPrice > 0) {
            const rate = uzsPrice / usdPrice;
            if (rate > 5000 && rate < 20000) { // Oqilona diapazonda
                rates.push(rate);
            }
        }
    });
    if (rates.length > 0) {
        rates.sort((a, b) => a - b);
        usdRate = rates[Math.floor(rates.length / 2)]; // Median
    }

    res.json({
        status: true,
        documents: documents,
        priceTypes: fullPriceTypeMap,
        allPriceTypes: allPriceTypesList,
        usdRate: Math.round(usdRate),
        totalDocuments: documents.length,
        totalProducts: Object.keys(catalogProductPrices).length,
        hasCatalogPrices: !!catalog,
        lastUpdate: serverCache.lastUpdate
    });
});

// Stock (ostatka)
app.get('/api/cache/stock', (req, res) => {
    if (!serverCache.stock) {
        return res.json({ status: false, error: 'Cache hali tayyor emas' });
    }

    res.json({
        status: true,
        result: { warehouse: serverCache.stock },
        total: serverCache.stock.length,
        lastUpdate: serverCache.lastUpdate
    });
});

// Tan narxlar (server-side hisoblangan)
app.get('/api/cache/costprices', (req, res) => {
    if (!serverCache.costPrices) {
        return res.json({ status: false, error: 'Cache hali tayyor emas' });
    }

    res.json({
        status: true,
        result: serverCache.costPrices,
        total: Object.keys(serverCache.costPrices).length,
        lastUpdate: serverCache.lastUpdate
    });
});

// To'lovlar
app.get('/api/cache/payments', (req, res) => {
    if (!serverCache.payments) {
        return res.json({ status: false, error: 'Cache hali tayyor emas' });
    }

    res.json({
        status: true,
        result: { payment: serverCache.payments },
        total: serverCache.payments.length,
        lastUpdate: serverCache.lastUpdate
    });
});

// Kassa - period bo'yicha to'lovlar statistikasi
app.get('/api/cache/kassa/:period', (req, res) => {
    const period = req.params.period || 'today';

    if (!serverCache.payments) {
        return res.json({ status: false, error: 'Cache hali tayyor emas' });
    }

    const dateRange = getDateRange(period);
    const agents = serverCache.agents || [];
    const clients = serverCache.clients || [];

    // Agent va mijoz nomlarini oldindan tayyorlash
    const agentNames = {};
    agents.forEach(a => {
        agentNames[a.SD_id] = a.name || 'Noma\'lum';
    });

    const clientNames = {};
    clients.forEach(c => {
        clientNames[c.SD_id] = c.name || 'Noma\'lum';
    });

    // Dollar to'lov turlari
    const dollarPayTypes = new Set(['d0_4']);

    // To'lovlarni sana bo'yicha filtrlash
    const filteredPayments = serverCache.payments.filter(p => {
        const payDate = (p.paymentDate || '').split('T')[0].split(' ')[0];
        return payDate >= dateRange.startDate && payDate <= dateRange.endDate;
    });

    let totalUZS = 0;
    let totalUSD = 0;
    const agentPayments = {};

    filteredPayments.forEach(p => {
        const amount = parseFloat(p.amount) || 0;
        if (amount <= 0) return;

        const payTypeId = p.paymentType?.SD_id || '';
        const agentId = p.agent?.SD_id || 'unknown';
        const clientId = p.client?.SD_id || 'unknown';

        const isDollar = dollarPayTypes.has(payTypeId);

        if (isDollar) {
            totalUSD += amount;
        } else {
            totalUZS += amount;
        }

        // Agent statistikasi
        if (!agentPayments[agentId]) {
            agentPayments[agentId] = {
                name: agentNames[agentId] || 'Noma\'lum',
                totalUZS: 0,
                totalUSD: 0,
                count: 0,
                clientPayments: {}
            };
        }

        if (isDollar) {
            agentPayments[agentId].totalUSD += amount;
        } else {
            agentPayments[agentId].totalUZS += amount;
        }
        agentPayments[agentId].count++;

        // Mijoz statistikasi (agent ichida)
        if (!agentPayments[agentId].clientPayments[clientId]) {
            agentPayments[agentId].clientPayments[clientId] = {
                name: clientNames[clientId] || clientId,
                totalUZS: 0,
                totalUSD: 0,
                count: 0
            };
        }

        if (isDollar) {
            agentPayments[agentId].clientPayments[clientId].totalUSD += amount;
        } else {
            agentPayments[agentId].clientPayments[clientId].totalUZS += amount;
        }
        agentPayments[agentId].clientPayments[clientId].count++;
    });

    // Agentlarni jami bo'yicha saralash va mijozlarni array ga aylantirish
    const agentList = Object.entries(agentPayments)
        .map(([id, data]) => {
            const clientList = Object.entries(data.clientPayments)
                .map(([cid, cdata]) => ({ id: cid, ...cdata }))
                .sort((a, b) => (b.totalUZS + b.totalUSD * 12200) - (a.totalUZS + a.totalUSD * 12200));
            return { id, name: data.name, totalUZS: data.totalUZS, totalUSD: data.totalUSD, count: data.count, clients: clientList };
        })
        .sort((a, b) => (b.totalUZS + b.totalUSD * 12200) - (a.totalUZS + a.totalUSD * 12200));

    res.json({
        status: true,
        result: {
            totalUZS,
            totalUSD,
            totalPayments: filteredPayments.length,
            agents: agentList
        },
        lastUpdate: serverCache.lastUpdate
    });
});

// Agentlar
app.get('/api/cache/agents', (req, res) => {
    if (!serverCache.agents) {
        return res.json({ status: false, error: 'Cache hali tayyor emas' });
    }

    res.json({
        status: true,
        result: { agent: serverCache.agents },
        total: serverCache.agents.length,
        lastUpdate: serverCache.lastUpdate
    });
});

// Agentlar
app.get('/api/cache/agents', (req, res) => {
    if (!serverCache.agents) {
        return res.json({ status: false, error: 'Cache hali tayyor emas' });
    }

    res.json({
        status: true,
        result: { agent: serverCache.agents },
        total: serverCache.agents.length,
        lastUpdate: serverCache.lastUpdate
    });
});

// Agent bo'yicha qarzdorlik (srok bilan) - WEB PANELDAN HAQIQIY SROK
app.get('/api/cache/agentDebts', (req, res) => {
    if (!serverCache.balances) {
        return res.json({ status: false, error: 'Cache hali tayyor emas' });
    }

    const currency = req.query.currency || 'all'; // all, som, dollar
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Transactions dan srok mapping yaratish (clientId -> srok data)
    const clientSrokMap = {};
    const clientAgentFromTxn = {}; // clientId -> agentName (from transactions)
    if (serverCache.transactions && Array.isArray(serverCache.transactions)) {
        serverCache.transactions.forEach(txn => {
            if (txn.clientId) {
                clientSrokMap[txn.clientId] = {
                    srokDate: txn.srokDate || '',
                    overdueDays: txn.overdueDays || 0,
                    isOverdue: txn.isOverdue || false,
                    daysLeft: 0
                };
                // daysLeft hisoblash
                if (txn.srokDate && !txn.isOverdue) {
                    const expDate = new Date(txn.srokDate);
                    expDate.setHours(0, 0, 0, 0);
                    const diff = Math.floor((expDate - today) / (1000 * 60 * 60 * 24));
                    clientSrokMap[txn.clientId].daysLeft = Math.max(0, diff);
                }
                if (txn.agentName) {
                    clientAgentFromTxn[txn.clientId] = txn.agentName;
                }
            }
        });
        console.log(`📊 agentDebts: ${Object.keys(clientSrokMap).length} ta mijozda srok bor (web panel)`);
    }

    // Orders dan ham client->agent mapping
    const clientToAgent = {};
    if (serverCache.orders) {
        serverCache.orders.forEach(order => {
            const clientId = order.client?.SD_id;
            const agentId = order.agent?.SD_id;
            if (clientId && agentId) {
                clientToAgent[clientId] = agentId;
            }
        });
    }

    // Agent nomlari
    const agentNameMap = {};
    (serverCache.agents || []).forEach(a => {
        agentNameMap[a.SD_id] = a.name;
    });
    const hardcodedNames = {
        'd0_2': 'Nilufarxon', 'd0_3': 'Muxtorxon aka Onlem', 'd0_4': 'Ofis',
        'd0_6': 'Usmonqulov Asadulloh', 'd0_7': 'Axmedova Xalimaxon',
        'd0_8': 'Abduraxmonov Shuxrat', 'd0_9': 'Abdullayev Abdulhafiz',
        'd0_10': 'Abduraximova Muxayyoxon', 'd0_11': 'Aliakbar Yusupov',
        'd0_12': 'Abdulazizxon Aligarh', 'd0_13': 'Bahodirjon',
        'd0_14': 'Lobarxon', 'd0_19': 'Soliev Ibrohimjon',
        'd0_20': 'Oybek', 'd0_21': 'Maxmudov Abdulazizxon',
        'd0_22': 'Tojiboyev Abubakir', 'd0_23': 'Nodirxon Dokon',
        'd0_24': 'Xolmirzayeva Honzodaxon', 'd0_25': 'Xolmuxamedova Ziroatxon',
        'd0_26': 'Ubaydullo', 'd0_27': 'Muxtorxon aka Sleppy',
        'd0_28': 'Matkarimov Bexruz'
    };

    // Agent name -> agentId reverse mapping (transactions data agentName beradi)
    const agentNameToId = {};
    Object.keys(agentNameMap).forEach(id => { agentNameToId[agentNameMap[id]] = id; });
    Object.keys(hardcodedNames).forEach(id => { agentNameToId[hardcodedNames[id]] = id; });

    // 2. Agentlar bo'yicha guruhlab hisoblash
    const agentDebts = {};

    serverCache.balances.forEach(b => {
        const byCurrency = b['by-currency'] || [];
        let naqdDebt = 0;
        let beznalDebt = 0;
        let dollarDebt = 0;

        byCurrency.forEach(c => {
            const amount = parseFloat(c.amount) || 0;
            if (c.currency_id === 'd0_2') naqdDebt = amount;       // Naqd so'm
            else if (c.currency_id === 'd0_3') beznalDebt = amount; // Beznal so'm
            else if (c.currency_id === 'd0_4') dollarDebt = amount; // Dollar
        });

        // So'm = Naqd + Beznal (Sales Doctor bilan bir xil)
        const somDebt = naqdDebt + beznalDebt;

        // Currency filtr
        let shouldInclude = false;
        if (currency === 'som' && somDebt < 0) shouldInclude = true;
        else if (currency === 'dollar' && dollarDebt < 0) shouldInclude = true;
        else if (currency === 'all' && (somDebt < 0 || dollarDebt < 0)) shouldInclude = true;

        if (!shouldInclude) return;

        const clientId = b.SD_id;

        // Agent aniqlash: 1) orders dan, 2) transactions dan agentName orqali
        let agentId = clientToAgent[clientId] || 'unknown';
        if (agentId === 'unknown' && clientAgentFromTxn[clientId]) {
            // Transactions dan agentName orqali agentId topish
            const txnAgentName = clientAgentFromTxn[clientId];
            if (agentNameToId[txnAgentName]) {
                agentId = agentNameToId[txnAgentName];
            }
        }
        const agentName = agentNameMap[agentId] || hardcodedNames[agentId] ||
            clientAgentFromTxn[clientId] || `Agent ${agentId}`;

        if (!agentDebts[agentId]) {
            agentDebts[agentId] = {
                name: agentName, id: agentId,
                totalSom: 0, totalDollar: 0, clientCount: 0, clients: []
            };
        }

        // SROK - web panel dan haqiqiy ma'lumot
        const srokData = clientSrokMap[clientId] || {};
        const srokDate = srokData.srokDate || '';
        const overdueDays = srokData.overdueDays || 0;
        const daysLeft = srokData.daysLeft || 0;
        const isOverdue = srokData.isOverdue || false;

        agentDebts[agentId].totalSom += somDebt;
        agentDebts[agentId].totalDollar += dollarDebt;
        agentDebts[agentId].clientCount++;
        agentDebts[agentId].clients.push({
            clientId, name: b.name || 'Noma\'lum',
            somDebt, dollarDebt,
            srokDate, overdueDays, daysLeft, isOverdue
        });
    });

    // Tartiblash
    let sortedAgents;
    if (currency === 'som') {
        sortedAgents = Object.values(agentDebts).sort((a, b) => a.totalSom - b.totalSom);
    } else {
        sortedAgents = Object.values(agentDebts).sort((a, b) => a.totalDollar - b.totalDollar);
    }

    res.json({
        status: true,
        result: { agents: sortedAgents },
        totalSom: sortedAgents.reduce((s, a) => s + a.totalSom, 0),
        totalDollar: sortedAgents.reduce((s, a) => s + a.totalDollar, 0),
        lastUpdate: serverCache.lastUpdate
    });
});

// Srok (muddatli qarz) ma'lumotlari - CACHE dan hisoblash
app.post('/api/balanceWithSrok', (req, res) => {
    const { agentId } = req.body;

    if (!serverCache.orders || !serverCache.balances) {
        return res.json({ status: false, error: 'Cache hali tayyor emas' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Mijoz -> Agent mapping (buyurtmalardan)
    const clientToAgent = {};
    const clientLastDebtDate = {}; // Mijozning eng oxirgi debtDateExp

    serverCache.orders.forEach(order => {
        const clientId = order.client?.SD_id;
        const orderAgentId = order.agent?.SD_id;
        const debtDateExp = order.debtDateExp;

        if (clientId && orderAgentId) {
            clientToAgent[clientId] = orderAgentId;
        }

        // Eng oxirgi debtDateExp ni saqlash
        if (clientId && debtDateExp) {
            if (!clientLastDebtDate[clientId] || debtDateExp > clientLastDebtDate[clientId]) {
                clientLastDebtDate[clientId] = debtDateExp;
            }
        }
    });

    // 2. Balanslardan faqat shu agent mijozlarini olish
    const clients = [];

    serverCache.balances.forEach(b => {
        const clientId = b.SD_id;
        const clientAgent = clientToAgent[clientId];

        // Agent filtri
        if (agentId) {
            if (agentId === 'unknown') {
                // 'unknown' = agenti aniqlanmagan mijozlar
                if (clientAgent) return; // Agenti bor mijozlarni o'tkazib yuborish
            } else {
                if (clientAgent !== agentId) return;
            }
        }

        // Faqat qarzdorlar (manfiy balans)
        const balance = parseFloat(b.balance) || 0;
        if (balance >= 0) return;

        // Valyuta bo'yicha ajratish
        let balanceCash = 0;
        let balanceDollar = 0;
        (b['by-currency'] || []).forEach(c => {
            const amount = parseFloat(c.amount) || 0;
            if (c.currency_id === 'd0_4') {
                balanceDollar = amount;
            } else {
                balanceCash += amount;
            }
        });

        // Srok hisoblash
        const debtDate = clientLastDebtDate[clientId];
        let srokDate = '';
        let overdueDays = 0;
        let daysLeft = 0;
        let isOverdue = false;

        if (debtDate) {
            srokDate = debtDate;
            const expDate = new Date(debtDate);
            expDate.setHours(0, 0, 0, 0);
            const diffDays = Math.floor((today - expDate) / (1000 * 60 * 60 * 24));

            if (diffDays > 0) {
                isOverdue = true;
                overdueDays = diffDays;
            } else {
                daysLeft = Math.abs(diffDays);
            }
        }

        clients.push({
            clientId,
            name: b.name || 'Noma\'lum',
            balanceTotal: balanceCash,
            balanceCash,
            balanceDollar,
            srokDate,
            overdueDays,
            daysLeft,
            isOverdue
        });
    });

    // Dollar bo'yicha tartiblash (eng katta qarz birinchi)
    clients.sort((a, b) => a.balanceDollar - b.balanceDollar);

    res.json({
        status: true,
        result: { clients },
        total: clients.length,
        lastUpdate: serverCache.lastUpdate
    });
});

// Cache ni majburan yangilash
app.post('/api/cache/refresh', async (req, res) => {
    console.log('🔄 Manual cache refresh so\'ralmoqda...');
    refreshCache(); // async lekin kutmaymiz
    res.json({ status: true, message: 'Cache yangilanmoqda' });
});

// API Proxy endpoint
app.post('/api/proxy', async (req, res) => {
    try {
        const { serverUrl, body } = req.body;

        if (!serverUrl) {
            return res.status(400).json({ error: 'Server URL kiritilmagan' });
        }

        // Server URL ni formatlash
        const server = serverUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
        const apiUrl = `https://${server}/api/v2/`;

        console.log(`📡 API so'rov: ${apiUrl}`);
        console.log(`📦 Method: ${body?.method}`);

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (data.status) {
            console.log(`✅ Javob: Muvaffaqiyatli`);
            if (data.result) {
                console.log(`📊 Result:`, Array.isArray(data.result) ? `${data.result.length} ta element` : typeof data.result);
            }
        } else {
            console.log(`❌ Xato:`, data.error || JSON.stringify(data));
        }

        res.json(data);
    } catch (error) {
        console.error('❌ Proxy xatosi:', error.message);
        res.status(500).json({
            status: false,
            error: error.message
        });
    }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
    try {
        const { serverUrl, login, password } = req.body;

        const server = serverUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
        const apiUrl = `https://${server}/api/v2/`;

        console.log(`🔐 Login so'rov: ${apiUrl}`);

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                method: 'login',
                auth: { login, password }
            })
        });

        const data = await response.json();

        if (data.status && data.result) {
            console.log(`✅ Login muvaffaqiyatli: userId=${data.result.userId}`);
        } else {
            console.log(`❌ Login xatosi:`, data.error);
        }

        res.json(data);
    } catch (error) {
        console.error('❌ Login xatosi:', error.message);
        res.status(500).json({
            status: false,
            error: error.message
        });
    }
});

// PivotPnL endpoint - mahsulot bo'yicha foyda ma'lumotlari
app.post('/api/pivotPnl', async (req, res) => {
    try {
        const { serverUrl, auth, dateStart, dateEnd } = req.body;

        const server = serverUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

        // Cookie yaratish (session uchun)
        const cookies = `SD_account=${auth.userId}; SD_token=${auth.token}`;

        // Avval sana o'rnatish
        const setDateUrl = `https://${server}/finans/pivotPnl?type=product`;
        await fetch(setDateUrl, {
            method: 'GET',
            headers: {
                'Cookie': cookies,
                'Accept': 'application/json'
            }
        });

        // Keyin ma'lumotlarni olish
        const apiUrl = `https://${server}/finans/pivotPnl/loadByProduct?v=null`;

        console.log(`📊 PivotPnL so'rov: ${apiUrl}`);

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Cookie': cookies,
                'Accept': 'application/json'
            }
        });

        const data = await response.json();

        console.log(`✅ PivotPnL: ${Array.isArray(data) ? data.length : 0} ta mahsulot`);

        res.json({ status: true, result: data });
    } catch (error) {
        console.error('❌ PivotPnL xatosi:', error.message);
        res.status(500).json({
            status: false,
            error: error.message
        });
    }
});

// Balance with Srok (muddat) endpoint - API orqali to'g'ri hisoblash
// Mantiq: Har bir mijoz uchun to'lanmagan buyurtmalarning eng eski srogini topish
app.post('/api/balanceWithSrok', async (req, res) => {
    try {
        const { serverUrl, auth, agentId } = req.body;

        // Parametrlarni tekshirish
        if (!serverUrl || !auth?.userId || !auth?.token) {
            console.log('❌ Balance with Srok: serverUrl yoki auth yo\'q');
            return res.status(400).json({
                status: false,
                error: 'serverUrl va auth kerak'
            });
        }

        const server = serverUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
        const apiUrl = `https://${server}/api/v2/`;

        // API so'rov funksiyasi
        async function apiRequest(method, params = {}) {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    auth: auth,
                    method: method,
                    params: params
                })
            });
            return response.json();
        }

        console.log(`📅 Balance with Srok: Agent ${agentId || 'hammasi'}`);

        // 1. Qarzdor mijozlarni olish (balance < 0)
        const balanceData = await apiRequest('getBalance', { page: 1, limit: 5000 });
        if (!balanceData.status || !balanceData.result?.balance) {
            console.log('❌ getBalance xatosi:', balanceData.error);
            return res.json({ status: false, error: 'getBalance xatosi' });
        }

        // Faqat qarzdor mijozlar (balance < 0)
        const debtors = balanceData.result.balance.filter(c => c.balance < 0);
        console.log(`📊 Jami ${debtors.length} ta qarzdor mijoz`);

        // 2. Barcha buyurtmalarni olish (status != 0, ya'ni bekor qilinmaganlar)
        let allOrders = [];
        let page = 1;
        let hasMore = true;

        while (hasMore && page <= 10) {
            const orderParams = {
                page: page,
                limit: 1000,
                filter: { status: 'all' }
            };
            if (agentId) orderParams.filter.agent = { SD_id: agentId };

            const orderData = await apiRequest('getOrder', orderParams);
            if (orderData.result?.order && orderData.result.order.length > 0) {
                allOrders = allOrders.concat(orderData.result.order);
                hasMore = orderData.result.order.length === 1000;
                page++;
            } else {
                hasMore = false;
            }
        }
        console.log(`📦 Jami ${allOrders.length} ta buyurtma`);

        // 3. Barcha to'lovlarni olish
        let allPayments = [];
        page = 1;
        hasMore = true;

        while (hasMore && page <= 10) {
            const paymentData = await apiRequest('getPayment', { page: page, limit: 1000 });
            if (paymentData.result?.payment && paymentData.result.payment.length > 0) {
                allPayments = allPayments.concat(paymentData.result.payment);
                hasMore = paymentData.result.payment.length === 1000;
                page++;
            } else {
                hasMore = false;
            }
        }
        console.log(`💰 Jami ${allPayments.length} ta to'lov`);

        // 4. Har bir buyurtma uchun to'langan summani hisoblash
        const orderPaidAmounts = {}; // orderId -> to'langan summa
        allPayments.forEach(payment => {
            if (payment.orders && Array.isArray(payment.orders)) {
                payment.orders.forEach(order => {
                    const orderId = order.SD_id;
                    const amount = parseFloat(order.amount) || 0;
                    orderPaidAmounts[orderId] = (orderPaidAmounts[orderId] || 0) + amount;
                });
            }
        });

        // 5. Mijoz bo'yicha to'lanmagan buyurtmalarni topish va eng eski srokni aniqlash
        const clientSrok = {}; // clientId -> { srokDate, overdueDays, isOverdue, orders }

        allOrders.forEach(order => {
            if (!order.client?.SD_id || !order.debtDateExp) return;

            // 1970-01-01 va unga yaqin sanalarni o'tkazib yuborish (bo'sh sana)
            const srokDate = order.debtDateExp;
            if (srokDate.startsWith('1970') || srokDate.startsWith('1969')) return;

            const clientId = order.client.SD_id;
            const orderId = order.SD_id;
            const totalSumma = parseFloat(order.totalSumma) || 0;
            const paidAmount = orderPaidAmounts[orderId] || 0;
            const remainingDebt = totalSumma - paidAmount;

            // Agar bu buyurtmada hali qarz qolgan bo'lsa
            if (remainingDebt > 0) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const srok = new Date(srokDate);
                const diffDays = Math.ceil((srok - today) / (1000 * 60 * 60 * 24));
                const isOverdue = diffDays < 0;

                if (!clientSrok[clientId]) {
                    clientSrok[clientId] = {
                        srokDate: srokDate,
                        overdueDays: isOverdue ? Math.abs(diffDays) : 0,
                        daysLeft: isOverdue ? 0 : diffDays,
                        isOverdue: isOverdue,
                        unpaidOrders: 1,
                        totalUnpaidDebt: remainingDebt
                    };
                } else {
                    // Eng eski (birinchi) srokni saqlash
                    const existingSrok = new Date(clientSrok[clientId].srokDate);
                    if (srok < existingSrok) {
                        clientSrok[clientId].srokDate = srokDate;
                        clientSrok[clientId].overdueDays = isOverdue ? Math.abs(diffDays) : 0;
                        clientSrok[clientId].daysLeft = isOverdue ? 0 : diffDays;
                        clientSrok[clientId].isOverdue = isOverdue;
                    }
                    clientSrok[clientId].unpaidOrders++;
                    clientSrok[clientId].totalUnpaidDebt += remainingDebt;
                }
            }
        });

        // 6. Natijani shakllantirish
        const clients = debtors.map(debtor => {
            const srokInfo = clientSrok[debtor.SD_id] || {};

            // Agentni aniqlash (buyurtmalardan)
            const clientOrders = allOrders.filter(o => o.client?.SD_id === debtor.SD_id);
            const agentName = clientOrders[0]?.agent?.SD_id || '';

            return {
                CS_id: debtor.CS_id,
                SD_id: debtor.SD_id,
                name: debtor.name,
                balanceTotal: Math.abs(debtor.balance),
                // Dollar va so'm alohida (by-currency dan)
                balanceCash: (debtor['by-currency'] || [])
                    .filter(c => c.currency_id === 'd0_2')
                    .reduce((sum, c) => sum + Math.abs(c.amount || 0), 0),
                balanceDollar: (debtor['by-currency'] || [])
                    .filter(c => c.currency_id === 'd0_4')
                    .reduce((sum, c) => sum + Math.abs(c.amount || 0), 0),
                srokDate: srokInfo.srokDate || '',
                overdueDays: srokInfo.overdueDays || 0,
                daysLeft: srokInfo.daysLeft || 0,
                isOverdue: srokInfo.isOverdue || false,
                unpaidOrders: srokInfo.unpaidOrders || 0,
                agentId: agentName
            };
        });

        // Agent bo'yicha filtrlash (agar kerak bo'lsa)
        let filteredClients = clients;
        if (agentId) {
            const agentOrders = allOrders.filter(o => o.agent?.SD_id === agentId);
            const agentClientIds = new Set(agentOrders.map(o => o.client?.SD_id));
            filteredClients = clients.filter(c => agentClientIds.has(c.SD_id));
        }

        console.log(`✅ Balance with Srok: ${filteredClients.length} ta mijoz (srok bilan)`);

        res.json({
            status: true,
            result: {
                clients: filteredClients,
                stats: {
                    totalDebtors: debtors.length,
                    totalOrders: allOrders.length,
                    totalPayments: allPayments.length
                }
            }
        });
    } catch (error) {
        console.error('❌ Balance with Srok xatosi:', error.message);
        res.status(500).json({
            status: false,
            error: error.message
        });
    }
});

// Bosh sahifa
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serverni ishga tushirish
app.listen(PORT, () => {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║     🏥 Sales Doctor Analytics Dashboard                ║');
    console.log('║     🚀 CACHING SERVER v2.0                             ║');
    console.log('╠════════════════════════════════════════════════════════╣');
    console.log(`║  🌐 Server: http://localhost:${PORT}                      ║`);
    console.log('║  📊 Dashboard tayyor!                                  ║');
    console.log('║  ⚡ Cache: Har 10 daqiqada avtomatik yangilanadi       ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('');

    // Server boshlanishida cache ni yuklash
    console.log('🚀 Birinchi cache yuklanmoqda...');
    refreshCache();

    // Har 10 daqiqada avtomatik yangilash
    setInterval(() => {
        console.log('⏰ Avtomatik cache yangilash...');
        refreshCache();
    }, CACHE_CONFIG.REFRESH_INTERVAL);
});
