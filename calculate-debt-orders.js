/**
 * Qarzdorlikni BUYURTMALAR va TO'LOVLAR asosida hisoblash
 * Bu eng aniq usul!
 */

const fetch = require('node-fetch');

const serverUrl = 'https://rafiq.salesdoc.io/api/v2/';

async function freshLogin() {
    const res = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            method: 'login',
            auth: { login: 'admin', password: '1234567rafiq' }
        })
    });
    const data = await res.json();
    return data.result;
}

async function apiCall(auth, method, params = {}) {
    const res = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth, method, params })
    });
    return res.json();
}

// Pagination bilan barcha ma'lumotlarni olish
async function fetchAll(auth, method, key, maxPages = 50) {
    let allData = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= maxPages) {
        const data = await apiCall(auth, method, { page, limit: 1000 });
        const items = data.result?.[key] || [];

        if (items.length > 0) {
            allData = allData.concat(items);
            console.log(`  ${method} page ${page}: ${items.length} ta (jami: ${allData.length})`);
            if (items.length < 1000) hasMore = false;
            else page++;
        } else {
            hasMore = false;
        }
    }

    return allData;
}

async function calculateDebtFromOrdersPayments() {
    console.log('🔍 QARZDORLIKNI BUYURTMALAR VA TO\'LOVLAR ASOSIDA HISOBLASH\n');

    const auth = await freshLogin();
    console.log(`✅ Login: ${auth.userId}\n`);

    // 1. Barcha buyurtmalarni olish
    console.log('='.repeat(60));
    console.log('📌 1. BARCHA BUYURTMALARNI YUKLASH:\n');
    const allOrders = await fetchAll(auth, 'getOrder', 'order');
    console.log(`\n  Jami buyurtmalar: ${allOrders.length}\n`);

    // 2. Barcha to'lovlarni olish
    console.log('='.repeat(60));
    console.log('📌 2. BARCHA TO\'LOVLARNI YUKLASH:\n');
    const allPayments = await fetchAll(auth, 'getPayment', 'payment');
    console.log(`\n  Jami to'lovlar: ${allPayments.length}\n`);

    // 3. Buyurtmalar summasini hisoblash (valyuta bo'yicha)
    console.log('='.repeat(60));
    console.log('📌 3. BUYURTMALAR SUMMASI (SOTUVLAR):\n');

    const orderTotals = {
        'UZS': 0,
        'USD': 0,
        'unknown': 0
    };

    allOrders.forEach(order => {
        const total = parseFloat(order.total) || 0;
        const priceType = order.priceType;

        // Valyuta aniqlash - priceType dan
        if (priceType?.currency_id === 'd0_4' || priceType?.name?.toLowerCase().includes('dollar')) {
            orderTotals['USD'] += total;
        } else {
            orderTotals['UZS'] += total;
        }
    });

    console.log(`  So'm buyurtmalar:   ${orderTotals['UZS'].toLocaleString()}`);
    console.log(`  Dollar buyurtmalar: ${orderTotals['USD'].toLocaleString()}`);

    // 4. To'lovlar summasini hisoblash (valyuta bo'yicha)
    console.log('\n' + '='.repeat(60));
    console.log('📌 4. TO\'LOVLAR SUMMASI:\n');

    const paymentTotals = {
        'd0_2': 0,  // Naqd so'm
        'd0_3': 0,  // Beznal so'm
        'd0_4': 0,  // Dollar
        'd0_5': 0,  // Clic
        'unknown': 0
    };

    allPayments.forEach(payment => {
        const amount = parseFloat(payment.amount) || 0;
        const paymentTypeId = payment.paymentType?.SD_id;

        if (paymentTotals.hasOwnProperty(paymentTypeId)) {
            paymentTotals[paymentTypeId] += amount;
        } else {
            paymentTotals['unknown'] += amount;
        }
    });

    const totalPaymentsUZS = paymentTotals['d0_2'] + paymentTotals['d0_3'] + paymentTotals['d0_5'];
    const totalPaymentsUSD = paymentTotals['d0_4'];

    console.log(`  Naqd so'm:    ${paymentTotals['d0_2'].toLocaleString()}`);
    console.log(`  Beznal so'm:  ${paymentTotals['d0_3'].toLocaleString()}`);
    console.log(`  Dollar:       ${paymentTotals['d0_4'].toLocaleString()}`);
    console.log(`  Clic:         ${paymentTotals['d0_5'].toLocaleString()}`);
    console.log(`  Noma'lum:     ${paymentTotals['unknown'].toLocaleString()}`);
    console.log(`\n  Jami so'm:    ${totalPaymentsUZS.toLocaleString()}`);
    console.log(`  Jami dollar:  ${totalPaymentsUSD.toLocaleString()}`);

    // 5. Qarzdorlik hisoblash
    console.log('\n' + '='.repeat(60));
    console.log('📌 5. QARZDORLIK = SOTUVLAR - TO\'LOVLAR:\n');

    const debtUZS = orderTotals['UZS'] - totalPaymentsUZS;
    const debtUSD = orderTotals['USD'] - totalPaymentsUSD;

    console.log(`  So'm qarzdorlik:    ${debtUZS.toLocaleString()}`);
    console.log(`  Dollar qarzdorlik:  ${debtUSD.toLocaleString()}`);

    // 6. getBalance bilan solishtirish
    console.log('\n' + '='.repeat(60));
    console.log('📌 6. GETBALANCE BILAN SOLISHTIRISH:\n');

    const balanceData = await apiCall(auth, 'getBalance', { limit: 10000 });
    const balances = balanceData.result?.balance || [];

    let balanceSum = 0;
    balances.forEach(b => {
        balanceSum += parseFloat(b.balance) || 0;
    });

    console.log(`  getBalance jami:    ${balanceSum.toLocaleString()}`);
    console.log(`  Hisoblangan qarz:   ${debtUZS.toLocaleString()}`);

    // 7. Sales Doctor bilan solishtirish
    console.log('\n' + '='.repeat(60));
    console.log('📌 7. SALES DOCTOR BILAN SOLISHTIRISH:\n');

    const sdValues = {
        'cash': -762381350.52,
        'beznal': 2592000,
        'usd': -295079.96,
        'overall': -760084430.48
    };

    console.log('  Valyuta         | Sales Doctor        | Hisoblangan');
    console.log('  ' + '-'.repeat(60));
    console.log(`  Umumiy (so'm)   | ${sdValues.overall.toLocaleString().padStart(18)} | ${debtUZS.toLocaleString().padStart(18)}`);
    console.log(`  Dollar          | ${sdValues.usd.toLocaleString().padStart(18)} | ${debtUSD.toLocaleString().padStart(18)}`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ YAKUNLANDI\n');
}

calculateDebtFromOrdersPayments().catch(console.error);
