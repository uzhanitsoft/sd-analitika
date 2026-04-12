/**
 * Balanslarni batafsil tekshirish - farqni aniqlash
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

async function checkBalanceDetail() {
    console.log('🔍 BATAFSIL BALANS TEKSHIRUVI\n');

    const auth = await freshLogin();
    console.log(`✅ Login: ${auth.userId}\n`);

    // 1. Turli limitlar bilan test
    console.log('='.repeat(60));
    console.log('📌 1. TURLI LIMITLAR BILAN TEST:\n');

    const limits = [1000, 2000, 5000, 10000];

    for (const limit of limits) {
        const data = await apiCall(auth, 'getBalance', { limit });
        const balances = data.result?.balance || [];
        console.log(`  Limit ${limit}: ${balances.length} ta balans`);
    }

    // 2. Eng katta limit bilan olish
    console.log('\n' + '='.repeat(60));
    console.log('📌 2. BATAFSIL HISOBLASH (limit: 10000):\n');

    const data = await apiCall(auth, 'getBalance', { limit: 10000 });
    const balances = data.result?.balance || [];
    console.log(`  Jami balanslar: ${balances.length}\n`);

    // 3. Valyuta bo'yicha hisoblash
    const currencyTotals = {
        'd0_2': { name: 'Наличный Сум', total: 0, count: 0 },
        'd0_3': { name: 'Безналичный Сум', total: 0, count: 0 },
        'd0_4': { name: 'Доллар США', total: 0, count: 0 },
        'd0_5': { name: 'Clic', total: 0, count: 0 }
    };

    let overallBalance = 0;
    let debtorCount = 0;
    let creditorCount = 0;
    let zeroCount = 0;

    balances.forEach(b => {
        const balance = parseFloat(b.balance) || 0;
        overallBalance += balance;

        if (balance < 0) debtorCount++;
        else if (balance > 0) creditorCount++;
        else zeroCount++;

        if (b['by-currency'] && Array.isArray(b['by-currency'])) {
            b['by-currency'].forEach(curr => {
                const amount = parseFloat(curr.amount) || 0;
                if (currencyTotals[curr.currency_id]) {
                    currencyTotals[curr.currency_id].total += amount;
                    currencyTotals[curr.currency_id].count++;
                }
            });
        }
    });

    console.log('📌 3. VALYUTA BO\'YICHA JAMI:\n');
    for (const [id, data] of Object.entries(currencyTotals)) {
        console.log(`  ${id}: ${data.name.padEnd(20)} = ${data.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${data.count} ta)`);
    }

    console.log(`\n📌 4. UMUMIY MA'LUMOTLAR:\n`);
    console.log(`  Umumiy balans: ${overallBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log(`  Qarzdorlar (< 0): ${debtorCount}`);
    console.log(`  Kreditorlar (> 0): ${creditorCount}`);
    console.log(`  Nol balanslar: ${zeroCount}`);

    // 5. Sales Doctor bilan solishtirish
    console.log('\n' + '='.repeat(60));
    console.log('📌 5. SALES DOCTOR BILAN SOLISHTIRISH:\n');

    const sdValues = {
        'd0_2': -776381350.52,
        'd0_3': 2592000,
        'd0_4': -299424.25,
        'd0_5': 0,
        'overall': -774088774.77
    };

    console.log('  Valyuta            | Sales Doctor        | Bizning API         | Farq');
    console.log('  ' + '-'.repeat(80));

    for (const [id, data] of Object.entries(currencyTotals)) {
        const sd = sdValues[id] || 0;
        const our = data.total;
        const diff = our - sd;
        console.log(`  ${data.name.padEnd(18)} | ${sd.toLocaleString().padStart(18)} | ${our.toLocaleString().padStart(18)} | ${diff.toLocaleString().padStart(15)}`);
    }

    console.log(`  ${'Umumiy'.padEnd(18)} | ${sdValues.overall.toLocaleString().padStart(18)} | ${overallBalance.toLocaleString().padStart(18)} | ${(overallBalance - sdValues.overall).toLocaleString().padStart(15)}`);

    // 6. Eng katta qarzdorlarni ko'rish
    console.log('\n' + '='.repeat(60));
    console.log('📌 6. ENG KATTA QARZDORLAR (Top 5):\n');

    const sortedDebtors = balances
        .filter(b => parseFloat(b.balance) < 0)
        .sort((a, b) => parseFloat(a.balance) - parseFloat(b.balance))
        .slice(0, 5);

    sortedDebtors.forEach((b, i) => {
        const balance = parseFloat(b.balance);
        const clientName = b.client?.name || b.client_id || 'Noma\'lum';
        console.log(`  ${i + 1}. ${clientName.substring(0, 30).padEnd(30)} : ${balance.toLocaleString()}`);

        // by-currency ko'rsatish
        if (b['by-currency']) {
            b['by-currency'].forEach(curr => {
                const currName = currencyTotals[curr.currency_id]?.name || curr.currency_id;
                console.log(`        - ${currName}: ${parseFloat(curr.amount).toLocaleString()}`);
            });
        }
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ YAKUNLANDI\n');
}

checkBalanceDetail().catch(console.error);
