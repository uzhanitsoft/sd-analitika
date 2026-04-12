/**
 * BARCHA API METODLARNI TO'LIQ TEKSHIRISH
 * To'lovlar (Поступления) qayerdan kelishini topish
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

async function findAllMethods() {
    console.log('🔍 BARCHA METODLARNI TOPISH\n');

    const auth = await freshLogin();
    console.log(`✅ Login: ${auth.userId}\n`);

    // Muhim metodlar ro'yxati
    const methods = [
        // Asosiy
        'getPayment', 'getBalance', 'getOrder', 'getClient', 'getAgent',
        // To'lovlar variatlari
        'getIncome', 'getIncomes', 'getReceipt', 'getReceipts',
        'getMoneyIn', 'getMoneyIncome', 'getCashIn', 'getCashflow',
        'getTransaction', 'getTransactions', 'getFinance', 'getFinances',
        // Поступления
        'getEntry', 'getEntries', 'getInflow', 'getInflux',
        // Hisobotlar
        'getReport', 'getReports', 'getSalesReport', 'getPaymentReport',
        'getBalanceReport', 'getFinanceReport', 'getCashReport',
        // Boshqa
        'getStock', 'getWarehouse', 'getProduct', 'getProducts',
        'getCategory', 'getPriceType', 'getCurrency', 'getPaymentType',
        'getSupervisor', 'getTerritory', 'getReference',
        // Trading
        'getTrade', 'getTrades', 'getTrading', 'getSale', 'getSales',
        // Kassalar
        'getCashbox', 'getCashboxes', 'getCash', 'getCashBalance',
    ];

    console.log('='.repeat(70));
    console.log('📌 ISHLAYDIGAN METODLAR:\n');

    for (const method of methods) {
        try {
            const data = await apiCall(auth, method, { limit: 10 });

            if (data.status === true && data.result) {
                const keys = Object.keys(data.result);
                const firstKey = keys[0];
                const count = Array.isArray(data.result[firstKey])
                    ? data.result[firstKey].length
                    : (data.pagination?.total || '?');

                console.log(`  ✅ ${method.padEnd(25)}: ${firstKey} (${count} ta)`);

                // Birinchi elementni ko'rsat
                if (Array.isArray(data.result[firstKey]) && data.result[firstKey][0]) {
                    const sample = data.result[firstKey][0];
                    const sampleKeys = Object.keys(sample).slice(0, 5).join(', ');
                    console.log(`     Keys: ${sampleKeys}...`);

                    // Agar summa mavjud bo'lsa
                    if (sample.amount !== undefined) {
                        console.log(`     amount: ${sample.amount}`);
                    }
                    if (sample.summa !== undefined) {
                        console.log(`     summa: ${sample.summa}`);
                    }
                }
            }
        } catch (e) {
            // skip
        }
    }

    // getPaymentType ni batafsil ko'rish - valyuta turlari
    console.log('\n' + '='.repeat(70));
    console.log('📌 TO\'LOV TURLARI (getPaymentType):\n');

    const payTypeData = await apiCall(auth, 'getPaymentType', {});
    if (payTypeData.result?.paymentType) {
        payTypeData.result.paymentType.forEach(pt => {
            console.log(`  ${pt.SD_id}: ${pt.name}`);
        });
    }

    // getCurrency - valyutalar
    console.log('\n' + '='.repeat(70));
    console.log('📌 VALYUTALAR (getCurrency):\n');

    const currData = await apiCall(auth, 'getCurrency', {});
    if (currData.result?.currency) {
        currData.result.currency.forEach(c => {
            console.log(`  ${c.SD_id}: ${c.name} (${c.code})`);
        });
    }

    // Balance by-currency batafsil
    console.log('\n' + '='.repeat(70));
    console.log('📌 BALANCE BY-CURRENCY STRUKTURASI:\n');

    const balData = await apiCall(auth, 'getBalance', { limit: 5 });
    if (balData.result?.balance?.[0]) {
        const sample = balData.result.balance[0];
        console.log('  Sample balance object:');
        console.log(`    name: ${sample.name}`);
        console.log(`    balance: ${sample.balance}`);
        console.log(`    by-currency:`, JSON.stringify(sample['by-currency'], null, 4));
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ YAKUNLANDI\n');
}

findAllMethods().catch(console.error);
