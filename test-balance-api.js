// Foyda hisoblash to'g'riligini tekshirish
const fetch = require('node-fetch');

async function main() {
    const serverUrl = 'https://rafiq.salesdoc.io/api/v2/';
    const USD_RATE = 12800;

    const loginRes = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            method: 'login',
            auth: { login: 'admin', password: '1234567rafiq' }
        })
    });
    const loginData = await loginRes.json();
    const auth = { userId: loginData.result.userId, token: loginData.result.token };
    console.log(`✅ Login: userId=${auth.userId}\n`);

    // Tan narxlarni olish
    console.log('📋 Tan narxlarni yuklash...');
    const costPrices = {};
    for (let page = 1; page <= 10; page++) {
        const res = await fetch(serverUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                auth: auth,
                method: 'getPurchase',
                params: { page: page, limit: 500 }
            })
        });
        const data = await res.json();
        if (!data.result?.warehouse || data.result.warehouse.length === 0) break;

        data.result.warehouse.forEach(p => {
            (p.detail || []).forEach(item => {
                const rawPrice = parseFloat(item.price) || 0;
                if (rawPrice > 0) {
                    // > 100 = UZS, <= 100 = USD
                    const isUZS = rawPrice > 100;
                    const priceUZS = isUZS ? rawPrice : rawPrice * USD_RATE;

                    if (!costPrices[item.SD_id] || costPrices[item.SD_id].date < p.date) {
                        costPrices[item.SD_id] = { priceUZS, name: item.name, date: p.date };
                    }
                }
            });
        });
    }
    console.log(`   ✅ ${Object.keys(costPrices).length} ta mahsulot tan narxi\n`);

    // Bugungi buyurtmalarni olish
    console.log('📦 Buyurtmalarni yuklash...\n');

    let totalSalesUZS = 0;
    let totalProfitUZS = 0;
    let matchedCount = 0;
    let fallbackCount = 0;

    const today = '2026-02-06';

    for (let page = 1; page <= 5; page++) {
        const res = await fetch(serverUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                auth: auth,
                method: 'getOrder',
                params: { page: page, limit: 500, filter: { status: 'all', dateStart: today, dateEnd: today } }
            })
        });
        const data = await res.json();
        if (!data.result?.order || data.result.order.length === 0) break;

        data.result.order.forEach(order => {
            // Qaytarishlarni o'tkazib yuborish
            if (order.status === 4 || order.status === 5) return;

            const rawTotal = parseFloat(order.totalSumma) || 0;
            const orderSummaUZS = rawTotal > 100 ? rawTotal : rawTotal * USD_RATE;
            totalSalesUZS += orderSummaUZS;

            (order.orderProducts || []).forEach(item => {
                const productId = item.product?.SD_id;
                const quantity = parseFloat(item.quantity) || 0;
                const rawSumma = parseFloat(item.summa) || 0;
                const itemSummaUZS = rawSumma > 100 ? rawSumma : rawSumma * USD_RATE;

                const costData = costPrices[productId];
                const costPriceUZS = costData?.priceUZS || 0;

                if (costPriceUZS > 0) {
                    matchedCount++;
                    const totalCost = costPriceUZS * quantity;
                    const itemProfit = itemSummaUZS - totalCost;
                    totalProfitUZS += Math.max(0, itemProfit);
                } else {
                    fallbackCount++;
                    totalProfitUZS += itemSummaUZS; // Bonus - 100%
                }
            });
        });
    }

    console.log('═══════════════════════════════════════════════');
    console.log(`📊 BUGUNGI NATIJA (${today}):`);
    console.log(`   Jami sotuv: ${totalSalesUZS.toLocaleString()} so'm`);
    console.log(`   Jami foyda: ${totalProfitUZS.toLocaleString()} so'm`);
    console.log(`   Margin: ${(totalProfitUZS / totalSalesUZS * 100).toFixed(1)}%`);
    console.log(`   Matched: ${matchedCount}, Fallback (bonus): ${fallbackCount}`);
    console.log('═══════════════════════════════════════════════');
}

main().catch(console.error);
