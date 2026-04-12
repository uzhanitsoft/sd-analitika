/**
 * ENG YANGI MA'LUMOTLARNI TEKSHIRISH
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

async function checkLatestData() {
    console.log('🔍 ENG YANGI MA\'LUMOTLARNI TEKSHIRISH\n');

    const auth = await freshLogin();
    console.log(`✅ Login: ${auth.userId}\n`);

    // 1. Eng yangi to'lovlar
    console.log('='.repeat(70));
    console.log('📌 1. ENG YANGI TO\'LOVLAR (sanasi bo\'yicha):\n');

    const payData = await apiCall(auth, 'getPayment', { limit: 1000 });
    const payments = payData.result?.payment || [];

    // Sanalar bo'yicha tartiblash
    const sorted = payments.sort((a, b) => {
        const dateA = new Date(a.paymentDate);
        const dateB = new Date(b.paymentDate);
        return dateB - dateA;
    });

    console.log('  Eng yangi 10 ta to\'lov:');
    sorted.slice(0, 10).forEach((p, i) => {
        console.log(`    ${i + 1}. ${p.paymentDate} - ${parseFloat(p.amount).toLocaleString()} (${p.client?.name?.substring(0, 20) || 'N/A'})`);
    });

    // Oxirgi sana
    const latestDate = sorted[0]?.paymentDate;
    console.log(`\n  📅 ENG YANGI TO'LOV SANASI: ${latestDate}`);

    // Fevral oyidagi to'lovlar
    console.log('\n  Fevral 2026 to\'lovlari:');
    const febPayments = payments.filter(p => p.paymentDate?.startsWith('2026-02'));
    let febSum = 0;
    febPayments.forEach(p => febSum += parseFloat(p.amount) || 0);
    console.log(`    ${febPayments.length} ta, ${febSum.toLocaleString()}`);

    // 2. Barcha sanalar statistikasi
    console.log('\n' + '='.repeat(70));
    console.log('📌 2. OYLAR BO\'YICHA STATISTIKA:\n');

    const monthGroups = {};
    payments.forEach(p => {
        const month = p.paymentDate?.substring(0, 7) || 'unknown';
        if (!monthGroups[month]) monthGroups[month] = { count: 0, sum: 0 };
        monthGroups[month].count++;
        monthGroups[month].sum += parseFloat(p.amount) || 0;
    });

    Object.entries(monthGroups).sort((a, b) => b[0].localeCompare(a[0])).forEach(([month, data]) => {
        console.log(`    ${month}: ${data.count} ta, ${data.sum.toLocaleString()}`);
    });

    // 3. Solishtirish
    console.log('\n' + '='.repeat(70));
    console.log('📌 3. SALES DOCTOR BILAN SOLISHTIRISH:\n');

    // Sales Doctor screenshot'dagi qiymatlar
    const sdNaqd = 178060817.54;
    const sdBeznal = 0;
    const sdDollar = 19729.66;
    const sdTotal = 178080547.2;

    console.log('  Sales Doctor (screenshot):');
    console.log(`    Наличный Сум:    ${sdNaqd.toLocaleString()}`);
    console.log(`    Безналичный Сум: ${sdBeznal.toLocaleString()}`);
    console.log(`    Доллар США:      ${sdDollar.toLocaleString()}`);
    console.log(`    Общий:           ${sdTotal.toLocaleString()}`);

    // Bizning API
    let apiNaqd = 0, apiBeznal = 0, apiDollar = 0;
    payments.forEach(p => {
        const amount = parseFloat(p.amount) || 0;
        const typeId = p.paymentType?.SD_id;
        if (typeId === 'd0_2') apiNaqd += amount;
        else if (typeId === 'd0_3') apiBeznal += amount;
        else if (typeId === 'd0_4') apiDollar += amount;
        else apiNaqd += amount; // default
    });

    console.log('\n  Bizning API (barcha davr):');
    console.log(`    Naqd (d0_2):     ${apiNaqd.toLocaleString()}`);
    console.log(`    Beznal (d0_3):   ${apiBeznal.toLocaleString()}`);
    console.log(`    Dollar (d0_4):   ${apiDollar.toLocaleString()}`);
    console.log(`    Jami:            ${(apiNaqd + apiBeznal + apiDollar).toLocaleString()}`);

    console.log('\n' + '='.repeat(70));
    console.log('✅ YAKUNLANDI\n');
}

checkLatestData().catch(console.error);
