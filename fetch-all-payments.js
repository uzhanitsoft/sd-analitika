/**
 * BARCHA TO'LOVLARNI OLISH VA TO'G'RI HISOBLASH
 * getPayment total: 2313 - pagination bilan barcha sahifalarni olish
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

async function fetchAllPayments() {
    console.log('🔍 BARCHA TO\'LOVLARNI OLISH (2313 ta)\n');

    const auth = await freshLogin();
    console.log(`✅ Login: ${auth.userId}\n`);

    // Pagination bilan barcha to'lovlarni olish
    let allPayments = [];
    let page = 1;
    const limit = 1000;

    console.log('='.repeat(70));
    console.log('📌 PAGINATION BILAN BARCHA TO\'LOVLARNI OLISH:\n');

    while (true) {
        const data = await apiCall(auth, 'getPayment', { page, limit });
        const payments = data.result?.payment || [];

        console.log(`  Page ${page}: ${payments.length} ta to'lov (jami: ${data.pagination?.total || '?'})`);

        if (payments.length === 0) break;

        allPayments = allPayments.concat(payments);

        // Agar oxirgi sahifa bo'lsa
        if (payments.length < limit) break;

        page++;

        // Xavfsizlik cheklovi
        if (page > 10) {
            console.log('  ⚠️ 10 sahifadan ko\'p - to\'xtatildi');
            break;
        }
    }

    console.log(`\n  JAMI OLINGAN: ${allPayments.length} ta to'lov`);

    // To'lovlarni valyuta bo'yicha hisoblash
    console.log('\n' + '='.repeat(70));
    console.log('📌 TO\'LOVLAR VALYUTA BO\'YICHA:\n');

    const paymentTotals = {
        'd0_2': 0,  // Naqd so'm
        'd0_3': 0,  // Beznal so'm
        'd0_4': 0,  // Dollar
        'unknown': 0
    };

    const paymentTypeCounts = {};

    allPayments.forEach(p => {
        const amount = parseFloat(p.amount) || 0;
        const typeId = p.paymentType?.SD_id;
        const typeName = p.paymentType?.name || 'Noma\'lum';

        // Turlarni hisoblash
        if (!paymentTypeCounts[typeName]) {
            paymentTypeCounts[typeName] = { count: 0, sum: 0, id: typeId };
        }
        paymentTypeCounts[typeName].count++;
        paymentTypeCounts[typeName].sum += amount;

        // Valyuta bo'yicha yig'ish
        if (paymentTotals.hasOwnProperty(typeId)) {
            paymentTotals[typeId] += amount;
        } else {
            paymentTotals['unknown'] += amount;
        }
    });

    console.log('  To\'lov turlari:');
    for (const [name, data] of Object.entries(paymentTypeCounts)) {
        console.log(`    ${name.padEnd(25)}: ${data.count.toString().padStart(5)} ta, ${data.sum.toLocaleString().padStart(20)} (${data.id})`);
    }

    console.log('\n  Valyuta bo\'yicha jami:');
    console.log(`    Naqd so'm (d0_2):    ${paymentTotals['d0_2'].toLocaleString()}`);
    console.log(`    Beznal so'm (d0_3):  ${paymentTotals['d0_3'].toLocaleString()}`);
    console.log(`    Dollar (d0_4):       ${paymentTotals['d0_4'].toLocaleString()}`);
    console.log(`    Noma'lum:            ${paymentTotals['unknown'].toLocaleString()}`);

    // Yangi va eski hisoblash solishtirish
    console.log('\n' + '='.repeat(70));
    console.log('📌 YANGI VA ESKI HISOBLASH SOLISHTIRISH:\n');

    console.log('  Eski usul (998 ta to\'lov):');
    console.log('    Naqd so\'m:   535,355,140');
    console.log('    Beznal so\'m: 3,771,901');
    console.log('    Dollar:      169,366');

    console.log('\n  Yangi usul (' + allPayments.length + ' ta to\'lov):');
    console.log(`    Naqd so'm:   ${paymentTotals['d0_2'].toLocaleString()}`);
    console.log(`    Beznal so'm: ${paymentTotals['d0_3'].toLocaleString()}`);
    console.log(`    Dollar:      ${paymentTotals['d0_4'].toLocaleString()}`);

    console.log('\n' + '='.repeat(70));
    console.log('✅ YAKUNLANDI\n');
}

fetchAllPayments().catch(console.error);
