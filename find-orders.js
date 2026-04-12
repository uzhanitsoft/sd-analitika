const fetch = require('node-fetch');

const url = 'https://rafiq.salesdoc.io/api/v2/';
const auth = { userId: 'd0_67', token: '460e6b260534c4b7d005fea460d5feda' };

async function findAllOrders() {
    console.log('🔍 Barcha statusdagi buyurtmalarni qidirish...\n');

    // 1. Turli statuslar bilan sinash
    const statusParams = [
        { status: 'new' },
        { status: 'delivered' },
        { status: 'completed' },
        { status: 'all' },
        { statusId: 1 },
        { statusId: 2 },
        { statusId: 3 },
        { statusId: 4 },
        { type: 'order' },
        { type: 'sale' },
        { type: 'all' },
        { orderType: 'all' },
        { includeDelivered: true },
        { includeCompleted: true },
        { showAll: true },
        {},
    ];

    for (const params of statusParams) {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ auth, method: 'getOrder', params })
        });
        const data = await res.json();
        const count = data.result?.order?.length || 0;
        if (count > 3) {
            console.log(`✅ ${JSON.stringify(params)}: ${count} ta buyurtma!`);
        }
    }

    // 2. getSale yoki boshqa metodlar
    console.log('\n📦 Boshqa metodlar:');
    const methods = ['getSale', 'getSales', 'getDelivery', 'getDelivered', 'getInvoice', 'getDocument'];

    for (const method of methods) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ auth, method, params: {} })
            });
            const data = await res.json();
            if (data.status === true) {
                console.log(`✅ ${method} - ISHLAYDI!`);
                console.log(`   Keys: ${Object.keys(data.result || {}).join(', ')}`);
            }
        } catch (e) { }
    }

    // 3. getOrder bilan boshqa parametrlar
    console.log('\n📋 Keng parametrlar:');
    const extParams = [
        { dateFrom: '2026-01-01', dateTo: '2026-12-31' },
        { period: { from: '2026-01-01', to: '2026-12-31' } },
        { limit: 1000 },
        { page: 1, perPage: 1000 },
    ];

    for (const params of extParams) {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ auth, method: 'getOrder', params })
        });
        const data = await res.json();
        const count = data.result?.order?.length || 0;
        console.log(`${JSON.stringify(params)}: ${count} ta`);
    }
}

findAllOrders().catch(console.error);
