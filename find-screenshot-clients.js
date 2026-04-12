/**
 * Sales Doctor screenshotidagi mijozlarni API'dan topish
 * Va ularning balanslarini solishtirish
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

async function findClientsFromScreenshot() {
    console.log('🔍 SALES DOCTOR SCREENSHOTIDAGI MIJOZLARNI QIDIRISH\n');

    const auth = await freshLogin();
    console.log(`✅ Login: ${auth.userId}\n`);

    // Barcha balanslarni olish
    const balanceData = await apiCall(auth, 'getBalance', { limit: 10000 });
    const allBalances = balanceData.result?.balance || [];

    console.log(`📊 Jami balanslar: ${allBalances.length}\n`);

    // Screenshot'dagi mijozlar:
    // 1. Асмо (Asmo) - Naqd: -5,616,000
    // 2. Beshariq bozor Ichi - Naqd: -14,040,000
    // 3. ISMOILXON MARKET NAYMANCHA - Naqd: -120,000

    console.log('='.repeat(70));
    console.log('📌 SCREENSHOT DAGI MIJOZLARNI QIDIRISH:\n');

    const searchTerms = [
        { name: 'Asmo', sdBalance: -5616000 },
        { name: 'Асмо', sdBalance: -5616000 },
        { name: 'Beshariq', sdBalance: -14040000 },
        { name: 'ISMOILXON', sdBalance: -120000 },
        { name: 'Naymancha', sdBalance: -120000 }
    ];

    searchTerms.forEach(term => {
        console.log(`\n🔎 "${term.name}" qidirish (SD balans: ${term.sdBalance.toLocaleString()}):`);

        const found = allBalances.filter(b =>
            b.name && b.name.toLowerCase().includes(term.name.toLowerCase())
        );

        if (found.length > 0) {
            found.forEach(f => {
                console.log(`  ✅ Topildi: ${f.name}`);
                console.log(`     API balans: ${parseFloat(f.balance).toLocaleString()}`);
                console.log(`     by-currency: ${JSON.stringify(f['by-currency'])}`);
                console.log(`     Farq: ${(parseFloat(f.balance) - term.sdBalance).toLocaleString()}`);
            });
        } else {
            console.log(`  ❌ Topilmadi`);
        }
    });

    // Eng katta qarzdorlarni ko'rsatish
    console.log('\n' + '='.repeat(70));
    console.log('📌 ENG KATTA 20 TA QARZDOR:\n');

    const debtors = allBalances
        .filter(b => parseFloat(b.balance) < -100000) // 100,000 dan katta qarzlar
        .sort((a, b) => parseFloat(a.balance) - parseFloat(b.balance))
        .slice(0, 20);

    console.log('Rang  | Balans                 | Nom');
    console.log('-'.repeat(70));

    debtors.forEach((d, i) => {
        const balance = parseFloat(d.balance);
        console.log(`${(i + 1).toString().padStart(2)}    | ${balance.toLocaleString().padStart(20)} | ${d.name?.substring(0, 35) || 'NOMSIZ'}`);
    });

    // Jami
    const totalDebt = debtors.reduce((sum, d) => sum + parseFloat(d.balance), 0);
    console.log('-'.repeat(70));
    console.log(`JAMI  | ${totalDebt.toLocaleString().padStart(20)} | (Top 20 qarzdor)`);

    // Screenshot'dagi qiymatlarni topish uchun - minus bilan -5,616,000 qidirish
    console.log('\n' + '='.repeat(70));
    console.log('📌 -5,616,000 GA YAQIN BALANSLAR:\n');

    const similar = allBalances.filter(b => {
        const bal = parseFloat(b.balance);
        return bal < -5000000 && bal > -6000000;
    });

    similar.forEach(s => {
        console.log(`  ${s.name}: ${parseFloat(s.balance).toLocaleString()}`);
    });

    // -14,040,000 ga yaqin
    console.log('\n📌 -14,000,000 GA YAQIN BALANSLAR:\n');

    const similar2 = allBalances.filter(b => {
        const bal = parseFloat(b.balance);
        return bal < -13000000 && bal > -15000000;
    });

    similar2.forEach(s => {
        console.log(`  ${s.name}: ${parseFloat(s.balance).toLocaleString()}`);
    });

    console.log('\n' + '='.repeat(70));
    console.log('✅ YAKUNLANDI\n');
}

findClientsFromScreenshot().catch(console.error);
