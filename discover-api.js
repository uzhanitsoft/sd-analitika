/**
 * Sales Doctor API - Yangi yo'llar orqali to'liq ma'lumot olish
 */

const fetch = require('node-fetch');

const serverUrl = 'https://rafiq.salesdoc.io/api/v2/';
const auth = { userId: 'd0_67', token: '460e6b260534c4b7d005fea460d5feda' };

async function apiCall(method, params = {}) {
    const res = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth, method, params })
    });
    return res.json();
}

async function discoverAPI() {
    console.log('🔍 YANGI YO\'LLAR BILAN TEKSHIRISH\n');
    console.log('='.repeat(70));

    // 1. BARCHA MAVJUD API METODLARINI TOPISH
    console.log('\n📌 1. BARCHA MUMKIN BO\'LGAN METODLAR:\n');

    const allMethods = [
        // Asosiy metodlar
        'getOrder', 'getOrders', 'getOrderList', 'orderList', 'allOrders',
        'getSale', 'getSales', 'sale', 'sales',
        'getInvoice', 'getInvoices', 'invoice',
        'getDocument', 'getDocuments', 'document',
        // Hisobotlar
        'getReport', 'getReports', 'report', 'reports',
        'getDashboard', 'dashboard',
        'getStatistics', 'statistics', 'stats',
        'getSummary', 'summary',
        'getAnalytics', 'analytics',
        // Agentlar va supervisor
        'getAgent', 'getAgents', 'agent',
        'getSupervisor', 'supervisor',
        'getTeam', 'team',
        'getUser', 'getUsers', 'user',
        // Boshqa
        'getShipment', 'getDelivery', 'delivery',
        'getReturn', 'returns',
        'getStock', 'stock',
        'getWarehouse', 'warehouse',
        'getExpeditor', 'expeditor',
        // Moliya
        'getPayment', 'getPayments', 'payment',
        'getBalance', 'balance', 'balances',
        'getDebt', 'debt', 'debts',
        'getCashflow', 'cashflow',
        // Klassik hisobotlar
        'reportSales', 'reportOrders', 'reportAgents',
        'dailyReport', 'monthlyReport', 'yearlyReport',
        // API discovery
        'getMethods', 'methods', 'help', 'api', 'version', 'info'
    ];

    const workingMethods = [];

    for (const method of allMethods) {
        try {
            const data = await apiCall(method);
            if (data.status === true && data.result) {
                const keys = Object.keys(data.result);
                console.log(`  ✅ ${method.padEnd(20)} -> result: { ${keys.join(', ')} }`);
                workingMethods.push({ method, keys });
            }
        } catch (e) { }
    }

    console.log(`\n  Ishlaydigan metodlar: ${workingMethods.length} ta`);

    // 2. BUYURTMALAR - TURLI PARAMETRLAR BILAN
    console.log('\n' + '='.repeat(70));
    console.log('📌 2. BUYURTMALAR - TURLI PARAMETRLAR:\n');

    const orderParams = [
        { name: 'Oddiy', params: {} },
        { name: 'limit: 500', params: { limit: 500 } },
        { name: 'page: 1, limit: 100', params: { page: 1, limit: 100 } },
        { name: 'allAgents: true', params: { allAgents: true } },
        { name: 'showAll: true', params: { showAll: true } },
        { name: 'includeAll: true', params: { includeAll: true } },
        { name: 'Bugun', params: { dateFrom: '2026-02-05', dateTo: '2026-02-05' } },
        { name: 'Bu oy', params: { dateFrom: '2026-02-01', dateTo: '2026-02-28' } },
        { name: 'Hamma vaqt', params: { dateFrom: '2020-01-01', dateTo: '2030-12-31' } },
        { name: 'Status: all', params: { status: 'all' } },
        { name: 'Status: delivered', params: { status: 'delivered' } },
        { name: 'Status: new', params: { status: 'new' } },
        { name: 'withDetails: true', params: { withDetails: true } },
        { name: 'filter: all', params: { filter: { all: true } } },
    ];

    let maxOrders = 0;
    let bestParams = null;

    for (const { name, params } of orderParams) {
        try {
            const data = await apiCall('getOrder', params);
            const count = data.result?.order?.length || 0;
            if (count > 0) {
                console.log(`  📦 ${name.padEnd(25)} -> ${count} ta buyurtma`);
                if (count > maxOrders) {
                    maxOrders = count;
                    bestParams = params;
                }
            }
        } catch (e) { }
    }

    console.log(`\n  🏆 Eng ko'p: ${maxOrders} ta buyurtma`);

    // 3. AGENTLAR VA ULARNING BUYURTMALARI
    console.log('\n' + '='.repeat(70));
    console.log('📌 3. AGENTLAR BO\'YICHA BUYURTMALAR:\n');

    const agentData = await apiCall('getAgent');
    let totalByAgents = 0;

    if (agentData.result?.agent) {
        console.log(`  Jami agentlar: ${agentData.result.agent.length}\n`);

        for (const agent of agentData.result.agent) {
            const orderData = await apiCall('getOrder', { agentId: agent.SD_id });
            const count = orderData.result?.order?.length || 0;
            let sum = 0;
            if (orderData.result?.order) {
                orderData.result.order.forEach(o => sum += parseFloat(o.totalSumma) || 0);
            }
            totalByAgents += count;
            if (count > 0) {
                console.log(`  👤 ${agent.name.padEnd(25)} -> ${count} buyurtma, ${sum.toLocaleString()} UZS`);
            }
        }

        console.log(`\n  📊 Jami agentlar orqali: ${totalByAgents} ta buyurtma`);
    }

    // 4. SUPERVISOR ORQALI
    console.log('\n' + '='.repeat(70));
    console.log('📌 4. SUPERVISOR / TEAM ORQALI:\n');

    const supervisorMethods = ['getSupervisor', 'getTeam', 'getUser', 'getRole'];
    for (const method of supervisorMethods) {
        try {
            const data = await apiCall(method);
            if (data.status === true && data.result) {
                console.log(`  ✅ ${method}:`, JSON.stringify(data.result).substring(0, 200) + '...');
            }
        } catch (e) { }
    }

    // 5. XULOSA - HAQIQIY MA'LUMOT
    console.log('\n' + '='.repeat(70));
    console.log('📌 5. BUGUNGI BUYURTMALAR TAFSILOTLARI:\n');

    const todayOrders = await apiCall('getOrder', {
        dateFrom: '2026-02-05',
        dateTo: '2026-02-05'
    });

    if (todayOrders.result?.order) {
        const orders = todayOrders.result.order;
        let totalSum = 0;

        console.log(`  Bugungi buyurtmalar: ${orders.length}\n`);

        orders.slice(0, 10).forEach((o, i) => {
            const sum = parseFloat(o.totalSumma) || 0;
            totalSum += sum;
            console.log(`  ${i + 1}. ${o.orderNumber || '-'} | ${(o.priceType?.name || '-').padEnd(15)} | ${sum.toLocaleString().padStart(12)} UZS`);
        });

        console.log(`\n  💰 Bugungi umumiy: ${totalSum.toLocaleString()} UZS`);
    }
}

discoverAPI().catch(console.error);
