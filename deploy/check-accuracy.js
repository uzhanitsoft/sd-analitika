/**
 * Ma'lumotlar aniqligini tekshirish skripti
 * Railway cache vs Direct API
 */

const fetch = require('node-fetch');

const API_URL = 'https://rafiq.salesdoc.io/api/v2/';
const RAILWAY_URL = 'https://sd-analitika-production.up.railway.app';
const LOGIN = 'admin';
const PASSWORD = '1234567rafiq';

const today = new Date();
const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

console.log('');
console.log('=============================================================');
console.log('  MALUMOTLAR ANIQLIGINI TEKSHIRISH');
console.log('  Sana: ' + todayStr);
console.log('=============================================================');
console.log('');

async function apiRequest(auth, method, params) {
    params = params || {};
    var response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth: auth, method: method, params: params })
    });
    return response.json();
}

async function main() {
    // ====== 1. RAILWAY CACHE HOLATI ======
    console.log('------------------------------------------------------------');
    console.log('1. RAILWAY SERVER CACHE HOLATI');
    console.log('------------------------------------------------------------');

    var cacheStats = null;
    try {
        var statusRes = await fetch(RAILWAY_URL + '/api/cache/status');
        var status = await statusRes.json();
        console.log('   Server: Ishlayapti');
        console.log('   Buyurtmalar: ' + (status.counts ? status.counts.orders : 0));
        console.log('   Mahsulotlar: ' + (status.counts ? status.counts.products : 0));
        console.log('   Mijozlar:    ' + (status.counts ? status.counts.clients : 0));
        console.log('   Qarzlar:     ' + (status.counts ? status.counts.balances : 0));
        console.log('   Tolovlar:    ' + (status.counts ? status.counts.payments : 0));
        console.log('   Oxirgi yangilanish: ' + (status.lastUpdate || 'N/A'));

        // Cache stats - bugun
        var todayStatsRes = await fetch(RAILWAY_URL + '/api/cache/stats/today');
        var todayStatsData = await todayStatsRes.json();

        if (todayStatsData.status && todayStatsData.result) {
            cacheStats = todayStatsData.result;
            console.log('');
            console.log('   BUGUNGI STATISTIKA (Cache):');
            console.log('   Sotuvlar UZS:  ' + Math.round(cacheStats.totalSalesUZS).toLocaleString());
            console.log('   Sotuvlar USD:  ' + Math.round(cacheStats.totalSalesUSD).toLocaleString());
            console.log('   Buyurtmalar:   ' + cacheStats.totalOrders);
            console.log('   AKB:           ' + cacheStats.totalClientsAKB);
            console.log('   Mahsulotlar:   ' + cacheStats.totalProducts);
            console.log('   Foyda UZS:     ' + Math.round(cacheStats.totalProfitUZS).toLocaleString());
            console.log('   Foyda USD:     ' + cacheStats.totalProfitUSD);
        }

        // Hafta, Oy, Yil
        var periods = ['week', 'month', 'year'];
        var periodNames = { week: 'HAFTA', month: 'OY', year: 'YIL' };
        for (var i = 0; i < periods.length; i++) {
            var p = periods[i];
            var pRes = await fetch(RAILWAY_URL + '/api/cache/stats/' + p);
            var pData = await pRes.json();
            if (pData.status && pData.result) {
                var s = pData.result;
                console.log('');
                console.log('   ' + periodNames[p] + ' STATISTIKA (Cache):');
                console.log('   Sotuvlar UZS:  ' + Math.round(s.totalSalesUZS).toLocaleString());
                console.log('   Sotuvlar USD:  ' + Math.round(s.totalSalesUSD).toLocaleString());
                console.log('   Buyurtmalar:   ' + s.totalOrders);
                console.log('   Foyda UZS:     ' + Math.round(s.totalProfitUZS).toLocaleString());
            }
        }
    } catch (e) {
        console.log('   Railway server offline: ' + e.message);
    }

    // ====== 2. DIRECT API TEKSHIRISH ======
    console.log('');
    console.log('------------------------------------------------------------');
    console.log('2. DIRECT API TEKSHIRISH (Fresh login)');
    console.log('------------------------------------------------------------');

    var loginRes = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'login', auth: { login: LOGIN, password: PASSWORD } })
    });
    var loginData = await loginRes.json();

    if (!loginData.status) {
        console.log('   Login muvaffaqiyatsiz:', loginData.error);
        return;
    }

    var auth = { userId: loginData.result.userId, token: loginData.result.token };
    console.log('   Login: userId=' + auth.userId);

    // Bugungi buyurtmalar
    console.log('');
    console.log('   Bugungi buyurtmalar tekshirilmoqda...');
    var todayOrders = [];
    var page = 1;
    var hasMore = true;

    while (hasMore && page <= 20) {
        var orderData = await apiRequest(auth, 'getOrder', {
            page: page, limit: 500,
            filter: { status: 'all', startDate: todayStr, endDate: todayStr }
        });
        var orders = (orderData && orderData.result && orderData.result.order) ? orderData.result.order : [];
        if (orders.length > 0) {
            todayOrders = todayOrders.concat(orders);
            hasMore = orders.length === 500;
            page++;
        } else {
            hasMore = false;
        }
    }

    console.log('   Bugungi buyurtmalar soni: ' + todayOrders.length);

    // Dollar narx turlari
    var dollarPriceTypes = ['d0_7', 'd0_8', 'd0_11', 'd0_9', 'd0_6'];

    function isDollarType(id) {
        return dollarPriceTypes.indexOf(id) >= 0;
    }

    // Hisoblash
    var directSalesUZS = 0;
    var directSalesUSD = 0;
    var directActiveClients = {};
    var returnCount = 0;

    todayOrders.forEach(function (order) {
        var orderStatus = order.status;
        var totalSumma = parseFloat(order.totalSumma) || 0;
        var returnsSumma = parseFloat(order.totalReturnsSumma) || 0;

        if (orderStatus === 4 || orderStatus === 5 || (returnsSumma > 0 && returnsSumma === totalSumma)) {
            returnCount++;
            return;
        }

        var sum = totalSumma || parseFloat(order.totalSummaAfterDiscount) || 0;
        var paymentTypeId = order.paymentType ? order.paymentType.SD_id : '';
        var priceTypeId = order.priceType ? order.priceType.SD_id : '';

        if (order.client && order.client.SD_id) directActiveClients[order.client.SD_id] = true;

        if (paymentTypeId === 'd0_4' || isDollarType(priceTypeId)) {
            directSalesUSD += sum;
        } else {
            directSalesUZS += sum;
        }
    });

    var akbCount = Object.keys(directActiveClients).length;

    console.log('');
    console.log('   DIRECT API NATIJALAR (Bugun):');
    console.log('   Sotuvlar UZS:  ' + Math.round(directSalesUZS).toLocaleString());
    console.log('   Sotuvlar USD:  ' + Math.round(directSalesUSD).toLocaleString());
    console.log('   Buyurtmalar:   ' + todayOrders.length + ' (' + returnCount + ' ta qaytarish)');
    console.log('   AKB:           ' + akbCount);

    // ====== SOLISHTRISH ======
    if (cacheStats) {
        console.log('');
        console.log('------------------------------------------------------------');
        console.log('   CACHE vs DIRECT API SOLISHTIRISH (Bugun):');
        console.log('------------------------------------------------------------');
        console.log('                     CACHE              DIRECT API');
        console.log('   Sotuvlar UZS:  ' + Math.round(cacheStats.totalSalesUZS).toLocaleString().padEnd(20) + Math.round(directSalesUZS).toLocaleString());
        console.log('   Sotuvlar USD:  ' + Math.round(cacheStats.totalSalesUSD).toLocaleString().padEnd(20) + Math.round(directSalesUSD).toLocaleString());
        console.log('   Buyurtmalar:   ' + String(cacheStats.totalOrders).padEnd(20) + todayOrders.length);
        console.log('   AKB:           ' + String(cacheStats.totalClientsAKB).padEnd(20) + akbCount);

        var uzsMatch = Math.abs(cacheStats.totalSalesUZS - directSalesUZS) < 100;
        var usdMatch = Math.abs(cacheStats.totalSalesUSD - directSalesUSD) < 100;
        var ordersMatch = cacheStats.totalOrders === todayOrders.length;

        console.log('');
        console.log('   UZS:  ' + (uzsMatch ? 'MATCH' : 'MISMATCH (farq: ' + Math.round(cacheStats.totalSalesUZS - directSalesUZS).toLocaleString() + ')'));
        console.log('   USD:  ' + (usdMatch ? 'MATCH' : 'MISMATCH (farq: ' + Math.round(cacheStats.totalSalesUSD - directSalesUSD).toLocaleString() + ')'));
        console.log('   Orders: ' + (ordersMatch ? 'MATCH' : 'MISMATCH'));
    }

    // ====== 3. QARZLAR TEKSHIRISH ======
    console.log('');
    console.log('------------------------------------------------------------');
    console.log('3. QARZLAR (getBalance) TEKSHIRISH');
    console.log('------------------------------------------------------------');

    var balanceData = await apiRequest(auth, 'getBalance', { page: 1, limit: 5000 });
    var balances = (balanceData && balanceData.result && balanceData.result.balance) ? balanceData.result.balance : [];

    var totalDebtUZS = 0;
    var debtorCount = 0;
    var totalNaqd = 0;
    var totalBeznal = 0;
    var totalDollar = 0;

    balances.forEach(function (b) {
        if (b.balance < 0) {
            debtorCount++;
            totalDebtUZS += Math.abs(b.balance);
        }

        var byCurrency = b['by-currency'] || [];
        byCurrency.forEach(function (c) {
            var amount = c.amount || 0;
            if (c.currency_id === 'd0_2') totalNaqd += amount;
            if (c.currency_id === 'd0_3') totalBeznal += amount;
            if (c.currency_id === 'd0_4') totalDollar += amount;
        });
    });

    console.log('   Jami mijozlar (balance): ' + balances.length);
    console.log('   Qarzdorlar: ' + debtorCount);
    console.log('   Jami qarz (UZS): ' + Math.round(totalDebtUZS).toLocaleString());
    console.log('   Naqd (som):      ' + Math.round(totalNaqd).toLocaleString());
    console.log('   Beznal:          ' + Math.round(totalBeznal).toLocaleString());
    console.log('   Dollar:          ' + Math.round(totalDollar).toLocaleString());

    // ====== 4. AGENT BO'YICHA TEKSHIRISH ======
    console.log('');
    console.log('------------------------------------------------------------');
    console.log('4. AGENTLAR BOYICHA BUGUNGI SOTUVLAR');
    console.log('------------------------------------------------------------');

    var agentNames = {
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

    var agentSales = {};
    todayOrders.forEach(function (order) {
        var orderStatus = order.status;
        var totalSumma = parseFloat(order.totalSumma) || 0;
        var returnsSumma = parseFloat(order.totalReturnsSumma) || 0;
        if (orderStatus === 4 || orderStatus === 5 || (returnsSumma > 0 && returnsSumma === totalSumma)) return;

        var agentId = (order.agent && order.agent.SD_id) ? order.agent.SD_id : 'unknown';
        if (!agentSales[agentId]) {
            agentSales[agentId] = { name: agentNames[agentId] || agentId, count: 0, sumUZS: 0, sumUSD: 0, clients: {} };
        }

        var sum = totalSumma || parseFloat(order.totalSummaAfterDiscount) || 0;
        var paymentTypeId = order.paymentType ? order.paymentType.SD_id : '';
        var priceTypeId = order.priceType ? order.priceType.SD_id : '';

        agentSales[agentId].count++;
        if (order.client && order.client.SD_id) agentSales[agentId].clients[order.client.SD_id] = true;

        if (paymentTypeId === 'd0_4' || isDollarType(priceTypeId)) {
            agentSales[agentId].sumUSD += sum;
        } else {
            agentSales[agentId].sumUZS += sum;
        }
    });

    // Sort by UZS
    var sorted = Object.keys(agentSales).map(function (id) {
        var d = agentSales[id];
        return { id: id, name: d.name, count: d.count, sumUZS: d.sumUZS, sumUSD: d.sumUSD, clients: Object.keys(d.clients).length };
    }).sort(function (a, b) { return b.sumUZS - a.sumUZS; });

    sorted.forEach(function (a, i) {
        var uzsStr = Math.round(a.sumUZS).toLocaleString();
        var usdStr = a.sumUSD > 0 ? ' + $' + Math.round(a.sumUSD).toLocaleString() : '';
        console.log('   ' + (i + 1) + '. ' + a.name.padEnd(30) + ' ' + a.count + ' ta | ' + uzsStr + ' som' + usdStr + ' | ' + a.clients + ' mijoz');
    });

    // ====== 5. IRODA AGENTLARI ======
    console.log('');
    console.log('------------------------------------------------------------');
    console.log('5. IRODA AGENTLARI BUGUNGI JAMI');
    console.log('------------------------------------------------------------');

    var irodaIds = ['d0_2', 'd0_3', 'd0_4', 'd0_6', 'd0_7', 'd0_10', 'd0_11', 'd0_19', 'd0_21', 'd0_22', 'd0_24', 'd0_25', 'd0_27'];
    var irodaTotalUZS = 0;
    var irodaTotalUSD = 0;
    var irodaTotalCount = 0;

    irodaIds.forEach(function (id) {
        if (agentSales[id]) {
            irodaTotalUZS += agentSales[id].sumUZS;
            irodaTotalUSD += agentSales[id].sumUSD;
            irodaTotalCount += agentSales[id].count;
        }
    });

    console.log('   Iroda jami UZS: ' + Math.round(irodaTotalUZS).toLocaleString());
    console.log('   Iroda jami USD: ' + Math.round(irodaTotalUSD).toLocaleString());
    console.log('   Iroda buyurtmalar: ' + irodaTotalCount);

    // ====== 6. XULOSA ======
    console.log('');
    console.log('=============================================================');
    console.log('  XULOSA');
    console.log('=============================================================');
    console.log('   Sana: ' + todayStr + ' | Vaqt: ' + today.toLocaleTimeString());
    console.log('   Bugun ' + todayOrders.length + ' ta buyurtma (' + returnCount + ' qaytarish)');
    console.log('   Jami UZS: ' + Math.round(directSalesUZS).toLocaleString());
    console.log('   Jami USD: ' + Math.round(directSalesUSD).toLocaleString());
    console.log('   Qarzdorlar: ' + debtorCount + ' ta, ' + Math.round(totalDebtUZS).toLocaleString() + ' som');
    console.log('');
}

main().catch(function (e) { console.error('Xato:', e.message); });
