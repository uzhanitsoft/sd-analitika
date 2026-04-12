const fetch = require('node-fetch');
const url = 'https://rafiq.salesdoc.io/api/v2/';
const auth = { userId: 'd0_67', token: '460e6b260534c4b7d005fea460d5feda' };

async function test() {
    console.log('Status va limit bilan test:\n');

    // Status bo'yicha
    const statuses = [0, 1, 2, 3, 4, 5];
    for (let s of statuses) {
        const r = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ auth, method: 'getOrder', params: { status: s } })
        });
        const d = await r.json();
        const orders = d.result?.order || [];
        let sum = 0;
        orders.forEach(o => sum += o.totalSumma || 0);
        console.log(`Status ${s}: ${orders.length} buyurtma, ${sum.toLocaleString()} so'm`);
    }

    // Limit bilan
    const r2 = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth, method: 'getOrder', params: { limit: 10000 } })
    });
    const d2 = await r2.json();
    console.log(`\nLimit 10000: ${d2.result?.order?.length || 0} buyurtma`);

    // Page bilan
    for (let page = 1; page <= 3; page++) {
        const r3 = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ auth, method: 'getOrder', params: { page, perPage: 100 } })
        });
        const d3 = await r3.json();
        console.log(`Page ${page}: ${d3.result?.order?.length || 0} buyurtma`);
    }
}

test();
