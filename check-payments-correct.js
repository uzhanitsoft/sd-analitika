/**
 * To'lovlar va qarzdorlik tuzilmasini tekshirish
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

async function checkData() {
    console.log('🔍 TO\'LOVLAR VA QARZDORLIK TEKSHIRUVI\n');

    const auth = await freshLogin();
    console.log(`✅ Login: ${auth.userId}\n`);

    // 1. To'lovlarni tekshirish
    console.log('='.repeat(60));
    console.log('📌 1. TO\'LOVLAR (getPayment):\n');

    let allPayments = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 20) {
        const data = await apiCall(auth, 'getPayment', { page, limit: 1000 });
        if (data.result?.payment?.length > 0) {
            allPayments = allPayments.concat(data.result.payment);
            if (data.result.payment.length < 1000) hasMore = false;
            else page++;
        } else {
            hasMore = false;
        }
    }

    console.log(`  Jami to'lovlar: ${allPayments.length}\n`);

    // Birinchi 3 ta to'lovni ko'rish
    console.log('  Namuna to\'lovlar:');
    allPayments.slice(0, 3).forEach((p, i) => {
        console.log(`\n  --- To'lov ${i + 1} ---`);
        console.log(`    SD_id: ${p.SD_id}`);
        console.log(`    amount: ${p.amount}`);
        console.log(`    paymentType: ${JSON.stringify(p.paymentType)}`);
        console.log(`    currency: ${p.currency_id || p.currency}`);
        console.log(`    date: ${p.datePayment || p.date}`);
        console.log(`    Keys: ${Object.keys(p).join(', ')}`);
    });

    // To'lovlar summasini hisoblash
    console.log('\n\n📌 2. TO\'LOVLAR SUMMASI:\n');

    const paymentTotals = {};
    allPayments.forEach(p => {
        const amount = parseFloat(p.amount) || 0;

        // Currency aniqlash
        let currencyKey = 'unknown';
        if (p.paymentType?.SD_id) {
            currencyKey = p.paymentType.SD_id;
        } else if (p.currency_id) {
            currencyKey = p.currency_id;
        }

        if (!paymentTotals[currencyKey]) {
            paymentTotals[currencyKey] = {
                count: 0,
                total: 0,
                name: p.paymentType?.name || currencyKey
            };
        }
        paymentTotals[currencyKey].count++;
        paymentTotals[currencyKey].total += amount;
    });

    let grandTotal = 0;
    for (const [key, data] of Object.entries(paymentTotals)) {
        console.log(`  ${key}: ${data.name.padEnd(25)} = ${data.total.toLocaleString()} (${data.count} ta)`);
        grandTotal += data.total;
    }
    console.log(`\n  JAMI: ${grandTotal.toLocaleString()}`);

    // 3. Balanslarni tekshirish
    console.log('\n' + '='.repeat(60));
    console.log('📌 3. BALANSLAR (getBalance):\n');

    const balanceData = await apiCall(auth, 'getBalance', { limit: 5000 });
    const balances = balanceData.result?.balance || [];
    console.log(`  Jami balanslar: ${balances.length}\n`);

    // Birinchi 3 ta balansni ko'rish
    console.log('  Namuna balanslar:');
    const sampleBalances = balances.filter(b => b.balance && parseFloat(b.balance) !== 0).slice(0, 3);
    sampleBalances.forEach((b, i) => {
        console.log(`\n  --- Balans ${i + 1} ---`);
        console.log(`    client: ${b.client?.name || b.client_id}`);
        console.log(`    balance: ${b.balance}`);
        console.log(`    by-currency: ${JSON.stringify(b['by-currency'])}`);
    });

    // Currency bo'yicha jami
    console.log('\n\n📌 4. VALYUTA BO\'YICHA BALANS:\n');

    const currencyTotals = {};
    let overallBalance = 0;
    let debtorCount = 0;
    let creditorCount = 0;

    balances.forEach(b => {
        const balance = parseFloat(b.balance) || 0;
        overallBalance += balance;

        if (balance < 0) debtorCount++;
        else if (balance > 0) creditorCount++;

        if (b['by-currency'] && Array.isArray(b['by-currency'])) {
            b['by-currency'].forEach(curr => {
                const amount = parseFloat(curr.amount) || 0;
                const currId = curr.currency_id;

                if (!currencyTotals[currId]) {
                    currencyTotals[currId] = { total: 0, count: 0 };
                }
                currencyTotals[currId].total += amount;
                currencyTotals[currId].count++;
            });
        }
    });

    // Currency nomlari
    const currencyNames = {
        'd0_2': 'Наличный Сум',
        'd0_3': 'Безналичный Сум',
        'd0_4': 'Доллар США',
        'd0_5': 'Clic'
    };

    for (const [key, data] of Object.entries(currencyTotals)) {
        const name = currencyNames[key] || key;
        console.log(`  ${key}: ${name.padEnd(20)} = ${data.total.toLocaleString()}`);
    }

    console.log(`\n  UMUMIY BALANS: ${overallBalance.toLocaleString()}`);
    console.log(`  Qarzdorlar (balans < 0): ${debtorCount}`);
    console.log(`  Kreditorlar (balans > 0): ${creditorCount}`);

    // 5. Sotuvlar bilan solishtirish
    console.log('\n' + '='.repeat(60));
    console.log('📌 5. XULOSA:\n');

    const totalDebtUZS = Math.abs(
        (currencyTotals['d0_2']?.total || 0) +
        (currencyTotals['d0_3']?.total || 0) +
        (currencyTotals['d0_5']?.total || 0)
    );
    const totalDebtUSD = Math.abs(currencyTotals['d0_4']?.total || 0);

    console.log(`  Qarzdorlik (So'm): ${totalDebtUZS.toLocaleString()}`);
    console.log(`  Qarzdorlik (Dollar): ${totalDebtUSD.toLocaleString()}`);
    console.log(`  To'lovlar jami: ${grandTotal.toLocaleString()}`);
    console.log(`  Qarzdorlar soni: ${debtorCount}`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ YAKUNLANDI\n');
}

checkData().catch(console.error);
