const fetch = require('node-fetch');

const url = 'https://rafiq.salesdoc.io/api/v2/';
const auth = { userId: 'd0_67', token: '460e6b260534c4b7d005fea460d5feda' };

async function findBySale() {
    console.log('🔍 Trade va Sale metodlarini qidirish...\n');

    // Trade ID bo'yicha
    console.log('1️⃣ getOrder trade bilan:');
    for (let tradeId = 0; tradeId <= 5; tradeId++) {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ auth, method: 'getOrder', params: { tradeId: tradeId.toString() } })
        });
        const data = await res.json();
        const count = data.result?.order?.length || 0;
        if (count > 0) console.log(`   trade ${tradeId}: ${count} ta`);
    }

    // Type bo'yicha
    console.log('\n2️⃣ getOrder type bilan:');
    const types = ['order', 'sale', 'invoice', 'delivery', 'expedition', 'realization'];
    for (const type of types) {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ auth, method: 'getOrder', params: { type } })
        });
        const data = await res.json();
        const count = data.result?.order?.length || 0;
        if (count > 0) console.log(`   type=${type}: ${count} ta`);
    }

    // Expeditor orqali
    console.log('\n3️⃣ getExpeditor:');
    const expRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth, method: 'getExpeditor', params: {} })
    });
    const expData = await expRes.json();
    console.log(JSON.stringify(expData.result, null, 2).substring(0, 500));

    // Barcha mumkin bo'lgan "history" metodlari
    console.log('\n4️⃣ History metodlari:');
    const histMethods = ['getHistory', 'getOrdersHistory', 'getSalesHistory', 'getTradeHistory'];
    for (const method of histMethods) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ auth, method, params: {} })
            });
            const data = await res.json();
            if (data.status === true) {
                console.log(`   ✅ ${method} ishlaydi!`);
            }
        } catch (e) { }
    }
}

findBySale().catch(console.error);
