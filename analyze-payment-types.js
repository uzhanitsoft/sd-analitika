/**
 * VALYUTA ID LARNI ANIQLASH
 * Sales Doctor qanday kategoriyalash qilayotganini topish
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

async function analyzePaymentTypes() {
    console.log('🔍 TO\'LOV TURLARINI TAHLIL QILISH\n');

    const auth = await freshLogin();
    console.log(`✅ Login: ${auth.userId}\n`);

    // 1. To'lovlarni olish
    const paymentData = await apiCall(auth, 'getPayment', { limit: 1000 });
    const payments = paymentData.result?.payment || [];
    console.log(`📊 Jami to'lovlar: ${payments.length}\n`);

    // 2. To'lov turlarini tahlil qilish
    console.log('='.repeat(70));
    console.log('📌 TO\'LOV TURLARI (paymentType):\n');

    const paymentTypes = {};
    payments.forEach(p => {
        const typeId = p.paymentType?.SD_id || 'unknown';
        const typeName = p.paymentType?.name || 'Noma\'lum';
        const amount = parseFloat(p.amount) || 0;

        if (!paymentTypes[typeId]) {
            paymentTypes[typeId] = { name: typeName, count: 0, total: 0 };
        }
        paymentTypes[typeId].count++;
        paymentTypes[typeId].total += amount;
    });

    for (const [id, data] of Object.entries(paymentTypes)) {
        console.log(`  ${id.padEnd(15)}: ${data.name.padEnd(25)} - ${data.count} ta, ${data.total.toLocaleString()}`);
    }

    // 3. Balanslarni valyuta bo'yicha batafsil ko'rish
    console.log('\n' + '='.repeat(70));
    console.log('📌 BALANSLARDAGI CURRENCY_ID TAHLILI:\n');

    const balanceData = await apiCall(auth, 'getBalance', { limit: 5000 });
    const balances = balanceData.result?.balance || [];

    const currencyBreakdown = {};
    balances.forEach(b => {
        if (b['by-currency'] && Array.isArray(b['by-currency'])) {
            b['by-currency'].forEach(curr => {
                const id = curr.currency_id;
                const amount = parseFloat(curr.amount) || 0;
                if (!currencyBreakdown[id]) {
                    currencyBreakdown[id] = { count: 0, total: 0, positive: 0, negative: 0 };
                }
                currencyBreakdown[id].count++;
                currencyBreakdown[id].total += amount;
                if (amount > 0) currencyBreakdown[id].positive += amount;
                if (amount < 0) currencyBreakdown[id].negative += amount;
            });
        }
    });

    console.log('  Currency ID  | Count  | Total               | Positive           | Negative');
    console.log('  ' + '-'.repeat(90));
    for (const [id, data] of Object.entries(currencyBreakdown)) {
        console.log(`  ${id.padEnd(12)} | ${data.count.toString().padStart(6)} | ${data.total.toLocaleString().padStart(18)} | ${data.positive.toLocaleString().padStart(18)} | ${data.negative.toLocaleString().padStart(18)}`);
    }

    // 4. Sales Doctor qiymatlari bilan solishtirish
    console.log('\n' + '='.repeat(70));
    console.log('📌 SALES DOCTOR BILAN SOLISHTIRISH:\n');

    // SD qiymatlari (screenshot'dan)
    const sdNaqd = -664381350.52;
    const sdBeznal = 2592000;
    const sdDollar = -295079.96;
    const sdTotal = -662084430.48;

    // Bizning qiymatlarimiz
    const ourNaqd = currencyBreakdown['d0_2']?.total || 0;
    const ourBeznal = currencyBreakdown['d0_3']?.total || 0;
    const ourDollar = currencyBreakdown['d0_4']?.total || 0;
    const ourTotal = balances.reduce((sum, b) => sum + (parseFloat(b.balance) || 0), 0);

    console.log('                   | Sales Doctor        | Our API             | Farq');
    console.log('  ' + '-'.repeat(75));
    console.log(`  Наличный Сум     | ${sdNaqd.toLocaleString().padStart(18)} | ${ourNaqd.toLocaleString().padStart(18)} | ${(ourNaqd - sdNaqd).toLocaleString().padStart(18)}`);
    console.log(`  Безналичный Сум  | ${sdBeznal.toLocaleString().padStart(18)} | ${ourBeznal.toLocaleString().padStart(18)} | ${(ourBeznal - sdBeznal).toLocaleString().padStart(18)}`);
    console.log(`  Доллар США       | ${sdDollar.toLocaleString().padStart(18)} | ${ourDollar.toLocaleString().padStart(18)} | ${(ourDollar - sdDollar).toLocaleString().padStart(18)}`);
    console.log(`  Общий (сум)      | ${sdTotal.toLocaleString().padStart(18)} | ${ourTotal.toLocaleString().padStart(18)} | ${(ourTotal - sdTotal).toLocaleString().padStart(18)}`);

    // 5. Naqd va Beznal orasidagi farq - ~9 million
    console.log('\n📌 MUHIM TOPILMA:');
    console.log(`  Naqd farq:   ${(ourNaqd - sdNaqd).toLocaleString()} (biz ko'proq minus ko'rsatyapmiz)`);
    console.log(`  Beznal farq: ${(ourBeznal - sdBeznal).toLocaleString()} (biz ko'proq plus ko'rsatyapmiz)`);
    console.log(`  JAMI FARQ:   ${((ourNaqd - sdNaqd) + (ourBeznal - sdBeznal)).toLocaleString()}`);
    console.log(`  Общий farq:  ${(ourTotal - sdTotal).toLocaleString()} (deyarli 0!)`);

    console.log('\n' + '='.repeat(70));
    console.log('✅ YAKUNLANDI\n');
}

analyzePaymentTypes().catch(console.error);
