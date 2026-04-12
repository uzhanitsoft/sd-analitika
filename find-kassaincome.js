/**
 * KASSAINCOME ENDPOINT TOPISH
 * Sales Doctor URL: /dashboard/kassaIncome
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

async function findKassaIncome() {
    console.log('🔍 KASSAINCOME METODINI TOPISH\n');

    const auth = await freshLogin();
    console.log(`✅ Login: ${auth.userId}\n`);

    // Mumkin bo'lgan kassaIncome metodlari
    const methods = [
        'getKassaIncome',
        'kassaIncome',
        'getKassaincome',
        'getCashIncome',
        'getCashboxIncome',
        'getIncomeReport',
        'getKassa',
        'getKassaReport',
        'getCashReport',
        'getIncome',
        'getIncomes',
        'getCashIn',
        'getCashflow',
        'getMoneyIn',
        'getReceipt',
        'getReceipts',
        'getTushum',
        'getTushumlar',
        'getPoступления',
        'getEntry',
        'getEntries',
    ];

    console.log('='.repeat(70));
    console.log('📌 KASSA/INCOME METODLARI:\n');

    for (const method of methods) {
        try {
            const data = await apiCall(auth, method, { limit: 10 });

            if (data.status === true) {
                console.log(`  ✅ ${method}: ISHLADI!`);
                console.log(`     Result keys: ${Object.keys(data.result || {}).join(', ')}`);
                if (data.result) {
                    const firstKey = Object.keys(data.result)[0];
                    if (Array.isArray(data.result[firstKey])) {
                        console.log(`     Count: ${data.result[firstKey].length}`);
                    }
                }
            }
        } catch (e) {
            // skip
        }
    }

    // getCashbox batafsil - kassa ma'lumotlari
    console.log('\n' + '='.repeat(70));
    console.log('📌 GETCASHBOX BATAFSIL:\n');

    const cashboxData = await apiCall(auth, 'getCashbox', { limit: 100 });
    if (cashboxData.result?.cashbox) {
        console.log(`  Jami: ${cashboxData.result.cashbox.length} ta kassa`);
        cashboxData.result.cashbox.forEach(cb => {
            console.log(`\n  Kassa: ${cb.name} (${cb.SD_id})`);
            console.log(`    Keys: ${Object.keys(cb).join(', ')}`);
            // Balans bormi?
            if (cb.balance !== undefined) console.log(`    Balance: ${cb.balance}`);
            if (cb.income !== undefined) console.log(`    Income: ${cb.income}`);
            if (cb.amount !== undefined) console.log(`    Amount: ${cb.amount}`);
        });
    }

    // getPayment'dan transactionType tekshirish
    console.log('\n' + '='.repeat(70));
    console.log('📌 GETPAYMENT TRANSACTION TURLARI:\n');

    const payData = await apiCall(auth, 'getPayment', { limit: 100 });
    if (payData.result?.payment) {
        const txTypes = {};
        payData.result.payment.forEach(p => {
            const type = p.transactionType || 'unknown';
            if (!txTypes[type]) txTypes[type] = { count: 0, sum: 0 };
            txTypes[type].count++;
            txTypes[type].sum += parseFloat(p.amount) || 0;
        });

        console.log('  Transaction turlari:');
        for (const [type, data] of Object.entries(txTypes)) {
            console.log(`    ${type}: ${data.count} ta, ${data.sum.toLocaleString()}`);
        }

        // Birinchi payment strukturasi
        console.log('\n  Payment strukturasi (birinchi element):');
        if (payData.result.payment[0]) {
            const p = payData.result.payment[0];
            for (const [key, val] of Object.entries(p)) {
                const valStr = typeof val === 'object' ? JSON.stringify(val).substring(0, 50) : val;
                console.log(`    ${key}: ${valStr}`);
            }
        }
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ YAKUNLANDI\n');
}

findKassaIncome().catch(console.error);
