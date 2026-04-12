/**
 * To'g'ri qarzdorlik hisoblash - currency_id bo'yicha
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

async function checkDebtCorrectly() {
    console.log('💰 TO\'G\'RI QARZDORLIK HISOBLASH\n');

    const auth = await freshLogin();
    console.log(`✅ Login: ${auth.userId}\n`);

    // 1. Balanslarni olish
    console.log('📌 1. BALANSLARNI OLISH:\n');
    const data = await apiCall(auth, 'getBalance', { limit: 5000 });
    const balances = data.result?.balance || [];
    console.log(`  Jami balanslar: ${balances.length}\n`);

    // 2. Currency bo'yicha jami hisoblash
    // d0_2 = Наличный Сум
    // d0_3 = Безналичный Сум  
    // d0_4 = Доллар США
    // d0_5 = Clic

    const totals = {
        'd0_2': { name: 'Наличный Сум', total: 0 },
        'd0_3': { name: 'Безналичный Сум', total: 0 },
        'd0_4': { name: 'Доллар США', total: 0 },
        'd0_5': { name: 'Clic', total: 0 }
    };

    let overallTotal = 0;
    let debtorCount = 0;

    balances.forEach(b => {
        if (b['by-currency'] && Array.isArray(b['by-currency'])) {
            b['by-currency'].forEach(curr => {
                const amount = parseFloat(curr.amount) || 0;
                if (totals[curr.currency_id]) {
                    totals[curr.currency_id].total += amount;
                }
            });
        }

        // Overall balance
        const balance = parseFloat(b.balance) || 0;
        overallTotal += balance;

        if (balance < 0) {
            debtorCount++;
        }
    });

    console.log('📌 2. VALYUTA BO\'YICHA JAMI:\n');
    for (const [id, data] of Object.entries(totals)) {
        console.log(`  ${id}: ${data.name.padEnd(20)} = ${data.total.toLocaleString()}`);
    }

    console.log(`\n📌 3. UMUMIY (SUM): ${overallTotal.toLocaleString()}`);
    console.log(`📌 4. QARZDORLAR SONI: ${debtorCount}`);

    // 3. Kutilgan qiymatlar bilan solishtirish
    console.log('\n' + '='.repeat(60));
    console.log('📌 SOLISHTIRISH:\n');
    console.log('  Kutilgan (screenshotdan):');
    console.log('    Наличный Сум:    -776,381,350.52');
    console.log('    Безналичный Сум:  2,592,000');
    console.log('    Доллар США:      -299,424.25');
    console.log('    Общий:           -774,088,774.77');

    console.log('\n  Hisoblangan:');
    console.log(`    Наличный Сум:    ${totals['d0_2'].total.toLocaleString()}`);
    console.log(`    Безналичный Сум: ${totals['d0_3'].total.toLocaleString()}`);
    console.log(`    Доллар США:      ${totals['d0_4'].total.toLocaleString()}`);
    console.log(`    Общий:           ${overallTotal.toLocaleString()}`);

    // 4. To'lovlarni tekshirish - boshqa endpoint?
    console.log('\n' + '='.repeat(60));
    console.log('📌 5. BOSHQA API METODLARNI TEKSHIRISH:\n');

    const methods = ['getClientBalance', 'getBalanceSummary', 'getBalanceTotal',
        'getDebt', 'getClientDebt', 'getPaymentSummary', 'getStatistics'];

    for (const method of methods) {
        try {
            const res = await apiCall(auth, method, {});
            if (res.status === true) {
                console.log(`  ✅ ${method}: ${JSON.stringify(res.result).substring(0, 200)}`);
            }
        } catch (e) { }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ YAKUNLANDI\n');
}

checkDebtCorrectly().catch(console.error);
