/**
 * GETPAYMENT SANA FILTRI BILAN - to'g'ri parametrlarni topish
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

async function testDateFilters() {
    console.log('🔍 GETPAYMENT SANA FILTRLARI\n');

    const auth = await freshLogin();
    console.log(`✅ Login: ${auth.userId}\n`);

    // URL'dan paramеtrlarni aniqlaymiz:
    // bydate=DATE&datestart=&endstart=&filter=Фильтр

    const today = '2026-02-05';
    const monthStart = '2026-02-01';
    const yearStart = '2026-01-01';

    console.log('='.repeat(70));
    console.log('📌 TURLI SANA PARAMETRLARI:\n');

    const dateParams = [
        // URL parametrlari asosida
        { bydate: 'DATE', datestart: monthStart, endstart: today },
        { bydate: 'DATE', datestart: monthStart, dateto: today },
        { bydate: true, datestart: monthStart, dateend: today },

        // Standard parametrlar
        { dateFrom: monthStart, dateTo: today },
        { date_from: monthStart, date_to: today },
        { startDate: monthStart, endDate: today },
        { start_date: monthStart, end_date: today },
        { from: monthStart, to: today },
        { dateStart: monthStart, dateEnd: today },

        // Filter ichida
        { filter: { dateFrom: monthStart, dateTo: today } },
        { filter: { from: monthStart, to: today } },
        { filter: { startDate: monthStart, endDate: today } },

        // Period
        { period: { from: monthStart, to: today } },
        { period: { start: monthStart, end: today } },
        { period: 'month' },
        { period: 'today' },
        { period: 'week' },

        // Date single
        { date: today },
        { paymentDate: today },
        { created_at: { from: monthStart, to: today } },
    ];

    // Default natija (filtrsiz)
    const defaultData = await apiCall(auth, 'getPayment', { limit: 1 });
    const defaultTotal = defaultData.pagination?.total || 0;
    console.log(`  Default (filtrsiz): ${defaultTotal} ta to'lov\n`);

    for (const params of dateParams) {
        try {
            const data = await apiCall(auth, 'getPayment', { ...params, limit: 1 });
            const total = data.pagination?.total;
            const count = data.result?.payment?.length || 0;

            // Faqat farq qiladigan natijalarni ko'rsat
            if (total !== undefined && total !== defaultTotal) {
                console.log(`  ✅ ${JSON.stringify(params).substring(0, 60)}`);
                console.log(`     Total: ${total} (farq: ${total - defaultTotal})\n`);
            }
        } catch (e) {
            // skip
        }
    }

    // TransactionType filtri
    console.log('\n' + '='.repeat(70));
    console.log('📌 TRANSACTIONTYPE FILTRI:\n');

    for (const txType of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
        const data = await apiCall(auth, 'getPayment', { transactionType: txType, limit: 1 });
        const total = data.pagination?.total;
        if (total !== undefined && total !== defaultTotal) {
            console.log(`  Type ${txType}: ${total} ta`);
        }
    }

    // Barcha to'lovlarni olib, yangilarini sanash
    console.log('\n' + '='.repeat(70));
    console.log('📌 BARCHA TO\'LOVLARNI TAHLIL QILISH:\n');

    const allData = await apiCall(auth, 'getPayment', { limit: 1000 });
    const payments = allData.result?.payment || [];
    console.log(`  Jami olingan: ${payments.length}`);
    console.log(`  API total: ${allData.pagination?.total}`);

    // Fevral to'lovlari
    const febPayments = payments.filter(p => p.paymentDate?.startsWith('2026-02'));
    console.log(`\n  Fevral 2026: ${febPayments.length} ta`);

    // TransactionType bo'yicha
    const byTxType = {};
    payments.forEach(p => {
        const type = p.transactionType;
        if (!byTxType[type]) byTxType[type] = { count: 0, sum: 0 };
        byTxType[type].count++;
        byTxType[type].sum += parseFloat(p.amount) || 0;
    });

    console.log('\n  TransactionType statistikasi:');
    for (const [type, data] of Object.entries(byTxType)) {
        console.log(`    Type ${type}: ${data.count} ta, ${data.sum.toLocaleString()}`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ YAKUNLANDI\n');
}

testDateFilters().catch(console.error);
