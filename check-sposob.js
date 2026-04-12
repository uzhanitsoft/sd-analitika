/**
 * Sposob oplata va to'liq ma'lumotlarni tekshirish
 */

const fetch = require('node-fetch');

const serverUrl = 'https://rafiq.salesdoc.io/api/v2/';
const auth = { userId: 'd0_67', token: 'd6f8317c859f080fcf33cb31aa5f8d91' };

async function apiCall(method, params = {}) {
    const res = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth, method, params })
    });
    return res.json();
}

async function checkAll() {
    console.log('📊 TO\'LIQ MA\'LUMOTLARNI TEKSHIRISH\n');
    console.log('='.repeat(70));

    // 1. Sposob oplata (to'lov usullari)
    console.log('\n📌 1. TO\'LOV USULLARI (getPaymentType, getSposobOplata, etc.):\n');

    const payMethods = ['getPaymentType', 'getPaymentMethod', 'getSposobOplata',
        'getCurrency', 'getValuta', 'getPaymentOption'];

    for (const method of payMethods) {
        try {
            const data = await apiCall(method);
            if (data.status === true && data.result) {
                console.log(`  ✅ ${method}:`);
                console.log(`     ${JSON.stringify(data.result).substring(0, 500)}`);
            }
        } catch (e) { }
    }

    // 2. Mijozlar - pagination bilan
    console.log('\n' + '='.repeat(70));
    console.log('📌 2. MIJOZLAR (BARCHA SAHIFALAR):\n');

    let allClients = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 10) {
        const data = await apiCall('getClient', { page, limit: 1000 });
        if (data.result?.client?.length > 0) {
            console.log(`  Sahifa ${page}: ${data.result.client.length} ta`);
            allClients = allClients.concat(data.result.client);
            if (data.result.client.length < 1000) hasMore = false;
            else page++;
        } else {
            hasMore = false;
        }
    }
    console.log(`  ✅ Jami mijozlar: ${allClients.length}`);

    // 3. Mahsulotlar - pagination bilan
    console.log('\n' + '='.repeat(70));
    console.log('📌 3. MAHSULOTLAR (BARCHA SAHIFALAR):\n');

    let allProducts = [];
    page = 1;
    hasMore = true;

    while (hasMore && page <= 10) {
        const data = await apiCall('getProduct', { page, limit: 1000 });
        if (data.result?.product?.length > 0) {
            console.log(`  Sahifa ${page}: ${data.result.product.length} ta`);
            allProducts = allProducts.concat(data.result.product);
            if (data.result.product.length < 1000) hasMore = false;
            else page++;
        } else {
            hasMore = false;
        }
    }
    console.log(`  ✅ Jami mahsulotlar: ${allProducts.length}`);

    // 4. Buyurtmalardagi "sposob oplata" maydonini tekshirish
    console.log('\n' + '='.repeat(70));
    console.log('📌 4. BUYURTMALARDAGI TO\'LOV USULI MAYDONI:\n');

    const ordersRes = await apiCall('getOrder', { filter: { status: 'all' }, limit: 100 });
    const orders = ordersRes.result?.order || [];

    if (orders[0]) {
        console.log('  Birinchi buyurtma maydonlari:');
        const keys = Object.keys(orders[0]);
        keys.forEach(key => {
            if (key.toLowerCase().includes('pay') ||
                key.toLowerCase().includes('oplat') ||
                key.toLowerCase().includes('currency') ||
                key.toLowerCase().includes('sposob') ||
                key.toLowerCase().includes('valyut')) {
                console.log(`    📍 ${key}: ${JSON.stringify(orders[0][key])}`);
            }
        });

        console.log('\n  Barcha maydonlar:');
        keys.forEach(key => {
            const val = orders[0][key];
            if (typeof val !== 'object' || val === null) {
                console.log(`    ${key}: ${val}`);
            } else {
                console.log(`    ${key}: ${JSON.stringify(val)}`);
            }
        });
    }

    // 5. Balans/Qarzdorlik - sposob oplata bo'yicha
    console.log('\n' + '='.repeat(70));
    console.log('📌 5. QARZDORLIK (getBalance):\n');

    const balanceRes = await apiCall('getBalance', { limit: 100 });
    const balances = balanceRes.result?.balance || [];

    console.log(`  Jami balance yozuvlar: ${balances.length}`);

    if (balances[0]) {
        console.log('\n  Birinchi balance yozuvi:');
        Object.keys(balances[0]).forEach(key => {
            console.log(`    ${key}: ${JSON.stringify(balances[0][key])}`);
        });
    }

    // Balance bo'yicha gruppalash
    const byType = {};
    balances.forEach(b => {
        const sposob = b.sposobOplata?.name || b.paymentType?.name || b.currency || 'unknown';
        if (!byType[sposob]) {
            byType[sposob] = { count: 0, debt: 0 };
        }
        byType[sposob].count++;
        byType[sposob].debt += parseFloat(b.balance) || 0;
    });

    console.log('\n  Sposob oplata bo\'yicha:');
    for (const [type, data] of Object.entries(byType)) {
        console.log(`    ${type}: ${data.count} ta, qarzdorlik: ${data.debt.toLocaleString()}`);
    }

    // 6. To'lovlar - sposob oplata bo'yicha
    console.log('\n' + '='.repeat(70));
    console.log('📌 6. TO\'LOVLAR (getPayment):\n');

    const paymentRes = await apiCall('getPayment', { limit: 100 });
    const payments = paymentRes.result?.payment || [];

    console.log(`  Jami to'lov yozuvlar: ${payments.length}`);

    if (payments[0]) {
        console.log('\n  Birinchi to\'lov yozuvi:');
        Object.keys(payments[0]).forEach(key => {
            console.log(`    ${key}: ${JSON.stringify(payments[0][key])}`);
        });
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ TEKSHIRISH YAKUNLANDI\n');
}

checkAll().catch(console.error);
