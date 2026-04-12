/**
 * BUGUNGI SANA UCHUN TO'LOVLAR - period filter bilan
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

async function getPaymentsWithDate() {
    console.log('🔍 SANA FILTRI BILAN TO\'LOVLAR\n');

    const auth = await freshLogin();
    console.log(`✅ Login: ${auth.userId}\n`);

    // Bugungi sana
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // 2026-02-05

    // Oyning boshi
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthStartStr = monthStart.toISOString().split('T')[0];

    // Yilning boshi
    const yearStart = new Date(today.getFullYear(), 0, 1);
    const yearStartStr = yearStart.toISOString().split('T')[0];

    console.log(`  Bugun: ${todayStr}`);
    console.log(`  Oy boshi: ${monthStartStr}`);
    console.log(`  Yil boshi: ${yearStartStr}\n`);

    // 1. Filtrsiz
    console.log('='.repeat(70));
    console.log('📌 1. FILTRSIZ TO\'LOVLAR:\n');
    const data1 = await apiCall(auth, 'getPayment', { limit: 5000 });
    console.log(`  Jami: ${data1.result?.payment?.length || 0} ta`);
    if (data1.result?.payment) {
        let sum = 0;
        data1.result.payment.forEach(p => sum += parseFloat(p.amount) || 0);
        console.log(`  Jami summa: ${sum.toLocaleString()}`);
    }

    // 2. period parametri bilan
    console.log('\n' + '='.repeat(70));
    console.log('📌 2. PERIOD PARAMETRI BILAN:\n');

    const periodParams = [
        { period: { from: todayStr, to: todayStr } },
        { period: { dateFrom: todayStr, dateTo: todayStr } },
        { period: { start: todayStr, end: todayStr } },
        { dateFrom: todayStr, dateTo: todayStr },
        { from: todayStr, to: todayStr },
        { date: todayStr },
        { paymentDate: todayStr },
        { period: { from: monthStartStr, to: todayStr } },
        { filter: { dateFrom: monthStartStr, dateTo: todayStr } },
        { filter: { period: { from: monthStartStr, to: todayStr } } },
    ];

    for (const params of periodParams) {
        const data = await apiCall(auth, 'getPayment', { ...params, limit: 5000 });
        const count = data.result?.payment?.length || 0;
        let sum = 0;
        if (data.result?.payment) {
            data.result.payment.forEach(p => sum += parseFloat(p.amount) || 0);
        }
        if (count > 0 && count < 998) { // Faqat filtrlangan natijalarni ko'rsat
            console.log(`  ✅ ${JSON.stringify(params).substring(0, 50)}: ${count} ta, ${sum.toLocaleString()}`);
        }
    }

    // 3. Birinchi 10 ta to'lovni ko'rish - sanalarini tekshirish
    console.log('\n' + '='.repeat(70));
    console.log('📌 3. TO\'LOVLAR SANALARI:\n');

    const allPayments = data1.result?.payment || [];
    console.log('  Birinchi 10 ta to\'lov sanalari:');
    allPayments.slice(0, 10).forEach((p, i) => {
        console.log(`    ${i + 1}. ${p.paymentDate} - ${parseFloat(p.amount).toLocaleString()}`);
    });

    // Sanalar bo'yicha guruhlash
    console.log('\n  Sanalar bo\'yicha statistika:');
    const dateGroups = {};
    allPayments.forEach(p => {
        const date = p.paymentDate?.split(' ')[0] || 'unknown';
        if (!dateGroups[date]) dateGroups[date] = { count: 0, sum: 0 };
        dateGroups[date].count++;
        dateGroups[date].sum += parseFloat(p.amount) || 0;
    });

    // Oxirgi 5 ta sanani ko'rsat
    const dates = Object.entries(dateGroups).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 5);
    dates.forEach(([date, data]) => {
        console.log(`    ${date}: ${data.count} ta, ${data.sum.toLocaleString()}`);
    });

    // Bugungi sanani tekshirish
    console.log('\n  Bugungi sana (2026-02-05):');
    const todayPayments = allPayments.filter(p => p.paymentDate?.startsWith('2026-02-05'));
    let todaySum = 0;
    todayPayments.forEach(p => todaySum += parseFloat(p.amount) || 0);
    console.log(`    ${todayPayments.length} ta to'lov, ${todaySum.toLocaleString()}`);

    // To'lov turlari bo'yicha bugungi
    const todayByType = { 'd0_2': 0, 'd0_3': 0, 'd0_4': 0 };
    todayPayments.forEach(p => {
        const typeId = p.paymentType?.SD_id;
        if (todayByType.hasOwnProperty(typeId)) {
            todayByType[typeId] += parseFloat(p.amount) || 0;
        } else {
            todayByType['d0_2'] += parseFloat(p.amount) || 0;
        }
    });

    console.log(`    Naqd (d0_2): ${todayByType['d0_2'].toLocaleString()}`);
    console.log(`    Beznal (d0_3): ${todayByType['d0_3'].toLocaleString()}`);
    console.log(`    Dollar (d0_4): ${todayByType['d0_4'].toLocaleString()}`);

    console.log('\n' + '='.repeat(70));
    console.log('✅ YAKUNLANDI\n');
}

getPaymentsWithDate().catch(console.error);
