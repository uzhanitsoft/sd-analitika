/**
 * To'lovlar (Kirimlar) ma'lumotlarini to'g'ri olish
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

async function checkPayments() {
    console.log('💵 TO\'LOVLAR (KIRIMLAR) TEKSHIRISH\n');

    const auth = await freshLogin();
    console.log(`✅ Login: ${auth.userId}\n`);

    // 1. To'lovlarni olish - bugungi sana uchun
    console.log('📌 1. BARCHA TO\'LOVLAR:\n');

    // Bugungi sana
    const today = '2026-02-05';

    // Turli parametrlarni tekshirish
    const params = [
        { name: 'Oddiy', params: {} },
        { name: 'limit: 1000', params: { limit: 1000 } },
        { name: 'Bugungi', params: { dateFrom: today, dateTo: today } },
        { name: 'Period', params: { period: { dateFrom: today, dateTo: today } } },
        { name: 'filter.date', params: { filter: { dateFrom: today, dateTo: today } } },
    ];

    for (const p of params) {
        const data = await apiCall(auth, 'getPayment', p.params);
        const payments = data.result?.payment || [];
        console.log(`  ${p.name.padEnd(20)}: ${payments.length} ta`);
    }

    // 2. Bugungi to'lovlar detali
    console.log('\n' + '='.repeat(60));
    console.log('📌 2. BUGUNGI TO\'LOVLAR DETALI:\n');

    const allPaymentsRes = await apiCall(auth, 'getPayment', { limit: 2000 });
    const allPayments = allPaymentsRes.result?.payment || [];

    // Bugungi to'lovlarni filtrlash
    const todayPayments = allPayments.filter(p => {
        const date = (p.paymentDate || '').split(' ')[0];
        return date === today;
    });

    console.log(`  Jami to'lovlar: ${allPayments.length}`);
    console.log(`  Bugungi to'lovlar: ${todayPayments.length}\n`);

    // Sposob oplata bo'yicha gruppalash
    const byType = {};
    todayPayments.forEach(p => {
        const typeId = p.paymentType?.SD_id || 'unknown';
        const typeName = p.paymentType?.name || 'Noma\'lum';
        const key = `${typeId}: ${typeName}`;

        if (!byType[key]) {
            byType[key] = { count: 0, sum: 0 };
        }
        byType[key].count++;
        byType[key].sum += parseFloat(p.amount) || 0;
    });

    console.log('  Sposob oplata bo\'yicha:');
    for (const [type, data] of Object.entries(byType)) {
        console.log(`    ${type}: ${data.count} ta, ${data.sum.toLocaleString()}`);
    }

    // 3. Birinchi to'lov strukturasi
    if (todayPayments[0]) {
        console.log('\n' + '='.repeat(60));
        console.log('📌 3. BIRINCHI TO\'LOV STRUKTURASI:\n');
        Object.keys(todayPayments[0]).forEach(key => {
            console.log(`  ${key}: ${JSON.stringify(todayPayments[0][key])}`);
        });
    }

    // 4. Umumiy hisoblar
    console.log('\n' + '='.repeat(60));
    console.log('📌 4. UMUMIY HISOBLAR:\n');

    let totalUZS = 0;
    let totalUSD = 0;

    todayPayments.forEach(p => {
        const amount = parseFloat(p.amount) || 0;
        const typeId = p.paymentType?.SD_id;

        if (typeId === 'd0_4') {
            totalUSD += amount;
        } else {
            totalUZS += amount;
        }
    });

    console.log(`  💵 Bugungi kiritmalar UZS: ${totalUZS.toLocaleString()} so'm`);
    console.log(`  💲 Bugungi kiritmalar USD: ${totalUSD.toLocaleString()} $`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ YAKUNLANDI\n');
}

checkPayments().catch(console.error);
