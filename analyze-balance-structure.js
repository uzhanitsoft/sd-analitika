/**
 * Balance ma'lumotlarini batafsil tahlil qilish
 * Va to'g'ri hisoblash usulini topish
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

async function analyzeBalanceStructure() {
    console.log('🔍 BALANCE STRUKTURASINI BATAFSIL TAHLIL QILISH\n');

    const auth = await freshLogin();
    console.log(`✅ Login: ${auth.userId}\n`);

    const balanceData = await apiCall(auth, 'getBalance', { limit: 10000 });
    const balances = balanceData.result?.balance || [];

    console.log(`📊 Jami balanslar: ${balances.length}\n`);

    // Birinchi 3 ta balance strukturasini ko'rish
    console.log('='.repeat(60));
    console.log('📌 BALANCE STRUKTURASI (3 ta misol):\n');

    balances.slice(0, 3).forEach((b, i) => {
        console.log(`--- Balans ${i + 1} ---`);
        console.log(`  client_id: ${b.client_id}`);
        console.log(`  balance: ${b.balance}`);
        console.log(`  by-currency:`, JSON.stringify(b['by-currency'], null, 4));
        console.log('');
    });

    // Har bir balansning by-currency qiymatlarini yig'ish
    // va balance qiymati bilan solishtirish
    console.log('='.repeat(60));
    console.log('📌 BY-CURRENCY VA BALANCE SOLISHTIRISH:\n');

    let matchCount = 0;
    let mismatchCount = 0;
    const mismatches = [];

    balances.forEach(b => {
        const balance = parseFloat(b.balance) || 0;
        let byCurrencySum = 0;

        if (b['by-currency'] && Array.isArray(b['by-currency'])) {
            b['by-currency'].forEach(curr => {
                // Faqat so'm currency_id larni yig'ish (d0_2, d0_3, d0_5)
                // Dollar (d0_4) ni so'mga convert qilmasdan
                if (curr.currency_id !== 'd0_4') {
                    byCurrencySum += parseFloat(curr.amount) || 0;
                }
            });
        }

        // Agar balance va by-currency yig'indisi mos kelmasa
        const diff = Math.abs(balance - byCurrencySum);
        if (diff > 1) {  // 1 so'mdan ortiq farq bo'lsa
            mismatchCount++;
            if (mismatches.length < 5) {
                mismatches.push({ balance, byCurrencySum, diff, byCurrency: b['by-currency'] });
            }
        } else {
            matchCount++;
        }
    });

    console.log(`  Mos keladi: ${matchCount}`);
    console.log(`  Mos kelmaydi: ${mismatchCount}`);

    if (mismatches.length > 0) {
        console.log('\n  Mos kelmaydigan misollar:');
        mismatches.forEach((m, i) => {
            console.log(`    ${i + 1}. balance=${m.balance.toLocaleString()}, by-currency sum=${m.byCurrencySum.toLocaleString()}, farq=${m.diff.toLocaleString()}`);
            console.log(`       by-currency: ${JSON.stringify(m.byCurrency)}`);
        });
    }

    // by-currency ichidagi har xil currency_id larni aniqlash
    console.log('\n' + '='.repeat(60));
    console.log('📌 MAVJUD CURRENCY_ID LAR:\n');

    const currencyIds = {};
    balances.forEach(b => {
        if (b['by-currency'] && Array.isArray(b['by-currency'])) {
            b['by-currency'].forEach(curr => {
                if (!currencyIds[curr.currency_id]) {
                    currencyIds[curr.currency_id] = { count: 0, totalAmount: 0 };
                }
                currencyIds[curr.currency_id].count++;
                currencyIds[curr.currency_id].totalAmount += parseFloat(curr.amount) || 0;
            });
        }
    });

    for (const [id, data] of Object.entries(currencyIds)) {
        console.log(`  ${id}: ${data.count} ta, jami: ${data.totalAmount.toLocaleString()}`);
    }

    // Eng katta 10 ta qarz
    console.log('\n' + '='.repeat(60));
    console.log('📌 ENG KATTA 10 TA QARZ:\n');

    const sortedDebts = balances
        .filter(b => parseFloat(b.balance) < 0)
        .sort((a, b) => parseFloat(a.balance) - parseFloat(b.balance))
        .slice(0, 10);

    let top10Total = 0;
    sortedDebts.forEach((b, i) => {
        const balance = parseFloat(b.balance);
        top10Total += balance;
        console.log(`  ${(i + 1).toString().padStart(2)}. ${balance.toLocaleString().padStart(20)}`);
    });
    console.log(`  ${'---'.padStart(23)}`);
    console.log(`      Top 10 jami: ${top10Total.toLocaleString()}`);

    // Jami balance
    console.log('\n' + '='.repeat(60));
    console.log('📌 JAMI HISOBLASH:\n');

    let totalBalance = 0;
    balances.forEach(b => {
        totalBalance += parseFloat(b.balance) || 0;
    });

    console.log(`  Jami balance (barcha mijozlar): ${totalBalance.toLocaleString()}`);
    console.log(`  Sales Doctor ko'rsatadi:        ${(-760084430.48).toLocaleString()}`);
    console.log(`  Farq:                           ${(totalBalance - (-760084430.48)).toLocaleString()}`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ YAKUNLANDI\n');
}

analyzeBalanceStructure().catch(console.error);
