/**
 * BARCHA balanslarni to'g'ri hisoblash
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

async function checkAllBalances() {
    console.log('🔍 BARCHA BALANSLARNI TO\'G\'RI HISOBLASH\n');

    const auth = await freshLogin();
    console.log(`✅ Login: ${auth.userId}\n`);

    // Balanslarni olish
    const balanceData = await apiCall(auth, 'getBalance', { limit: 10000 });
    const balances = balanceData.result?.balance || [];

    console.log(`📊 Jami balanslar: ${balances.length}\n`);

    // BARCHA balanslarning by-currency qiymatlarini yig'ish (balance qiymatidan qat'iy nazar)
    const allCurrencyTotals = {
        'd0_2': 0,
        'd0_3': 0,
        'd0_4': 0,
        'd0_5': 0
    };

    let withByCurrency = 0;
    let withoutByCurrency = 0;
    let debtorCount = 0;
    let creditorCount = 0;
    let zeroCount = 0;

    balances.forEach(b => {
        const balance = parseFloat(b.balance) || 0;

        if (balance < 0) debtorCount++;
        else if (balance > 0) creditorCount++;
        else zeroCount++;

        if (b['by-currency'] && Array.isArray(b['by-currency']) && b['by-currency'].length > 0) {
            withByCurrency++;
            b['by-currency'].forEach(curr => {
                const amount = parseFloat(curr.amount) || 0;
                if (allCurrencyTotals.hasOwnProperty(curr.currency_id)) {
                    allCurrencyTotals[curr.currency_id] += amount;
                }
            });
        } else {
            withoutByCurrency++;
        }
    });

    console.log('='.repeat(60));
    console.log('📌 STATISTIKA:\n');
    console.log(`  by-currency mavjud: ${withByCurrency}`);
    console.log(`  by-currency yo'q: ${withoutByCurrency}`);
    console.log(`  Qarzdorlar (< 0): ${debtorCount}`);
    console.log(`  Kreditorlar (> 0): ${creditorCount}`);
    console.log(`  Nol balanslar (= 0): ${zeroCount}`);

    console.log('\n' + '='.repeat(60));
    console.log('📌 BARCHA BALANSLAR BO\'YICHA VALYUTA JAMI:\n');

    const currNames = {
        'd0_2': 'Naqd so\'m',
        'd0_3': 'Beznal so\'m',
        'd0_4': 'Dollar',
        'd0_5': 'Clic'
    };

    for (const [id, total] of Object.entries(allCurrencyTotals)) {
        console.log(`  ${currNames[id].padEnd(18)} : ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    }

    // Sales Doctor qiymatlari bilan solishtirish
    console.log('\n' + '='.repeat(60));
    console.log('📌 SALES DOCTOR BILAN SOLISHTIRISH:\n');

    const sdValues = {
        'd0_2': -762381350.52,
        'd0_3': 2592000,
        'd0_4': -295079.96,
        'd0_5': 0
    };

    console.log('  Valyuta            | Sales Doctor        | Bizning API         | Farq');
    console.log('  ' + '-'.repeat(80));

    for (const [id, total] of Object.entries(allCurrencyTotals)) {
        const sd = sdValues[id] || 0;
        const diff = total - sd;
        const sdStr = sd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const ourStr = total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const diffStr = diff.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        console.log(`  ${currNames[id].padEnd(18)} | ${sdStr.padStart(18)} | ${ourStr.padStart(18)} | ${diffStr.padStart(15)}`);
    }

    // Ba'zi misollarni ko'rish - by-currency yo'q bo'lganlar
    console.log('\n' + '='.repeat(60));
    console.log('📌 BY-CURRENCY YO\'Q BO\'LGAN MIJOZLAR (5 ta misol):\n');

    const withoutByCurrencyBalances = balances.filter(b =>
        !b['by-currency'] || !Array.isArray(b['by-currency']) || b['by-currency'].length === 0
    ).slice(0, 5);

    withoutByCurrencyBalances.forEach((b, i) => {
        console.log(`  ${i + 1}. Balance: ${parseFloat(b.balance).toLocaleString()}`);
        console.log(`     by-currency: ${JSON.stringify(b['by-currency'])}`);
        console.log('');
    });

    // Umumiy balance yig'indisi
    console.log('='.repeat(60));
    console.log('📌 UMUMIY (OVERALL) BALANCE YIG\'INDISI:\n');

    let overallSum = 0;
    balances.forEach(b => {
        overallSum += parseFloat(b.balance) || 0;
    });

    console.log(`  Umumiy balance yig'indisi: ${overallSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log(`  Sales Doctor Umumiy:       ${(-760084430.48).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log(`  Farq:                      ${(overallSum - (-760084430.48)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ YAKUNLANDI\n');
}

checkAllBalances().catch(console.error);
