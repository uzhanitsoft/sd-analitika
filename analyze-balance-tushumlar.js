/**
 * BALANSDAN TUSHUMLARNI HISOBLASH
 * Sales Doctor "Поступления" - bu balans o'zgarishlari bo'lishi mumkin
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

async function calculateFromBalance() {
    console.log('🔍 BALANSDAN TUSHUMLARNI HISOBLASH\n');

    const auth = await freshLogin();
    console.log(`✅ Login: ${auth.userId}\n`);

    // Balanslarni olish
    const balData = await apiCall(auth, 'getBalance', { limit: 5000 });
    const balances = balData.result?.balance || [];
    console.log(`📊 Jami balanslar: ${balances.length}\n`);

    // Birinchi balance'ni to'liq ko'rish
    console.log('='.repeat(70));
    console.log('📌 BIRINCHI BALANCE TO\'LIQ STRUKTURASI:\n');

    if (balances[0]) {
        console.log(JSON.stringify(balances[0], null, 2));
    }

    // Balans kalitlarini tekshirish
    console.log('\n' + '='.repeat(70));
    console.log('📌 BALANCE KALITLARI:\n');

    if (balances[0]) {
        const keys = Object.keys(balances[0]);
        keys.forEach(key => {
            const val = balances[0][key];
            const type = Array.isArray(val) ? 'array' : typeof val;
            console.log(`  ${key}: ${type}`);
        });
    }

    // by-currency tahlili - faqat MUSBAT qiymatlar = To'lovlar (tushumlar)
    console.log('\n' + '='.repeat(70));
    console.log('📌 BY-CURRENCY TAHLILI:\n');

    // Sales Doctor tushumlar = MUSBAT balanslar (kreditorlar)
    // Agar mijoz bizga qarzdor bo'lsa = manfiy balans
    // Agar biz mijozga qarzdor bo'lsak = musbat balans (oldindan to'langan)

    const currencyStats = {
        'd0_2': { positive: 0, negative: 0, positiveCount: 0, negativeCount: 0 },
        'd0_3': { positive: 0, negative: 0, positiveCount: 0, negativeCount: 0 },
        'd0_4': { positive: 0, negative: 0, positiveCount: 0, negativeCount: 0 },
    };

    balances.forEach(b => {
        if (b['by-currency'] && Array.isArray(b['by-currency'])) {
            b['by-currency'].forEach(curr => {
                const amount = parseFloat(curr.amount) || 0;
                const currId = curr.currency_id;

                if (currencyStats[currId]) {
                    if (amount > 0) {
                        currencyStats[currId].positive += amount;
                        currencyStats[currId].positiveCount++;
                    } else if (amount < 0) {
                        currencyStats[currId].negative += amount;
                        currencyStats[currId].negativeCount++;
                    }
                }
            });
        }
    });

    console.log('  Valyuta      | Musbat (To\'langan)  | Manfiy (Qarzdor)     | ');
    console.log('  ' + '-'.repeat(65));

    for (const [id, stats] of Object.entries(currencyStats)) {
        console.log(`  ${id.padEnd(12)} | ${stats.positive.toLocaleString().padStart(18)} (${stats.positiveCount}) | ${stats.negative.toLocaleString().padStart(18)} (${stats.negativeCount})`);
    }

    // Sales Doctor qiymatlari bilan solishtirish
    console.log('\n' + '='.repeat(70));
    console.log('📌 SALES DOCTOR BILAN SOLISHTIRISH:\n');

    // Tushumlar = manfiy balanslarning ABSOLUT qiymati?
    // Yoki to'lovlar jami?

    console.log('  Sales Doctor Tushumlar:');
    console.log('    Наличный Сум:    178,060,817.54');
    console.log('    Безналичный Сум: 0');
    console.log('    Доллар США:      19,729.66');
    console.log('    Общий:           178,080,547.2');

    console.log('\n  Bizning hisob (MUSBAT balanslar = oldindan to\'langan):');
    console.log(`    Naqd (d0_2):     ${currencyStats['d0_2'].positive.toLocaleString()}`);
    console.log(`    Beznal (d0_3):   ${currencyStats['d0_3'].positive.toLocaleString()}`);
    console.log(`    Dollar (d0_4):   ${currencyStats['d0_4'].positive.toLocaleString()}`);

    console.log('\n  Bizning hisob (MANFIY balanslar abs = qarzdorlik):');
    console.log(`    Naqd (d0_2):     ${Math.abs(currencyStats['d0_2'].negative).toLocaleString()}`);
    console.log(`    Beznal (d0_3):   ${Math.abs(currencyStats['d0_3'].negative).toLocaleString()}`);
    console.log(`    Dollar (d0_4):   ${Math.abs(currencyStats['d0_4'].negative).toLocaleString()}`);

    // To'lovlar jami
    console.log('\n' + '='.repeat(70));
    console.log('📌 GETPAYMENT JAMI:\n');

    const payData = await apiCall(auth, 'getPayment', { limit: 1000 });
    const payments = payData.result?.payment || [];

    const payTotals = { 'd0_2': 0, 'd0_3': 0, 'd0_4': 0 };
    payments.forEach(p => {
        const amount = parseFloat(p.amount) || 0;
        const typeId = p.paymentType?.SD_id || 'd0_2';
        if (payTotals[typeId] !== undefined) {
            payTotals[typeId] += amount;
        }
    });

    console.log(`  Jami to'lovlar: ${payments.length}`);
    console.log(`  Naqd (d0_2):   ${payTotals['d0_2'].toLocaleString()}`);
    console.log(`  Beznal (d0_3): ${payTotals['d0_3'].toLocaleString()}`);
    console.log(`  Dollar (d0_4): ${payTotals['d0_4'].toLocaleString()}`);

    console.log('\n' + '='.repeat(70));
    console.log('✅ YAKUNLANDI\n');
}

calculateFromBalance().catch(console.error);
