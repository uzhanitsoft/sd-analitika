/**
 * YANGI LOGIN VA YANGI MA'LUMOT
 * Sales Doctor bilan bir xil ma'lumot olish uchun
 */

const fetch = require('node-fetch');
const serverUrl = 'https://rafiq.salesdoc.io/api/v2/';

async function freshAPICall() {
    console.log('🔄 YANGI LOGIN VA MA\'LUMOT OLISH\n');

    // 1. Yangi login
    console.log('='.repeat(70));
    console.log('📌 1. YANGI LOGIN:\n');

    const loginRes = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            method: 'login',
            auth: { login: 'admin', password: '1234567rafiq' }
        })
    });

    const loginData = await loginRes.json();
    console.log('  Login natijasi:', JSON.stringify(loginData.result, null, 2));

    if (!loginData.result) {
        console.log('  ❌ Login muvaffaqiyatsiz!');
        return;
    }

    const auth = loginData.result;
    console.log(`  ✅ userId: ${auth.userId}`);
    console.log(`  ✅ token: ${auth.token.substring(0, 20)}...`);

    // 2. Yangi to'lovlar so'rash
    console.log('\n' + '='.repeat(70));
    console.log('📌 2. YANGI TO\'LOVLAR:\n');

    const payRes = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            auth,
            method: 'getPayment',
            params: { limit: 1000 }
        })
    });

    const payData = await payRes.json();
    const payments = payData.result?.payment || [];
    console.log(`  Jami to'lovlar: ${payments.length}`);
    console.log(`  Pagination: ${JSON.stringify(payData.pagination)}`);

    // Eng yangi to'lov
    if (payments.length > 0) {
        const sorted = payments.sort((a, b) => {
            return new Date(b.paymentDate) - new Date(a.paymentDate);
        });
        console.log(`\n  Eng yangi to'lov: ${sorted[0].paymentDate}`);
        console.log(`  Eng eski to'lov: ${sorted[sorted.length - 1].paymentDate}`);

        // Fevral to'lovlari
        const febPayments = payments.filter(p => p.paymentDate?.startsWith('2026-02'));
        console.log(`\n  Fevral 2026 to'lovlari: ${febPayments.length} ta`);
    }

    // 3. Yangi balanslar
    console.log('\n' + '='.repeat(70));
    console.log('📌 3. YANGI BALANSLAR:\n');

    const balRes = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            auth,
            method: 'getBalance',
            params: { limit: 5000 }
        })
    });

    const balData = await balRes.json();
    const balances = balData.result?.balance || [];
    console.log(`  Jami balanslar: ${balances.length}`);
    console.log(`  Pagination: ${JSON.stringify(balData.pagination)}`);

    // Currency totals
    const currencyTotals = { 'd0_2': 0, 'd0_3': 0, 'd0_4': 0 };
    balances.forEach(b => {
        if (b['by-currency'] && Array.isArray(b['by-currency'])) {
            b['by-currency'].forEach(curr => {
                const amount = parseFloat(curr.amount) || 0;
                if (currencyTotals.hasOwnProperty(curr.currency_id)) {
                    currencyTotals[curr.currency_id] += amount;
                }
            });
        }
    });

    console.log(`\n  Naqd (d0_2): ${currencyTotals['d0_2'].toLocaleString()}`);
    console.log(`  Beznal (d0_3): ${currencyTotals['d0_3'].toLocaleString()}`);
    console.log(`  Dollar (d0_4): ${currencyTotals['d0_4'].toLocaleString()}`);

    // Sales Doctor qiymatlari
    console.log('\n' + '='.repeat(70));
    console.log('📌 SALES DOCTOR QIYMATLARI (screenshot):');
    console.log('  Qarzdorlik:');
    console.log('    Наличный Сум:    -664,381,350.52');
    console.log('    Безналичный Сум:  2,592,000');
    console.log('    Общий:           -662,084,430.48');
    console.log('\n  To\'lovlar:');
    console.log('    Наличный Сум:    178,060,817.54');
    console.log('    Безналичный Сум: 0');
    console.log('    Доллар США:      19,729.66');
    console.log('    Общий:           178,080,547.2');

    console.log('\n' + '='.repeat(70));
    console.log('✅ YAKUNLANDI\n');
}

freshAPICall().catch(console.error);
