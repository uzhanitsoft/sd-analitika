/**
 * Qarzdorlik va to'lovlarni tekshirish
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

async function checkDebtAndPayments() {
    console.log('💰 QARZDORLIK VA TO\'LOVLARNI TEKSHIRISH\n');

    // Login
    const auth = await freshLogin();
    console.log(`✅ Login: ${auth.userId}\n`);

    // 1. Balanslar
    console.log('📌 1. BALANSLAR (getBalance):\n');

    let allBalances = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 5) {
        const data = await apiCall(auth, 'getBalance', { page, limit: 1000 });
        if (data.result?.balance?.length > 0) {
            console.log(`  Sahifa ${page}: ${data.result.balance.length} ta`);
            allBalances = allBalances.concat(data.result.balance);
            if (data.result.balance.length < 1000) hasMore = false;
            else page++;
        } else {
            hasMore = false;
        }
    }

    console.log(`\n  ✅ Jami balanslar: ${allBalances.length}`);

    // Qarzdorlikni hisoblash
    let totalDebtUZS = 0;
    let totalDebtUSD = 0;
    let debtorCount = 0;

    allBalances.forEach(b => {
        if (b['by-currency'] && Array.isArray(b['by-currency'])) {
            b['by-currency'].forEach(curr => {
                const amount = parseFloat(curr.amount) || 0;
                if (amount < 0) {
                    if (curr.currency_id === 'd0_4') {
                        totalDebtUSD += Math.abs(amount);
                    } else {
                        totalDebtUZS += Math.abs(amount);
                    }
                }
            });
        } else if (b.balance < 0) {
            totalDebtUZS += Math.abs(b.balance);
        }

        if (b.balance < 0) {
            debtorCount++;
        }
    });

    console.log(`\n  💵 Qarzdorlik UZS: ${totalDebtUZS.toLocaleString()} so'm`);
    console.log(`  💲 Qarzdorlik USD: ${totalDebtUSD.toLocaleString()} $`);
    console.log(`  👥 Qarzdorlar soni: ${debtorCount}`);

    // 2. To'lovlar
    console.log('\n' + '='.repeat(60));
    console.log('📌 2. TO\'LOVLAR (getPayment):\n');

    let allPayments = [];
    page = 1;
    hasMore = true;

    while (hasMore && page <= 10) {
        const data = await apiCall(auth, 'getPayment', { page, limit: 1000 });
        if (data.result?.payment?.length > 0) {
            console.log(`  Sahifa ${page}: ${data.result.payment.length} ta`);
            allPayments = allPayments.concat(data.result.payment);
            if (data.result.payment.length < 1000) hasMore = false;
            else page++;
        } else {
            hasMore = false;
        }
    }

    console.log(`\n  ✅ Jami to'lovlar: ${allPayments.length}`);

    // To'lovlarni hisoblash
    let totalPaymentsUZS = 0;
    let totalPaymentsUSD = 0;

    allPayments.forEach(p => {
        const amount = parseFloat(p.amount) || 0;
        const paymentTypeId = p.paymentType?.SD_id;

        if (paymentTypeId === 'd0_4') {
            totalPaymentsUSD += amount;
        } else {
            totalPaymentsUZS += amount;
        }
    });

    console.log(`\n  💵 To'lovlar UZS: ${totalPaymentsUZS.toLocaleString()} so'm`);
    console.log(`  💲 To'lovlar USD: ${totalPaymentsUSD.toLocaleString()} $`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ TEKSHIRISH YAKUNLANDI\n');
}

checkDebtAndPayments().catch(console.error);
