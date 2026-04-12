/**
 * Sales Doctor - Kengaytirilgan API tekshiruv
 */

const fetch = require('node-fetch');

const serverUrl = 'https://rafiq.salesdoc.io/api/v2/';
const userId = 'd0_67';
const token = '460e6b260534c4b7d005fea460d5feda';

async function checkExtended() {
    console.log('📊 Kengaytirilgan API tekshiruv...\n');

    // 1. Uzoq davr uchun buyurtmalar
    console.log('='.repeat(60));
    console.log('📦 BUYURTMALAR (uzun davr uchun)');
    console.log('='.repeat(60));

    const ordersRes = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            auth: { userId, token },
            method: 'getOrder',
            params: {
                dateFrom: '2020-01-01',
                dateTo: '2026-12-31'
            }
        })
    });
    const ordersData = await ordersRes.json();

    if (ordersData.result?.order) {
        const orders = ordersData.result.order;
        console.log(`Jami buyurtmalar: ${orders.length}`);

        let totalSum = 0;
        let totalUSD = 0;

        // Valyuta bo'yicha gruppalash
        const byCurrency = {};

        orders.forEach(order => {
            const priceTypeId = order.priceType?.SD_id || 'unknown';
            if (!byCurrency[priceTypeId]) {
                byCurrency[priceTypeId] = { count: 0, sum: 0 };
            }
            byCurrency[priceTypeId].count++;
            byCurrency[priceTypeId].sum += parseFloat(order.totalSumma) || 0;

            totalSum += parseFloat(order.totalSumma) || 0;
        });

        console.log('\nNarx turi bo\'yicha:');
        for (const [priceType, data] of Object.entries(byCurrency)) {
            console.log(`  ${priceType}: ${data.count} ta buyurtma, ${data.sum.toLocaleString()} summa`);
        }

        console.log(`\n💰 UMUMIY JAMI: ${totalSum.toLocaleString()}`);
    }

    // 2. Valyutalar ro'yxati
    console.log('\n' + '='.repeat(60));
    console.log('💱 VALYUTALAR (getPaymentType)');
    console.log('='.repeat(60));

    const currRes = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            auth: { userId, token },
            method: 'getPaymentType',
            params: {}
        })
    });
    const currData = await currRes.json();

    if (currData.result?.currency) {
        currData.result.currency.forEach(c => {
            console.log(`${c.SD_id}: ${c.name} (${c.short}) - ${c.active === 'Y' ? 'Faol' : 'Nofaol'}`);
        });
    }

    // 3. Narx turlari
    console.log('\n' + '='.repeat(60));
    console.log('💵 NARX TURLARI (getPriceType)');
    console.log('='.repeat(60));

    const priceRes = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            auth: { userId, token },
            method: 'getPriceType',
            params: {}
        })
    });
    const priceData = await priceRes.json();

    if (priceData.result?.priceType) {
        priceData.result.priceType.forEach(p => {
            console.log(`${p.SD_id}: ${p.name} - ${p.active === 'Y' ? 'Faol' : 'Nofaol'}`);
        });
    }

    // 4. Bitta order to'liq strukturasi
    console.log('\n' + '='.repeat(60));
    console.log('📋 BIRINCHI BUYURTMA TO\'LIQ STRUKTURA');
    console.log('='.repeat(60));

    if (ordersData.result?.order?.[0]) {
        console.log(JSON.stringify(ordersData.result.order[0], null, 2));
    }
}

checkExtended().catch(console.error);
