const fetch = require('node-fetch');

const url = 'https://rafiq.salesdoc.io/api/v2/';
const auth = { userId: 'd0_67', token: '460e6b260534c4b7d005fea460d5feda' };

async function findDelivered() {
    console.log('🔍 Yetkazilgan buyurtmalarni qidirish...\n');

    // Sales Doctor API metodlari - yetkazib berish uchun
    const methods = [
        'getDeliveredOrder',
        'getCompletedOrder',
        'getClosedOrder',
        'getFinishedOrder',
        'getOrderHistory',
        'getOrderArchive',
        'getAllOrder',
        'getOrderList',
        'getOrdersFull',
        'getTrade',
        'getTrades',
        'getTrading',
        'getSelling',
        'getDocumentOrder',
        'getRealization',
        'getRealizationOrder',
        'getExpeditor',
        'getExpedition',
        'getShipment',
        'getDispatch'
    ];

    console.log('Ishlaydigan metodlar:');
    for (const method of methods) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ auth, method, params: {} })
            });
            const data = await res.json();
            if (data.status === true) {
                console.log(`\n✅ ${method}:`);
                console.log(`   Keys: ${Object.keys(data.result || {}).join(', ')}`);
                const firstKey = Object.keys(data.result || {})[0];
                if (firstKey && Array.isArray(data.result[firstKey])) {
                    console.log(`   ${firstKey}: ${data.result[firstKey].length} ta`);
                }
            }
        } catch (e) { }
    }

    // getOrder bilan order statuslari
    console.log('\n\n📊 getOrder bitta buyurtma strukturasini ko\'rish:');
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth, method: 'getOrder', params: {} })
    });
    const data = await res.json();
    if (data.result?.order?.[0]) {
        const order = data.result.order[0];
        console.log('Buyurtma kalitlari:', Object.keys(order).join(', '));
        console.log('Status:', order.status);
        console.log('Trade:', JSON.stringify(order.trade));
    }
}

findDelivered().catch(console.error);
