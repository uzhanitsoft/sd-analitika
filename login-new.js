/**
 * TO'LIQ MA'LUMOT OLISH - Barcha mumkin bo'lgan yo'llar
 */
const fetch = require('node-fetch');
const serverUrl = 'https://rafiq.salesdoc.io/api/v2/';
const auth = { userId: 'd0_67', token: '460e6b260534c4b7d005fea460d5feda' };

async function api(method, params = {}) {
    const res = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth, method, params })
    });
    return res.json();
}

async function findFullAccess() {
    console.log('🔍 TO\'LIQ MA\'LUMOT OLISH YO\'LLARINI QIDIRISH\n');
    console.log('='.repeat(70));

    // 1. Barcha mavjud supervisor va role lar
    console.log('\n📌 1. BARCHA SUPERVISORLAR VA AGENTLAR:\n');
    const supData = await api('getSupervisor');
    let allAgentIds = [];

    if (supData.result?.supervisor) {
        for (const sup of supData.result.supervisor) {
            console.log(`👔 ${sup.name} (${sup.SD_id})`);
            if (sup.agents) {
                sup.agents.forEach(a => {
                    console.log(`   └─ ${a.name} (${a.SD_id})`);
                    allAgentIds.push(a.SD_id);
                });
            }
        }
    }

    // 2. Barcha agentlar (supervisor tashqarisidagilar ham)
    console.log('\n📌 2. BARCHA AGENTLAR (28 ta):\n');
    const agentData = await api('getAgent');
    if (agentData.result?.agent) {
        agentData.result.agent.forEach(a => {
            if (!allAgentIds.includes(a.SD_id)) {
                console.log(`   👤 ${a.name} (${a.SD_id}) - Supervisorsiz`);
                allAgentIds.push(a.SD_id);
            }
        });
        console.log(`   Jami: ${allAgentIds.length} ta agent`);
    }

    // 3. Har bir agent buyurtmalarini olish
    console.log('\n📌 3. HAR BIR AGENT BUYURTMALARI:\n');
    let totalOrders = 0;
    let totalSum = 0;

    for (const agentId of allAgentIds.slice(0, 5)) { // Birinchi 5 ta
        const orderData = await api('getOrder', { agentId: agentId });
        if (orderData.result?.order) {
            const count = orderData.result.order.length;
            let sum = 0;
            orderData.result.order.forEach(o => sum += parseFloat(o.totalSumma) || 0);
            totalOrders += count;
            totalSum += sum;
            console.log(`   ${agentId}: ${count} buyurtma, ${sum.toLocaleString()} UZS`);
        }
    }

    // 4. Scope parametrlari bilan sinash
    console.log('\n📌 4. TURLI SCOPE PARAMETRLARI:\n');
    const scopeParams = [
        { scope: 'all' },
        { scope: 'company' },
        { scope: 'full' },
        { allData: true },
        { fullAccess: true },
        { role: 'admin' },
        { role: 'administrator' },
        { viewAll: true },
        { includeAll: true },
        { filter: { all: true } },
        { territory: 'all' },
        { region: 'all' },
    ];

    for (const params of scopeParams) {
        const data = await api('getOrder', params);
        const count = data.result?.order?.length || 0;
        if (count > 0) {
            console.log(`   ✅ ${JSON.stringify(params)} -> ${count} ta buyurtma`);
        }
    }

    // 5. Boshqa API endpointlar
    console.log('\n📌 5. BOSHQA ENDPOINT LAR:\n');
    const endpoints = [
        'getOrderAll', 'getAllOrders', 'getFullOrders',
        'getCompanyOrders', 'getReportOrders', 'orderReport',
        'getSalesReport', 'getDailySales', 'getCompanySales'
    ];

    for (const method of endpoints) {
        const data = await api(method);
        if (data.status === true) {
            console.log(`   ✅ ${method} -> ishladi!`);
        }
    }

    // 6. To'lovlar va Balans orqali hisoblash
    console.log('\n📌 6. TO\'LOVLAR VA BALANS ORQALI UMUMIY SOTUV:\n');

    const payData = await api('getPayment');
    const balData = await api('getBalance');

    let totalPayments = 0;
    let totalDebt = 0;

    if (payData.result?.payment) {
        payData.result.payment.forEach(p => totalPayments += parseFloat(p.amount) || 0);
        console.log(`   💳 Jami to'lovlar: ${totalPayments.toLocaleString()} UZS`);
    }

    if (balData.result?.balance) {
        balData.result.balance.forEach(b => {
            if ((b.balance || 0) < 0) totalDebt += Math.abs(b.balance);
        });
        console.log(`   📋 Jami qarzdorlik: ${totalDebt.toLocaleString()} UZS`);
    }

    console.log(`\n   📊 TAXMINIY JAMI SOTUV: ${(totalPayments + totalDebt).toLocaleString()} UZS`);

    console.log('\n' + '='.repeat(70));
    console.log('XULOSA: To\'liq buyurtma ma\'lumoti uchun Administrator roli kerak');
    console.log('Hozircha mavjud: To\'lovlar + Qarzdorlik = Taxminiy sotuv');
}

findFullAccess().catch(console.error);
