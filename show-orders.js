const fetch = require('node-fetch');

async function showOrders() {
    const res = await fetch('https://rafiq.salesdoc.io/api/v2/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            auth: { userId: 'd0_67', token: '460e6b260534c4b7d005fea460d5feda' },
            method: 'getOrder',
            params: {}
        })
    });
    const data = await res.json();
    const orders = data.result?.order || [];

    console.log('📦 3 TA BUYURTMA:\n');
    orders.forEach((o, i) => {
        console.log(`${i + 1}. ID: ${o.SD_id}`);
        console.log(`   Sana: ${o.dateCreate}`);
        console.log(`   Mijoz: ${o.client?.clientName || o.client?.name || 'Noma\'lum'}`);
        console.log(`   Summa: ${o.totalSumma?.toLocaleString()} so'm`);
        console.log('');
    });
}

showOrders();
