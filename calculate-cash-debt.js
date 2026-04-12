/**
 * FAQAT NAQD SO'M (d0_2) HISOBLASH - BATAFSIL
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

async function calculateCashDebt() {
    console.log('🔍 NAQD SO\'M (d0_2) BATAFSIL HISOBLASH\n');

    const auth = await freshLogin();
    console.log(`✅ Login: ${auth.userId}\n`);

    const balanceData = await apiCall(auth, 'getBalance', { limit: 10000 });
    const allBalances = balanceData.result?.balance || [];

    console.log(`📊 Jami balanslar: ${allBalances.length}\n`);

    // NAQD SO'M (d0_2) HISOBLASH
    let cashTotal = 0;
    let cashDebtorCount = 0;
    let cashCreditorCount = 0;
    let cashZeroCount = 0;

    const cashBalances = [];

    allBalances.forEach(b => {
        if (b['by-currency'] && Array.isArray(b['by-currency'])) {
            b['by-currency'].forEach(curr => {
                if (curr.currency_id === 'd0_2') {
                    const amount = parseFloat(curr.amount) || 0;
                    cashTotal += amount;

                    if (amount < 0) {
                        cashDebtorCount++;
                        cashBalances.push({ name: b.name, amount: amount });
                    } else if (amount > 0) {
                        cashCreditorCount++;
                    } else {
                        cashZeroCount++;
                    }
                }
            });
        }
    });

    console.log('='.repeat(70));
    console.log('📌 NAQD SO\'M (d0_2) STATISTIKA:\n');
    console.log(`  Qarzdorlar (< 0): ${cashDebtorCount}`);
    console.log(`  Kreditorlar (> 0): ${cashCreditorCount}`);
    console.log(`  Nol balanslar: ${cashZeroCount}`);
    console.log(`\n  JAMI NAQD SO'M: ${cashTotal.toLocaleString()}`);
    console.log(`  Sales Doctor:   ${(-762381350.52).toLocaleString()}`);
    console.log(`  FARQ:           ${(cashTotal - (-762381350.52)).toLocaleString()}`);

    // Eng katta naqd qarzdorlar
    console.log('\n' + '='.repeat(70));
    console.log('📌 TOP 30 NAQD SO\'M QARZDORLAR:\n');

    cashBalances.sort((a, b) => a.amount - b.amount);

    let runningTotal = 0;
    cashBalances.slice(0, 30).forEach((c, i) => {
        runningTotal += c.amount;
        console.log(`${(i + 1).toString().padStart(2)}. ${c.amount.toLocaleString().padStart(18)} | ${(c.name || 'NOMSIZ').substring(0, 35)}`);
    });
    console.log('-'.repeat(70));
    console.log(`    ${runningTotal.toLocaleString().padStart(18)} | Top 30 jami`);

    // Barcha qarzdorlar jami
    const allDebtorsTotal = cashBalances.reduce((sum, c) => sum + c.amount, 0);
    console.log(`    ${allDebtorsTotal.toLocaleString().padStart(18)} | Barcha ${cashBalances.length} ta qarzdor jami`);

    // Kreditorlarni hisoblash
    console.log('\n' + '='.repeat(70));
    console.log('📌 NAQD SO\'M KREDITORLAR (> 0):\n');

    let creditorTotal = 0;
    allBalances.forEach(b => {
        if (b['by-currency'] && Array.isArray(b['by-currency'])) {
            b['by-currency'].forEach(curr => {
                if (curr.currency_id === 'd0_2') {
                    const amount = parseFloat(curr.amount) || 0;
                    if (amount > 0) {
                        creditorTotal += amount;
                        console.log(`  ${amount.toLocaleString().padStart(15)} | ${(b.name || 'NOMSIZ').substring(0, 40)}`);
                    }
                }
            });
        }
    });
    console.log('-'.repeat(70));
    console.log(`  ${creditorTotal.toLocaleString().padStart(15)} | Kreditorlar jami`);

    // Net = Qarzdorlar + Kreditorlar
    console.log('\n' + '='.repeat(70));
    console.log('📌 NET HISOBLASH:\n');
    console.log(`  Qarzdorlar jami:   ${allDebtorsTotal.toLocaleString()}`);
    console.log(`  Kreditorlar jami:  ${creditorTotal.toLocaleString()}`);
    console.log(`  NET (Q + K):       ${(allDebtorsTotal + creditorTotal).toLocaleString()}`);
    console.log(`  Sales Doctor:      ${(-762381350.52).toLocaleString()}`);

    console.log('\n' + '='.repeat(70));
    console.log('✅ YAKUNLANDI\n');
}

calculateCashDebt().catch(console.error);
