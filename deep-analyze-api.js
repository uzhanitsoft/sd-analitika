/**
 * getBalance API javobini batafsil tekshirish
 * Va to'g'ri hisoblash usulini aniqlash
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

async function deepAnalyzeBalance() {
    console.log('🔍 getBalance API JAVOBINI BATAFSIL TEKSHIRISH\n');

    const auth = await freshLogin();
    console.log(`✅ Login: ${auth.userId}\n`);

    // 1. Oddiy getBalance chaqiruvi
    console.log('='.repeat(70));
    console.log('📌 1. GETBALANCE JAVOB STRUKTURASI:\n');

    const balanceData = await apiCall(auth, 'getBalance', { limit: 10 });

    console.log('Javob kalitlari:', Object.keys(balanceData));
    console.log('result kalitlari:', Object.keys(balanceData.result || {}));

    // result ichida nima bor?
    if (balanceData.result) {
        for (const [key, value] of Object.entries(balanceData.result)) {
            if (Array.isArray(value)) {
                console.log(`  ${key}: ${value.length} ta element`);
            } else if (typeof value === 'object') {
                console.log(`  ${key}: ${JSON.stringify(value)}`);
            } else {
                console.log(`  ${key}: ${value}`);
            }
        }
    }

    // Bitta balans strukturasi
    console.log('\n--- Bitta balans strukturasi ---');
    if (balanceData.result?.balance?.[0]) {
        const sample = balanceData.result.balance[0];
        console.log(JSON.stringify(sample, null, 2));
    }

    // 2. Katta miqdorda olish va tekshirish
    console.log('\n' + '='.repeat(70));
    console.log('📌 2. BARCHA BALANSLAR TAHLILI:\n');

    const allBalanceData = await apiCall(auth, 'getBalance', { limit: 10000 });
    const allBalances = allBalanceData.result?.balance || [];

    console.log(`Jami balanslar: ${allBalances.length}`);

    // Summary mavjudmi tekshirish
    console.log('\n--- result ichidagi boshqa kalitlar ---');
    for (const [key, value] of Object.entries(allBalanceData.result || {})) {
        if (key !== 'balance') {
            console.log(`${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
        }
    }

    // 3. Har bir balansning tarkibiy qismlarini tekshirish
    console.log('\n' + '='.repeat(70));
    console.log('📌 3. BALANS TARKIBIY QISMLARI:\n');

    // Har bir balansdagi barcha kalitlarni yig'ish
    const allKeys = new Set();
    allBalances.forEach(b => {
        Object.keys(b).forEach(k => allKeys.add(k));
    });
    console.log('Balanslardagi kalitlar:', Array.from(allKeys).join(', '));

    // 4. client obyektlarini tekshirish
    console.log('\n' + '='.repeat(70));
    console.log('📌 4. CLIENT OBYEKTINI TEKSHIRISH:\n');

    // Birinchi 3 ta balansning client ma'lumotlarini ko'rish
    allBalances.slice(0, 3).forEach((b, i) => {
        console.log(`--- Balans ${i + 1} ---`);
        if (b.client) {
            console.log('  client:', JSON.stringify(b.client, null, 4).substring(0, 500));
        }
        console.log('  balance:', b.balance);
        console.log('  by-currency:', JSON.stringify(b['by-currency']));
        console.log('');
    });

    // 5. Sales Doctor screenshot qiymatlari bilan solishtirish
    console.log('='.repeat(70));
    console.log('📌 5. SALES DOCTOR BILAN SOLISHTIRISH:\n');

    const sdValues = {
        'Naqd so\'m': -762381350.52,
        'Beznal so\'m': 2592000,
        'Dollar': -295079.96,
        'Umumiy': -760084430.48
    };

    // Bizning hisobimiz
    let totalBalance = 0;
    const currencyTotals = { 'd0_2': 0, 'd0_3': 0, 'd0_4': 0, 'd0_5': 0 };

    allBalances.forEach(b => {
        totalBalance += parseFloat(b.balance) || 0;

        if (b['by-currency'] && Array.isArray(b['by-currency'])) {
            b['by-currency'].forEach(curr => {
                if (currencyTotals.hasOwnProperty(curr.currency_id)) {
                    currencyTotals[curr.currency_id] += parseFloat(curr.amount) || 0;
                }
            });
        }
    });

    console.log('SALES DOCTOR:');
    for (const [name, value] of Object.entries(sdValues)) {
        console.log(`  ${name.padEnd(15)}: ${value.toLocaleString()}`);
    }

    console.log('\nBIZNING API DAN:');
    console.log(`  ${'Naqd so\'m'.padEnd(15)}: ${currencyTotals['d0_2'].toLocaleString()}`);
    console.log(`  ${'Beznal so\'m'.padEnd(15)}: ${currencyTotals['d0_3'].toLocaleString()}`);
    console.log(`  ${'Dollar'.padEnd(15)}: ${currencyTotals['d0_4'].toLocaleString()}`);
    console.log(`  ${'Umumiy'.padEnd(15)}: ${totalBalance.toLocaleString()}`);

    console.log('\nFARQ:');
    console.log(`  ${'Naqd so\'m'.padEnd(15)}: ${(currencyTotals['d0_2'] - sdValues['Naqd so\'m']).toLocaleString()}`);
    console.log(`  ${'Beznal so\'m'.padEnd(15)}: ${(currencyTotals['d0_3'] - sdValues['Beznal so\'m']).toLocaleString()}`);
    console.log(`  ${'Dollar'.padEnd(15)}: ${(currencyTotals['d0_4'] - sdValues['Dollar']).toLocaleString()}`);
    console.log(`  ${'Umumiy'.padEnd(15)}: ${(totalBalance - sdValues['Umumiy']).toLocaleString()}`);

    // 6. Boshqa API methodlarni tekshirish
    console.log('\n' + '='.repeat(70));
    console.log('📌 6. BOSHQA API METHODLARNI TEKSHIRISH:\n');

    // getDebt metodini sinab ko'rish
    try {
        const debtData = await apiCall(auth, 'getDebt', { limit: 10 });
        console.log('getDebt:', debtData.status ? 'Ishlaydi' : 'Ishlamadi - ' + (debtData.error || ''));
        if (debtData.result) {
            console.log('  result:', JSON.stringify(debtData.result).substring(0, 200));
        }
    } catch (e) {
        console.log('getDebt: Xatolik -', e.message);
    }

    // getTransaction metodini sinab ko'rish
    try {
        const transData = await apiCall(auth, 'getTransaction', { limit: 10 });
        console.log('getTransaction:', transData.status ? 'Ishlaydi' : 'Ishlamadi - ' + (transData.error || ''));
        if (transData.result) {
            console.log('  result kalitlari:', Object.keys(transData.result));
        }
    } catch (e) {
        console.log('getTransaction: Xatolik -', e.message);
    }

    // getBalanceHistory metodini sinab ko'rish
    try {
        const bhData = await apiCall(auth, 'getBalanceHistory', { limit: 10 });
        console.log('getBalanceHistory:', bhData.status ? 'Ishlaydi' : 'Ishlamadi - ' + (bhData.error || ''));
    } catch (e) {
        console.log('getBalanceHistory: Xatolik -', e.message);
    }

    // getDebtors metodini sinab ko'rish
    try {
        const debtorsData = await apiCall(auth, 'getDebtors', { limit: 10 });
        console.log('getDebtors:', debtorsData.status ? 'Ishlaydi' : 'Ishlamadi - ' + (debtorsData.error || ''));
    } catch (e) {
        console.log('getDebtors: Xatolik -', e.message);
    }

    // getClientBalance metodini sinab ko'rish
    try {
        const cbData = await apiCall(auth, 'getClientBalance', { limit: 10 });
        console.log('getClientBalance:', cbData.status ? 'Ishlaydi' : 'Ishlamadi - ' + (cbData.error || ''));
    } catch (e) {
        console.log('getClientBalance: Xatolik -', e.message);
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ YAKUNLANDI\n');
}

deepAnalyzeBalance().catch(console.error);
