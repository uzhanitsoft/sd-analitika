/**
 * Sales Doctor Analytics - Caching Proxy Server
 * рџљЂ Tez yuklash uchun server-side cache
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
app.use(express.static(path.join(__dirname, 'deploy'))); // deploy/ papkasidan serve qilish (app.js v66)

// =============================================================================
// рџљЂ SERVER-SIDE CACHE SYSTEM
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
    shipperDebts: null,     // Pastavshiklar qarzdorligi (oborot po pastavshikam)
    stats: null,            // Hisoblangan statistika
    lastUpdate: null,       // Oxirgi yangilanish
    isLoading: false,       // Yuklanish holati
    error: null             // Xato
};

// рџ”ђ Login funksiyasi - yangi token olish
async function refreshToken() {
    const { serverUrl, login, password } = CACHE_CONFIG.API_CREDENTIALS;
    const apiUrl = `https://${serverUrl}/api/v2/`;

    console.log('рџ”ђ Login qilinyapti...');

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
            console.log(`вњ… Login muvaffaqiyatli! userId: ${data.result.userId}`);
            return true;
        } else {
            console.error('вќЊ Login xatosi:', data.error);
            return false;
        }
    } catch (error) {
        console.error('вќЊ Login network xatosi:', error.message);
        return false;
    }
}

// рџЊђ Web panel login - session cookie olish (srok uchun)
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

        console.log('вњ… Web panel login muvaffaqiyatli!');
        return true;
    } catch (error) {
        console.error('вќЊ Web login xatosi:', error.message);
        return false;
    }
}

// рџ“Љ Web paneldan transactions + SROK ma'lumotlarini olish
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
            console.error('вќЊ JsonData ma\'lumot formati noto\'g\'ri');
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

        console.log(`   вњ… ${clients.length} ta mijoz (srok bilan)`);
        return clients;
    } catch (error) {
        console.error('вќЊ Transactions fetch xatosi:', error.message);
        return null;
    }
}

// рџ“Љ Web paneldan barcha narxlarni olish (catalog prices)
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

        // Transform data вЂ” priceTypes jadvalidagi birinchi qator = sarlavhalar
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

        // Transform prices вЂ” product -> priceType -> price
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
        console.error('вќЊ Catalog prices fetch xatosi:', error.message);
        return null;
    }
}

// 🏭 Web paneldan pastavshiklar qarzdorligini olish (UZS va USD alohida)
async function fetchShipperDebts() {
    try {
        const { serverUrl } = CACHE_CONFIG.API_CREDENTIALS;
        const webBase = `https://${serverUrl}`;
        const cs = Object.keys(webSessionCookies).map(k => k + '=' + webSessionCookies[k]).join('; ');
        const headers = {
            'Cookie': cs,
            'User-Agent': 'Mozilla/5.0',
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'application/json, */*',
            'Referer': webBase + '/clients/shipperFinans/report'
        };

        // Session ochish
        await fetch(webBase + '/clients/shipperFinans/report', { headers: { 'Cookie': cs, 'User-Agent': 'Mozilla/5.0' } });

        // Helper: ma'lum currency filter bilan ma'lumot olish
        const fetchWithCurrency = async (currencyParams, label) => {
            const url = `${webBase}/clients/shipperFinans/AjaxReport?${currencyParams}`;
            const res = await fetch(url, { headers });
            const body = await res.text();
            let json;
            try { json = JSON.parse(body); } catch(e) {
                console.error(`   ShipperDebts ${label} parse xatosi:`, body.substring(0, 100));
                return [];
            }
            return json.data || [];
        };

        // UZS: Nalichniy (d0_2) + Beznalichniy (d0_3) so'm
        const somData = await fetchWithCurrency('currency%5B%5D=d0_2&currency%5B%5D=d0_3', 'SOM');
        // USD: Dollar USA (d0_4)
        const usdData = await fetchWithCurrency('currency%5B%5D=d0_4', 'USD');

        const parseNum = (val) => (val && val !== 0) ? parseFloat(String(val)) || 0 : 0;

        // Som ma'lumotlarini map ga olish (name -> row) - ID bo'yicha birlashtirish uchun
        const somMap = {};
        somData.forEach(row => {
            const id = String(row[5] || '');
            const name = String(row[0] || '').trim();
            if (name) somMap[id] = { id, name, som: { balanceStart: parseNum(row[1]), weOwe: parseNum(row[2]), theyClosed: parseNum(row[3]), balanceEnd: parseNum(row[4]) } };
        });

        // USD ma'lumotlarini map ga olish
        const usdMap = {};
        usdData.forEach(row => {
            const id = String(row[5] || '');
            const name = String(row[0] || '').trim();
            if (name) usdMap[id] = { id, name, usd: { balanceStart: parseNum(row[1]), weOwe: parseNum(row[2]), theyClosed: parseNum(row[3]), balanceEnd: parseNum(row[4]) } };
        });

        // Barcha pastavshiklarni birlashtirish
        const allIds = new Set([...Object.keys(somMap), ...Object.keys(usdMap)]);
        const shippers = Array.from(allIds).map(id => {
            const som = somMap[id]?.som || { balanceStart: 0, weOwe: 0, theyClosed: 0, balanceEnd: 0 };
            const usd = usdMap[id]?.usd || { balanceStart: 0, weOwe: 0, theyClosed: 0, balanceEnd: 0 };
            const name = somMap[id]?.name || usdMap[id]?.name || 'Noma\'lum';
            return { id, name, som, usd };
        }).filter(s => s.name && s.name !== 'Noma\'lum');

        console.log(`   ${shippers.length} ta pastavshik (UZS: ${somData.length}, USD: ${usdData.length})`);
        return shippers;
    } catch (error) {
        console.error('   ShipperDebts fetch xatosi:', error.message);
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

        // Token expired вЂ” auto re-login
        if (data.status === false && !retried) {
            const errMsg = (typeof data.error === 'string' ? data.error : JSON.stringify(data.error || '')).toLowerCase();
            if (errMsg.includes('token') || errMsg.includes('auth') || errMsg.includes('unauthorized') || errMsg.includes('user not found')) {
                console.log(`   рџ”„ Token expired, qayta login...`);
                const loginOk = await refreshToken();
                if (loginOk) {
                    return apiRequest(method, params, true); // retry
                }
            }
        }

        // Xato tekshirish
        if (data.status === false) {
            console.error(`   вљ пёЏ API ${method} xatosi:`, data.error);
        }

        return data;
    } catch (error) {
        console.error(`   вќЊ API ${method} network xatosi:`, error.message);
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
            console.error(`вќЊ ${method} sahifa ${page} xatosi:`, e.message);
            hasMore = false;
        }
    }

    return allItems;
}

// To'lovlarni alohida olish вЂ” SD API pagination muammosi uchun
async function fetchAllPayments() {
    let allPayments = [];
    let page = 1;
    const maxPages = 50;
    const limit = 1000;

    while (page <= maxPages) {
        try {
            const data = await apiRequest('getPayment', { page, limit });
            const items = data?.result?.payment || [];

            console.log(`   рџ“„ getPayment sahifa ${page}: ${items.length} ta`);

            if (items.length === 0) break;

            allPayments = allPayments.concat(items);
            page++;
        } catch (e) {
            console.error(`вќЊ getPayment sahifa ${page} xatosi:`, e.message);
            break;
        }
    }

    return allPayments;
}

// Timeout yordamchi
function withTimeout(promise, ms, name) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(name + ': ' + (ms/1000) + 's timeout')), ms))
    ]);
}

// Cache yangilash - 2 BOSQICHLI
// BOSQICH 1: Asosiy data -> stats darhol set (F5 ishlaydi)
// BOSQICH 2: Qoshimcha data -> background (dashboard ga tasir qilmaydi)
async function refreshCache() {
    if (serverCache.isLoading) { console.log('Cache yangilanmoqda...'); return; }
    serverCache.isLoading = true;
    serverCache.error = null;
    const t0 = Date.now();
    console.log('\n=== CACHE YANGILANMOQDA (2-bosqich) ===');

    const loginOk = await refreshToken();
    if (!loginOk) { serverCache.isLoading = false; serverCache.error = 'Login xatosi'; return; }

    // Safe wrapper: xato bolsa null qaytaradi
    const safe = async (name, fn, ms = 120000) => {
        try { return await withTimeout(fn(), ms, name); }
        catch(e) { console.log('   WARN ' + name + ': ' + e.message); return null; }
    };

    // === BOSQICH 1: Asosiy ===
    console.log('\n[1] Asosiy malumotlar...');

    const r1 = await safe('getOrder', () => fetchAllPaginated('getOrder', 'order', 500, 100));
    if (r1 !== null) serverCache.orders = r1;
    console.log('   Buyurtmalar: ' + (serverCache.orders && serverCache.orders.length || 0));

    const r2 = await safe('getProduct', () => fetchAllPaginated('getProduct', 'product', 500), 60000);
    if (r2 !== null) serverCache.products = r2;
    console.log('   Mahsulotlar: ' + (serverCache.products && serverCache.products.length || 0));

    const r3 = await safe('getClient', () => fetchAllPaginated('getClient', 'client', 500), 60000);
    if (r3 !== null) serverCache.clients = r3;
    console.log('   Mijozlar: ' + (serverCache.clients && serverCache.clients.length || 0));

    const r4 = await safe('getBalance', () => fetchAllPaginated('getBalance', 'balance', 1000), 60000);
    if (r4 !== null) serverCache.balances = r4;
    console.log('   Qarzlar: ' + (serverCache.balances && serverCache.balances.length || 0));

    const r5 = await safe('getPayment', () => fetchAllPayments(), 90000);
    if (r5 !== null) serverCache.payments = r5;
    console.log('   Tolovlar: ' + (serverCache.payments && serverCache.payments.length || 0));

    const r6 = await safe('getPurchase', () => fetchAllPaginated('getPurchase', 'warehouse', 500, 50), 60000);
    if (r6 !== null) serverCache.purchases = r6;
    console.log('   Prixodlar: ' + (serverCache.purchases && serverCache.purchases.length || 0));

    const r7 = await safe('getStock', () => apiRequest('getStock', { limit: 10000 }), 60000);
    if (r7) {
        // getStock API: result.warehouse[i].products[] - barcha warehouselardan mahsulotlarni yig'ish
        const stockMap = {};
        const warehouses = r7.result?.warehouse || [];
        warehouses.forEach(wh => {
            (wh.products || []).forEach(p => {
                const id = p.SD_id;
                if (!stockMap[id]) stockMap[id] = 0;
                stockMap[id] += parseFloat(p.quantity) || 0;
            });
        });
        serverCache.stock = stockMap; // ID -> quantity object sifatida saqlash
    }
    console.log('   Stock: ' + Object.keys(serverCache.stock || {}).length + ' ta mahsulot');

    const r8 = await safe('getPriceType', () => apiRequest('getPriceType', {}), 30000);
    if (r8) serverCache.priceTypes = (r8.result && r8.result.priceType) || [];

    const r9 = await safe('getAgent', () => apiRequest('getAgent', { page: 1, limit: 100 }), 30000);
    if (r9) serverCache.agents = (r9.result && r9.result.agent) || [];
    console.log('   Agentlar: ' + (serverCache.agents && serverCache.agents.length || 0));

    // BOSQICH 1 tugadi - stats va lastUpdate set qilish
    try { serverCache.stats = calculateStats(); } catch(e) { console.log('WARN stats: ' + e.message); }
    serverCache.lastUpdate = new Date();
    serverCache.isLoading = false;
    console.log('\n[1] BOSQICH 1 TUGADI (' + ((Date.now()-t0)/1000).toFixed(1) + 's) - Dashboard TAYYOR!\n');

    // === BOSQICH 2: Qoshimcha (background) ===
    // isLoading = false - dashboard endi ishlaydi, bu yerda xato bolsa ham ok
    console.log('[2] Qoshimcha malumotlar (background)...');

    const rC = await safe('getConsumption', () => fetchAllPaginated('getConsumption', 'consumption', 500, 20), 90000);
    if (rC !== null) { serverCache.consumption = rC; console.log('   Rasxodlar: ' + rC.length); }

    try {
        const webOk = await withTimeout(webLogin(), 25000, 'webLogin');
        if (webOk) {
            try {
                const trans = await withTimeout(fetchTransactionsData(), 90000, 'fetchTransactions');
                serverCache.transactions = trans;
                console.log('   Tranzaksiyalar: ' + ((trans && trans.length) || 0));
            } catch(e) { console.log('   WARN Tranzaksiyalar: ' + e.message); }

            try {
                const cats = await withTimeout(fetchCatalogPrices(), 60000, 'catalogPrices');
                serverCache.catalogPrices = cats;
                console.log('   Narxlar: ' + Object.keys((cats && cats.productPrices) || {}).length);
            } catch(e) { console.log('   WARN Catalog: ' + e.message); }

            try {
                const shipperDebt = await withTimeout(fetchShipperDebts(), 60000, 'shipperDebts');
                serverCache.shipperDebts = shipperDebt;
                console.log('   Pastavshiklar: ' + ((shipperDebt && shipperDebt.length) || 0));
            } catch(e) { console.log('   WARN ShipperDebts: ' + e.message); }
        } else {
            console.log('   WARN: Web login muvaffaqiyatsiz');
        }
    } catch(e) { console.log('   WARN Web panel: ' + e.message); }

    // Yakuniy stats yangilash
    try { serverCache.stats = calculateStats(); serverCache.lastUpdate = new Date(); } catch(e) {}
    const tot = ((Date.now() - t0) / 1000).toFixed(1);
    console.log('\n=== KESH TOLIQ YANGILANDI (' + tot + 's) ===\n');
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
        let activeOrderCount = 0;

        filteredOrders.forEach(order => {
            // Qaytarishlarni o'tkazib yuborish (status 4=vozvrat, 5=otmen)
            const orderStatusNum = parseInt(order.status) || 0;
            if (orderStatusNum === 4 || orderStatusNum === 5) return;
            const returnsSumma = parseFloat(order.totalReturnsSumma) || 0;
            const totalSumma = parseFloat(order.totalSumma) || 0;
            if (returnsSumma > 0 && returnsSumma === totalSumma) return;

            const sum = totalSumma || parseFloat(order.totalSummaAfterDiscount) || 0;
            const paymentTypeId = order.paymentType?.SD_id;
            const priceTypeId = order.priceType?.SD_id;

            // Aktiv mijozlar
            if (order.client?.SD_id) activeClients.add(order.client.SD_id);
            activeOrderCount++;

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
            'd0_2', 'd0_5', 'd0_6', 'd0_7', 'd0_8', 'd0_10', 'd0_11',
            'd0_19', 'd0_20', 'd0_22', 'd0_24', 'd0_25', 'd0_28',
            'd0_29', 'd0_30', 'd0_34'
        ]);
        let irodaSalesUZS = 0;
        let irodaSalesUSD = 0;
        let irodaOrders = 0;

        filteredOrders.forEach(order => {
            const agentId = order.agent?.SD_id;
            if (agentId && irodaAgentIds.has(agentId)) {
                const orderStatus = parseInt(order.status) || 0;
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

        // Ostatka qiymatini hisoblash вЂ” tarixiy (period endDate bo'yicha)
        const stockValueUSD = calculateStockValueAtDate(dateRange.endDate);

        stats[period] = {
            totalSalesUZS,
            totalSalesUSD,
            totalOrders: activeOrderCount,
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

// Custom sana oraligi uchun statistikani hisoblash
// calculateStats() bilan bir xil mantiq, lekin bitta period uchun
function calculateStatsForOrders(filteredOrders, endDate) {
    const USD_RATE = 12200;
    const products = serverCache.products || [];
    const clients = serverCache.clients || [];
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

    let totalSalesUZS = 0;
    let totalSalesUSD = 0;
    let totalProfitUZS = 0;
    let totalProfitUSD = 0;
    const activeClients = new Set();
    let activeOrderCount = 0;

    filteredOrders.forEach(order => {
        const orderStatusNum = parseInt(order.status) || 0;
        if (orderStatusNum === 4 || orderStatusNum === 5) return;
        const returnsSumma = parseFloat(order.totalReturnsSumma) || 0;
        const totalSumma = parseFloat(order.totalSumma) || 0;
        if (returnsSumma > 0 && returnsSumma === totalSumma) return;

        const sum = totalSumma || parseFloat(order.totalSummaAfterDiscount) || 0;
        const paymentTypeId = order.paymentType?.SD_id;
        const priceTypeId = order.priceType?.SD_id;

        if (order.client?.SD_id) activeClients.add(order.client.SD_id);
        activeOrderCount++;

        const isUsdOrder = paymentTypeId === 'd0_4' || dollarPriceTypes.has(priceTypeId);

        if (isUsdOrder) {
            totalSalesUSD += sum;
        } else {
            totalSalesUZS += sum;
        }

        // Foyda hisoblash
        (order.orderProducts || []).forEach(item => {
            const productId = item.product?.SD_id;
            const quantity = parseFloat(item.quantity) || 0;
            const rawSumma = parseFloat(item.summa) || 0;

            if (isUsdOrder) {
                const costPriceUSD = (costPrices[productId]?.costPriceUZS || 0) / USD_RATE;
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

    // Iroda agentlari
    const irodaAgentIds = new Set([
        'd0_2', 'd0_5', 'd0_6', 'd0_7', 'd0_8', 'd0_10', 'd0_11',
        'd0_19', 'd0_20', 'd0_22', 'd0_24', 'd0_25', 'd0_28',
        'd0_29', 'd0_30', 'd0_34'
    ]);
    let irodaSalesUZS = 0;
    let irodaSalesUSD = 0;
    let irodaOrders = 0;

    filteredOrders.forEach(order => {
        const agentId = order.agent?.SD_id;
        if (agentId && irodaAgentIds.has(agentId)) {
            const orderStatus = parseInt(order.status) || 0;
            const totalSumma = parseFloat(order.totalSumma) || 0;
            const returnsSumma = parseFloat(order.totalReturnsSumma) || 0;
            if (orderStatus === 4 || orderStatus === 5 || (returnsSumma > 0 && returnsSumma === totalSumma) || totalSumma === 0) return;

            const paymentTypeId = order.paymentType?.SD_id;
            if (paymentTypeId === 'd0_4') {
                irodaSalesUSD += totalSumma;
            } else {
                irodaSalesUZS += totalSumma;
            }
            irodaOrders++;
        }
    });

    // Ostatka qiymati вЂ” tarixiy (endDate bo'yicha)
    const stockValueUSD = calculateStockValueAtDate(endDate || formatLocalDate(getNowUzbekistan()));

    return {
        totalSalesUZS,
        totalSalesUSD,
        totalOrders: activeOrderCount,
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
}

// рџ“¦ Tarixiy ostatka qiymati вЂ” berilgan sanadagi ombor qoldig'ini hisoblash
// Formula: Joriy qoldiq + shu sanadan keyin sotilgan tovarlar - shu sanadan keyin kelgan tovarlar
function calculateStockValueAtDate(endDate) {
    const USD_RATE = 12200;
    const products = serverCache.products || [];
    const purchases = serverCache.purchases || [];
    const orders = serverCache.orders || [];

    // Bugungi sana
    const today = formatLocalDate(getNowUzbekistan());

    // Joriy stock map: serverCache.stock OBJECT { productId: qty } shaklida saqlangan
    const stockMap = {};
    const stockData = serverCache.stock || {};
    if (Array.isArray(stockData)) {
        stockData.forEach(wh => (wh.products||[]).forEach(item => {
            stockMap[item.SD_id] = (stockMap[item.SD_id]||0) + (parseFloat(item.quantity)||0);
        }));
    } else {
        Object.entries(stockData).forEach(([id, qty]) => { stockMap[id] = parseFloat(qty)||0; });
    }

    // Agar endDate bugun yoki kelajak bo'lsa вЂ” joriy qoldiqni qaytarish
    if (endDate >= today) {
        // Joriy qoldiq qiymatini hisoblash
        const priceMap = {};
        purchases.forEach(p => {
            (p.detail || []).forEach(item => {
                const price = parseFloat(item.price) || 0;
                if (price > 0) priceMap[item.SD_id] = price;
            });
        });

        let totalUSD = 0;
        products.forEach(product => {
            const productId = product.SD_id;
            const ostatka = stockMap[productId] || 0;
            const rawPrice = priceMap[productId] || 0;
            if (ostatka > 0 && rawPrice > 0) {
                const costPriceUSD = rawPrice < 100 ? rawPrice : rawPrice / USD_RATE;
                totalUSD += costPriceUSD * ostatka;
            }
        });
        return Math.round(totalUSD);
    }

    // O'tgan sanalar uchun вЂ” tarixiy qoldiqni hisoblash
    // 1. endDate dan KEYIN sotilgan tovarlarni qaytaramiz (ular o'sha kuni hali omborda edi)
    orders.forEach(order => {
        const orderDate = (order.dateCreate || order.dateDocument || '').split('T')[0].split(' ')[0];
        if (!orderDate || orderDate <= endDate) return; // endDate da yoki oldin вЂ” o'tkazib yuborish

        // Qaytarishlarni o'tkazib yuborish
        const status = parseInt(order.status) || 0;
        if (status === 4 || status === 5) return;
        const returnsSumma = parseFloat(order.totalReturnsSumma) || 0;
        const totalSumma = parseFloat(order.totalSumma) || 0;
        if (returnsSumma > 0 && returnsSumma === totalSumma) return;

        (order.orderProducts || []).forEach(item => {
            const productId = item.product?.SD_id;
            const qty = parseFloat(item.quantity) || 0;
            if (productId && qty > 0) {
                stockMap[productId] = (stockMap[productId] || 0) + qty; // Qaytarib qo'shamiz
            }
        });
    });

    // 2. endDate dan KEYIN kelgan tovarlarni ayiramiz (ular o'sha kuni hali kelmagan edi)
    purchases.forEach(p => {
        const purchaseDate = (p.date || '').split('T')[0].split(' ')[0];
        if (!purchaseDate || purchaseDate <= endDate) return; // endDate da yoki oldin вЂ” o'tkazib yuborish

        (p.detail || []).forEach(item => {
            const productId = item.SD_id;
            const qty = parseFloat(item.quantity) || 0;
            if (productId && qty > 0) {
                stockMap[productId] = (stockMap[productId] || 0) - qty; // Ayiramiz
            }
        });
    });

    // 3. Qiymatini hisoblash
    const priceMap = {};
    purchases.forEach(p => {
        (p.detail || []).forEach(item => {
            const price = parseFloat(item.price) || 0;
            if (price > 0) priceMap[item.SD_id] = price;
        });
    });

    let totalUSD = 0;
    products.forEach(product => {
        const productId = product.SD_id;
        const ostatka = Math.max(0, stockMap[productId] || 0); // Manfiy bo'lmasligi kerak
        const rawPrice = priceMap[productId] || 0;
        if (ostatka > 0 && rawPrice > 0) {
            const costPriceUSD = rawPrice < 100 ? rawPrice : rawPrice / USD_RATE;
            totalUSD += costPriceUSD * ostatka;
        }
    });

    console.log(`рџ“¦ Tarixiy ostatka (${endDate}): $${Math.round(totalUSD).toLocaleString()} (bugun: ${today})`);
    return Math.round(totalUSD);
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

// Buyurtmalarni sana bo'yicha filtrlash (dateCreate - platforma bilan mos)
function filterOrdersByDate(orders, { startDate, endDate }) {
    return orders.filter(order => {
        const orderDate = (order.dateCreate || order.dateDocument || '').split('T')[0].split(' ')[0];
        return orderDate >= startDate && orderDate <= endDate;
    });
}

// =============================================================================
// рџЊђ CACHE API ENDPOINTS
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
        const stats = calculateStatsForOrders(orders, endDate);

        return res.json({
            status: true,
            result: stats,
            serverRate: 12200,
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

// Iroda agentlari batafsil (modal uchun - server cache'dan)
app.get('/api/cache/iroda-detail/:period', (req, res) => {
    const period = req.params.period || 'today';
    const { startDate, endDate } = req.query;

    if (!serverCache.orders) {
        return res.json({ status: false, error: 'Cache hali tayyor emas' });
    }

    let dateRange;
    if (period === 'custom' && startDate && endDate) {
        dateRange = { startDate, endDate };
    } else {
        dateRange = getDateRange(period);
    }

    const filteredOrders = filterOrdersByDate(serverCache.orders, dateRange);

    const irodaAgentIds = {
        'd0_2': 'Ro\'zmatov Bahodirjon',
        'd0_5': 'Igamberdiyev Amir Olimxon',
        'd0_6': 'Usmonqulov Asadulloh',
        'd0_7': 'Axmedova Xalimaxon',
        'd0_8': 'Sadriddinov Muxibillox',
        'd0_10': 'Abduraximova Muxayyoxon',
        'd0_11': 'Aliakbar Yusupov',
        'd0_19': 'Soliev Ibrohimjon',
        'd0_20': 'Oybek',
        'd0_22': 'Tojiboyev Abubakir',
        'd0_24': 'Mamanazarov Toxirjon',
        'd0_25': 'Xolmuhammedova Ziroatxon',
        'd0_28': 'Matkarimov Bexruz',
        'd0_29': 'Ashurov Ayubxon',
        'd0_30': 'Masodiqov Baxtiyor',
        'd0_34': 'Irodaxon Optom'
    };

    const agentSales = {};
    Object.entries(irodaAgentIds).forEach(([id, name]) => {
        agentSales[id] = { name, totalUZS: 0, totalUSD: 0, count: 0 };
    });

    filteredOrders.forEach(order => {
        const agentId = order.agent?.SD_id;
        if (agentId && agentSales[agentId]) {
            const orderStatus = parseInt(order.status) || 0;
            const totalSumma = parseFloat(order.totalSumma) || 0;
            const returnsSumma = parseFloat(order.totalReturnsSumma) || 0;
            if (orderStatus === 4 || orderStatus === 5 || (returnsSumma > 0 && returnsSumma === totalSumma) || totalSumma === 0) return;

            const paymentTypeId = order.paymentType?.SD_id;
            if (paymentTypeId === 'd0_4') {
                agentSales[agentId].totalUSD += totalSumma;
            } else {
                agentSales[agentId].totalUZS += totalSumma;
            }
            agentSales[agentId].count++;
        }
    });

    const agents = Object.values(agentSales)
        .filter(a => a.count > 0)
        .sort((a, b) => (b.totalUZS + b.totalUSD) - (a.totalUZS + a.totalUSD));

    const totalUZS = agents.reduce((s, a) => s + a.totalUZS, 0);
    const totalUSD = agents.reduce((s, a) => s + a.totalUSD, 0);
    const totalOrders = agents.reduce((s, a) => s + a.count, 0);

    res.json({
        status: true,
        result: { agents, totalUZS, totalUSD, totalOrders, activeAgents: agents.length },
        lastUpdate: serverCache.lastUpdate
    });
});

// Buyurtmalar (period bilan)
app.get('/api/cache/orders/:period', (req, res) => {
    const period = req.params.period || 'today';
    const { startDate, endDate } = req.query;

    if (!serverCache.orders) {
        return res.json({ status: false, error: 'Cache hali tayyor emas' });
    }

    let dateRange;
    if (period === 'custom' && startDate && endDate) {
        dateRange = { startDate, endDate };
    } else {
        dateRange = getDateRange(period);
    }
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
// NARX TEKSHIRISH вЂ” Prixod bo'yicha narxlar
// ============================================
app.get('/api/cache/priceCheck', (req, res) => {
    if (!serverCache.purchases || !serverCache.priceTypes) {
        return res.json({ status: false, error: 'Cache hali tayyor emas' });
    }

    const purchases = serverCache.purchases || [];
    const priceTypes = serverCache.priceTypes || [];
    const catalog = serverCache.catalogPrices || null;

    // PriceType xaritasi вЂ” ID -> name, currency (API dan)
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

    // Narx turlari ro'yxati вЂ” faqat sotish narxlari (type=2)
    // type=1 kirim (purchase) вЂ” allaqachon kirim narx ustunida ko'rsatiladi
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
    // d0_1 = РџСЂРёС…РѕРґРЅР°СЏ С†РµРЅР° ($), d0_12 = РџСЂРёС…РѕРґРЅР°СЏ С†РµРЅР° (СЃСѓРј)
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

// Rasxodlar (Consumption) - period bo'yicha statistika
app.get('/api/cache/consumption/:period', (req, res) => {
    const period = req.params.period || 'today';
    const { startDate, endDate } = req.query;

    if (!serverCache.consumption) {
        return res.json({ status: false, error: 'Cache hali tayyor emas' });
    }

    let dateRange;
    if (period === 'custom' && startDate && endDate) {
        dateRange = { startDate, endDate };
    } else {
        dateRange = getDateRange(period);
    }

    const filteredConsumptions = serverCache.consumption.filter(c => {
        const cDate = (c.date || '').split('T')[0].split(' ')[0];
        return cDate >= dateRange.startDate && cDate <= dateRange.endDate;
    });

    let totalUZS = 0;
    let totalUSD = 0;
    const catMap = {};

    filteredConsumptions.forEach(c => {
        const amount = parseFloat(c.summa) || 0;
        if (amount <= 0) return;

        // Dollar aniqlash - consumption.json da currency: 'USD' yoki 'UZS'
        const isDollar = c.currency === 'USD';

        if (isDollar) { totalUSD += amount; } else { totalUZS += amount; }

        // Kategoriya - consumption.json da categoryParent va categoryChild
        const catId = c.categoryParentId || c.categoryParent || 'uncategorized';
        const catName = c.categoryParent || 'Kategoriyasiz';
        const subCatName = c.categoryChild || '';

        if (!catMap[catId]) {
            catMap[catId] = { name: catName, totalUZS: 0, totalUSD: 0, count: 0, items: [] };
        }
        if (isDollar) { catMap[catId].totalUSD += amount; } else { catMap[catId].totalUZS += amount; }
        catMap[catId].count++;

        const itemLabel = c.comment || subCatName || catName;
        const timeStr = (c.datetime || c.date || '').substring(11, 16);
        const dateStr = (c.date || '').substring(0, 10);

        catMap[catId].items.push({
            name: itemLabel,
            subCategory: subCatName,
            summa: amount,
            date: dateStr,
            time: timeStr,
            isDollar
        });
    });

    const categoryList = Object.values(catMap)
        .sort((a, b) => (b.totalUZS + b.totalUSD*12800) - (a.totalUZS + a.totalUSD*12800));

    res.json({
        status: true,
        result: { totalUZS, totalUSD, totalCount: filteredConsumptions.length, categories: categoryList },
        lastUpdate: serverCache.lastUpdate
    });
});

// Yuk kirimi (Purchases) - period
app.get('/api/cache/purchases/:period', (req, res) => {
    const period = req.params.period || 'today';
    const { startDate, endDate } = req.query;

    if (!serverCache.purchases) {
        return res.json({ status: false, error: 'Cache hali tayyor emas' });
    }

    let dateRange;
    if (period === 'custom' && startDate && endDate) {
        dateRange = { startDate, endDate };
    } else {
        dateRange = getDateRange(period);
    }

    const filteredPurchases = serverCache.purchases.filter(p => {
        const pDate = (p.date || '').split('T')[0].split(' ')[0];
        return pDate >= dateRange.startDate && pDate <= dateRange.endDate;
    });

    let totalAmount = 0;
    const items = [];

    filteredPurchases.forEach(p => {
        const pTotal = parseFloat(p.amount) || 0;
        totalAmount += pTotal;
        items.push({
            id: p.SD_id || p.purchase_id,
            date: p.date,
            shipper: p.shipper?.name || "Noma'lum",
            amount: pTotal,
            currency: (p.priceType?.name && p.priceType.name.toLowerCase().includes('$')) ? 'USD' : 'UZS'
        });
    });

    res.json({ status: true, result: { totalAmount, totalCount: filteredPurchases.length, purchases: items }, lastUpdate: serverCache.lastUpdate });
});

// 📦 Prixod Yuklari - period bo'yicha, ta'minotchi bo'yicha guruhlangan (UZS/USD alohida)
app.get('/api/cache/prixod/:period', (req, res) => {
    const period = req.params.period || 'today';
    const { startDate, endDate } = req.query;

    if (!serverCache.purchases) {
        return res.json({ status: false, error: 'Cache hali tayyor emas' });
    }

    let dateRange;
    if (period === 'custom' && startDate && endDate) {
        dateRange = { startDate, endDate };
    } else {
        dateRange = getDateRange(period);
    }

    const filteredPurchases = serverCache.purchases.filter(p => {
        const pDate = (p.date || '').split('T')[0].split(' ')[0];
        return pDate >= dateRange.startDate && pDate <= dateRange.endDate;
    });

    let totalUZS = 0;
    let totalUSD = 0;
    const shipperMap = {};

    filteredPurchases.forEach(p => {
        // Detail mahsulotlaridan jami summa hisoblash
        // SalesDoc da: price < 100 => USD, price >= 100 => UZS
        let docUZS = 0;
        let docUSD = 0;

        (p.detail || []).forEach(item => {
            const price = parseFloat(item.price) || 0;
            const qty   = parseFloat(item.quantity) || 1;
            if (price <= 0) return;

            const itemTotal = price * qty;
            if (price < 100) {
                docUSD += itemTotal;
            } else {
                docUZS += itemTotal;
            }
        });

        // detail bo'sh bo'lsa — hujjat darajasidagi amount/summa maydonlarini tekshirish
        if (docUZS === 0 && docUSD === 0) {
            const fallback = parseFloat(p.amount || p.summa || p.totalSumma || 0);
            if (fallback > 0) {
                const priceTypeName = (p.priceType?.name || '').toLowerCase();
                const isUSD = priceTypeName.includes('$') || priceTypeName.includes('dollar') || priceTypeName.includes('usd');
                if (isUSD) docUSD = fallback; else docUZS = fallback;
            }
        }

        totalUZS += docUZS;
        totalUSD += docUSD;

        // Ta'minotchi bo'yicha guruhlash
        const shipperId = p.shipper?.SD_id || p.shipper?.CS_id || 'unknown';
        const shipperName = p.shipper?.name || "Noma'lum ta'minotchi";

        if (!shipperMap[shipperId]) {
            shipperMap[shipperId] = {
                name: shipperName,
                totalUZS: 0,
                totalUSD: 0,
                count: 0,
                docs: []
            };
        }

        shipperMap[shipperId].totalUZS += docUZS;
        shipperMap[shipperId].totalUSD += docUSD;
        shipperMap[shipperId].count++;
        shipperMap[shipperId].docs.push({
            date: (p.date || '').substring(0, 10),
            uzs: Math.round(docUZS),
            usd: Math.round(docUSD * 100) / 100,
            itemCount: (p.detail || []).length
        });
    });

    // Ta'minotchilarni jami summa bo'yicha tartiblash
    const shipperList = Object.values(shipperMap)
        .sort((a, b) => (b.totalUZS + b.totalUSD * 12200) - (a.totalUZS + a.totalUSD * 12200));

    res.json({
        status: true,
        result: {
            totalUZS,
            totalUSD,
            totalCount: filteredPurchases.length,
            shippers: shipperList
        },
        lastUpdate: serverCache.lastUpdate
    });
});


// ============================================================
// Pastavshiklar Qarzdorligi (Oborot po pastavshikam)
// ============================================================
app.get('/api/cache/shipper-debts', (req, res) => {
    if (!serverCache.shipperDebts) {
        return res.json({ status: false, error: "Pastavshiklar ma'lumoti hali yuklanmadi. Server background jarayoni tugaguncha kuting (10-15 min)." });
    }
    const shippers = serverCache.shipperDebts;

    // UZS bo'yicha umumiy hisob
    let somWeOwe = 0, somTheyOwe = 0;
    // USD bo'yicha umumiy hisob
    let usdWeOwe = 0, usdTheyOwe = 0;

    shippers.forEach(s => {
        const somBal = s.som?.balanceEnd || 0;
        if (somBal < 0) somWeOwe += Math.abs(somBal);
        else somTheyOwe += somBal;

        const usdBal = s.usd?.balanceEnd || 0;
        if (usdBal < 0) usdWeOwe += Math.abs(usdBal);
        else usdTheyOwe += usdBal;
    });

    res.json({
        status: true,
        result: {
            shippers,
            totalCount: shippers.length,
            som: { weOwe: Math.round(somWeOwe), theyOwe: Math.round(somTheyOwe) },
            usd: { weOwe: Math.round(usdWeOwe * 100) / 100, theyOwe: Math.round(usdTheyOwe * 100) / 100 }
        },
        lastUpdate: serverCache.lastUpdate
    });
});

// Pastavshiklar qarzini zudlik bilan yangilash (force refresh)
app.post('/api/shipper-debts/refresh', async (req, res) => {
    try {
        if (!webSessionCookies || Object.keys(webSessionCookies).length === 0) {
            const ok = await webLogin();
            if (!ok) return res.json({ status: false, error: 'Web panel login muvaffaqiyatsiz' });
        }
        const data = await fetchShipperDebts();
        if (data) {
            serverCache.shipperDebts = data;
            res.json({ status: true, count: data.length, message: "Pastavshiklar ma'lumoti yangilandi" });
        } else {
            res.json({ status: false, error: "Ma'lumot olishda xato" });
        }
    } catch(e) {
        res.json({ status: false, error: e.message });
    }
});

// Kassa - period bo'yicha to'lovlar statistikasi
app.get('/api/cache/kassa/:period', (req, res) => {
    const period = req.params.period || 'today';
    const { startDate, endDate } = req.query;

    if (!serverCache.payments) {
        return res.json({ status: false, error: 'Cache hali tayyor emas' });
    }

    let dateRange;
    if (period === 'custom' && startDate && endDate) {
        dateRange = { startDate, endDate };
    } else {
        dateRange = getDateRange(period);
    }
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
        console.log(`рџ“Љ agentDebts: ${Object.keys(clientSrokMap).length} ta mijozda srok bor (web panel)`);
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

// =============================================================================
// 📊 POWER BI EXPORT ENDPOINTS — barcha ma'lumotlar tekis JSON array da
// =============================================================================

// 💰 Pul kirimi (To'lovlar / Kassa)
app.get('/api/export/payments', (req, res) => {
    if (!serverCache.payments) return res.json({ error: 'Cache tayyor emas' });

    // Mijoz nomlarini oldindan tayyorlash (client SD_id -> name)
    const clientNameMap = {};
    (serverCache.clients || []).forEach(c => {
        clientNameMap[c.SD_id] = c.name || c.clientName || '';
    });
    // Agent nomlarini ham tayyorlash
    const agentNameMap = {};
    (serverCache.agents || []).forEach(a => {
        agentNameMap[a.SD_id] = a.name || '';
    });

    const data = serverCache.payments.map(p => {
        const clientId = p.client?.SD_id || p.client?.CS_id || '';
        const agentId = p.agent?.SD_id || p.agent?.CS_id || '';
        // SD API da payment.client.name ko'pincha null bo'ladi, clientName yoki cache dan olish kerak
        const clientName = p.client?.clientName || p.client?.name || clientNameMap[clientId] || '';
        const agentName = p.agent?.name || agentNameMap[agentId] || '';
        const paymentTypeId = p.paymentType?.SD_id || '';
        // currency_id ni aniqlash
        const currency_id = paymentTypeId;
        const currency = paymentTypeId === 'd0_4' ? 'USD' : 'UZS';

        return {
            id: p.SD_id,
            date: (p.paymentDate || '').substring(0, 10),
            amount: parseFloat(p.amount) || 0,
            currency,
            currency_id,
            client: clientName,
            client_id: clientId,
            comment: p.comment || '',
            type: p.transactionType || '',
        };
    });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(data);
});

// 📥 Yuk kirimi (Zakupka / Prixod hujjatlar)
app.get('/api/export/purchases', (req, res) => {
    if (!serverCache.purchases) return res.json({ error: 'Cache tayyor emas' });
    const data = [];
    serverCache.purchases.forEach(p => {
        const docDate = (p.date || '').substring(0, 10);
        const priceTypeName = p.priceType?.name || '';
        const isUSD = priceTypeName.includes('$') || priceTypeName.toLowerCase().includes('dollar');
        const currency = isUSD ? 'USD' : 'UZS';
        (p.detail || []).forEach(item => {
            data.push({
                id: p.SD_id || '',
                date: docDate,
                shipper: p.shipper?.name || '',
                shipper_id: p.shipper?.SD_id || '',
                store: p.name || '',
                priceType: priceTypeName,
                currency,
                productId: item.SD_id || '',
                productName: item.name || '',
                quantity: parseFloat(item.quantity) || 0,
                price: parseFloat(item.price) || 0,
                amount: (parseFloat(item.price) || 0) * (parseFloat(item.quantity) || 0)
            });
        });
    });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(data);
});

// 🏷 Mahsulotlar ro'yxati va Ostatka
app.get('/api/export/products', (req, res) => {
    if (!serverCache.products) return res.json({ error: 'Cache tayyor emas' });
    // serverCache.stock = { SD_id: quantity } object
    const stockMap = (serverCache.stock && typeof serverCache.stock === 'object' && !Array.isArray(serverCache.stock))
        ? serverCache.stock : {};

    // Catalog narxlardan sotish narxni olish (agar mavjud bo'lsa)
    const catalogPrices = serverCache.catalogPrices?.productPrices || {};
    // Tan narxlardan ham olish
    const costPrices = serverCache.costPrices || {};

    const data = serverCache.products.map(p => {
        const productId = p.SD_id;
        // Narx: catalogdan eng katta UZS sotish narxni olish
        let price = 0;
        const pricesForProduct = catalogPrices[productId];
        if (pricesForProduct) {
            // Eng katta narxni topish (odatda sotish narxi)
            Object.values(pricesForProduct).forEach(pr => {
                const v = parseFloat(pr) || 0;
                if (v > price) price = v;
            });
        }
        // Agar catalog narx bo'lmasa, tan narxdan olish
        if (price === 0 && costPrices[productId]) {
            price = costPrices[productId].costPriceUZS || 0;
        }

        // Category va subcategory: SD API da group sifatida keladi
        // group.name "Bolalar mahsulotlari" kabi
        const category = p.category?.name || p.group?.name || '';
        const subcategory = p.subcategory?.name || '';

        return {
            id: productId,
            category,
            name: p.name || '',
            price: Math.round(price * 100) / 100,
            stock: stockMap[productId] || 0,
            subcategory,
            unit: p.unit?.name || '',
        };
    });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(data);
});

// 📦 Sotuvlar (Buyurtmalar) — har bir buyurtma bitta qator
app.get('/api/export/orders', (req, res) => {
    if (!serverCache.orders) return res.json({ error: 'Cache tayyor emas' });

    // Mijoz va agent nomlarini cache dan oldindan tayyorlash
    const clientNameMap = {};
    (serverCache.clients || []).forEach(c => {
        clientNameMap[c.SD_id] = c.name || c.clientName || '';
    });
    const agentNameMap = {};
    (serverCache.agents || []).forEach(a => {
        agentNameMap[a.SD_id] = a.name || '';
    });

    const data = serverCache.orders.map(o => {
        const status = parseInt(o.status) || 0;
        const totalSumma = parseFloat(o.totalSumma) || 0;
        const clientId = o.client?.SD_id || '';
        const agentId = o.agent?.SD_id || '';
        const clientName = o.client?.clientName || o.client?.name || clientNameMap[clientId] || '';
        const agentName = o.agent?.name || agentNameMap[agentId] || '';
        const currency = o.paymentType?.SD_id === 'd0_4' ? 'USD' : 'UZS';

        return {
            id: o.SD_id,
            date: (o.dateCreate || o.dateDocument || '').substring(0, 10),
            status,
            clientId,
            clientName,
            agentId,
            agentName,
            currency,
            totalAmount: totalSumma,
            payment: o.paymentType?.name || '',
        };
    });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(data);
});

// 📦 Sotuvlar tafsilot (har bir mahsulot alohida qator)
app.get('/api/export/order-items', (req, res) => {
    if (!serverCache.orders) return res.json({ error: 'Cache tayyor emas' });
    const data = [];
    serverCache.orders.forEach(o => {
        const orderDate = (o.dateCreate || o.dateDocument || '').substring(0, 10);
        const status = parseInt(o.status) || 0;
        const currency = o.paymentType?.SD_id === 'd0_4' ? 'USD' : 'UZS';
        (o.orderProducts || []).forEach(item => {
            data.push({
                orderId: o.SD_id,
                orderDate,
                status,
                clientId: o.client?.SD_id || '',
                agentId: o.agent?.SD_id || '',
                currency,
                productId: item.product?.SD_id || '',
                productName: item.product?.name || item.name || '',
                quantity: parseFloat(item.quantity) || 0,
                price: parseFloat(item.price) || 0,
                summa: parseFloat(item.summa) || 0,
            });
        });
    });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(data);
});

// 💸 Rasxodlar (Chiqimlar)
app.get('/api/export/consumption', (req, res) => {
    if (!serverCache.consumption) return res.json({ error: 'Cache tayyor emas' });
    const data = serverCache.consumption.map(c => {
        // Summani to'g'ri olish - ko'p variantlarni tekshirish
        const amount = parseFloat(c.summa) || parseFloat(c.amount) || parseFloat(c.totalSumma) || 0;
        const paymentTypeId = c.paymentType?.SD_id || '';
        const currency = paymentTypeId === 'd0_4' ? 'USD' : 'UZS';

        return {
            id: c.SD_id,
            date: (c.date || '').substring(0, 10),
            amount,
            currency,
            currency_id: paymentTypeId,
            category: c.category_parent?.name || '',
            subcategory: c.category_child?.name || '',
            comment: c.comment || '',
        };
    });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(data);
});

// 🤝 Qarzlar (Balanslar)
app.get('/api/export/balances', (req, res) => {
    if (!serverCache.balances) return res.json({ error: 'Cache tayyor emas' });
    const data = [];
    serverCache.balances.forEach(b => {
        const byCurrency = b['by-currency'] || [];
        let uzs = 0, usd = 0;
        byCurrency.forEach(c => {
            const amount = parseFloat(c.amount) || 0;
            if (c.currency_id === 'd0_4') usd = amount;
            else uzs += amount;
        });
        data.push({
            clientId: b.SD_id,
            clientName: b.name || '',
            balanceUZS: uzs,
            balanceUSD: usd,
            balanceTotal: parseFloat(b.balance) || 0
        });
    });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(data);
});

// 👥 Mijozlar
app.get('/api/export/clients', (req, res) => {
    if (!serverCache.clients) return res.json({ error: 'Cache tayyor emas' });
    const data = serverCache.clients.map(c => ({
        id: c.SD_id,
        name: c.name || c.clientName || '',
        phone: c.phone || c.phones?.[0] || '',
        address: c.address || '',
        groupName: c.group?.name || '',
        groupId: c.group?.SD_id || '',
        agentName: c.agent?.name || '',
        agentId: c.agent?.SD_id || '',
        balance: parseFloat(c.balance) || 0,
        inn: c.inn || '',
        createdAt: (c.created_at || '').substring(0, 10)
    }));
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(data);
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

        console.log(`рџ“Ў API so'rov: ${apiUrl}`);
        console.log(`рџ“¦ Method: ${body?.method}`);

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (data.status) {
            console.log(`вњ… Javob: Muvaffaqiyatli`);
            if (data.result) {
                console.log(`рџ“Љ Result:`, Array.isArray(data.result) ? `${data.result.length} ta element` : typeof data.result);
            }
        } else {
            console.log(`вќЊ Xato:`, data.error || JSON.stringify(data));
        }

        res.json(data);
    } catch (error) {
        console.error('вќЊ Proxy xatosi:', error.message);
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

        console.log(`рџ”ђ Login so'rov: ${apiUrl}`);

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
            console.log(`вњ… Login muvaffaqiyatli: userId=${data.result.userId}`);
        } else {
            console.log(`вќЊ Login xatosi:`, data.error);
        }

        res.json(data);
    } catch (error) {
        console.error('вќЊ Login xatosi:', error.message);
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

        console.log(`рџ“Љ PivotPnL so'rov: ${apiUrl}`);

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Cookie': cookies,
                'Accept': 'application/json'
            }
        });

        const data = await response.json();

        console.log(`вњ… PivotPnL: ${Array.isArray(data) ? data.length : 0} ta mahsulot`);

        res.json({ status: true, result: data });
    } catch (error) {
        console.error('вќЊ PivotPnL xatosi:', error.message);
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
            console.log('вќЊ Balance with Srok: serverUrl yoki auth yo\'q');
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

        console.log(`рџ“… Balance with Srok: Agent ${agentId || 'hammasi'}`);

        // 1. Qarzdor mijozlarni olish (balance < 0)
        const balanceData = await apiRequest('getBalance', { page: 1, limit: 5000 });
        if (!balanceData.status || !balanceData.result?.balance) {
            console.log('вќЊ getBalance xatosi:', balanceData.error);
            return res.json({ status: false, error: 'getBalance xatosi' });
        }

        // Faqat qarzdor mijozlar (balance < 0)
        const debtors = balanceData.result.balance.filter(c => c.balance < 0);
        console.log(`рџ“Љ Jami ${debtors.length} ta qarzdor mijoz`);

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
        console.log(`рџ“¦ Jami ${allOrders.length} ta buyurtma`);

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
        console.log(`рџ’° Jami ${allPayments.length} ta to'lov`);

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

        console.log(`вњ… Balance with Srok: ${filteredClients.length} ta mijoz (srok bilan)`);

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
        console.error('вќЊ Balance with Srok xatosi:', error.message);
        res.status(500).json({
            status: false,
            error: error.message
        });
    }
});


// 🏭 Pastavshiklar qarzdorligi — Power BI
app.get('/api/export/supplier-debts', (req, res) => {
    const shippers = serverCache.shipperDebts;
    if (!shippers || !Array.isArray(shippers) || shippers.length === 0) {
        return res.json([]);
    }
    const rows = [];
    shippers.forEach(s => {
        // UZS qator
        if (s.som && (s.som.balanceStart || s.som.weOwe || s.som.theyClosed || s.som.balanceEnd)) {
            rows.push({
                supplierName: s.name || '',
                supplierId: s.id || '',
                currency: 'UZS',
                startBalance: s.som.balanceStart || 0,
                debit: s.som.weOwe || 0,
                credit: s.som.theyClosed || 0,
                endBalance: s.som.balanceEnd || 0,
            });
        }
        // USD qator
        if (s.usd && (s.usd.balanceStart || s.usd.weOwe || s.usd.theyClosed || s.usd.balanceEnd)) {
            rows.push({
                supplierName: s.name || '',
                supplierId: s.id || '',
                currency: 'USD',
                startBalance: s.usd.balanceStart || 0,
                debit: s.usd.weOwe || 0,
                credit: s.usd.theyClosed || 0,
                endBalance: s.usd.balanceEnd || 0,
            });
        }
    });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(rows);
});

// Bosh sahifa
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serverni ishga tushirish
app.listen(PORT, () => {
    console.log('');
    console.log('в•”в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•—');
    console.log('в•‘     рџЏҐ Sales Doctor Analytics Dashboard                в•‘');
    console.log('в•‘     рџљЂ CACHING SERVER v2.0                             в•‘');
    console.log('в• в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•Ј');
    console.log(`в•‘  рџЊђ Server: http://localhost:${PORT}                      в•‘`);
    console.log('в•‘  рџ“Љ Dashboard tayyor!                                  в•‘');
    console.log('в•‘  вљЎ Cache: Har 10 daqiqada avtomatik yangilanadi       в•‘');
    console.log('в•љв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ќ');
    console.log('');

    // Server boshlanishida cache ni yuklash
    console.log('рџљЂ Birinchi cache yuklanmoqda...');
    refreshCache();

    // Har 10 daqiqada avtomatik yangilash
    setInterval(() => {
        console.log('вЏ° Avtomatik cache yangilash...');
        refreshCache();
    }, CACHE_CONFIG.REFRESH_INTERVAL);
});
