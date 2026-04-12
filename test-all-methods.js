/**
 * Sales Doctor API barcha mavjud metodlarni tekshirish
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

async function testAllMethods() {
    console.log('🔍 SALES DOCTOR API BARCHA METODLARNI TEKSHIRISH\n');

    const auth = await freshLogin();
    console.log(`✅ Login: ${auth.userId}\n`);

    // Mumkin bo'lgan metodlar ro'yxati
    const methods = [
        // Balance/Debt related
        'getBalance',
        'getBalances',
        'getDebt',
        'getDebts',
        'getDebtors',
        'getCreditors',
        'getClientBalance',
        'getClientBalances',
        'getBalanceReport',
        'getDebtReport',
        'getBalanceSummary',
        'getDebtSummary',

        // Transaction related
        'getTransaction',
        'getTransactions',
        'getClientTransaction',
        'getClientTransactions',

        // Client related
        'getClient',
        'getClients',

        // Payment related
        'getPayment',
        'getPayments',

        // Order related
        'getOrder',
        'getOrders',

        // Reports
        'getReport',
        'getReports',
        'getSummary',
        'getDashboard',
        'getStats',
        'getStatistics',

        // API info
        'getMethods',
        'getApiMethods',
        'help',
        'getHelp',
        'info',
        'getInfo'
    ];

    console.log('='.repeat(70));
    console.log('📌 METODLARNI TEKSHIRISH:\n');

    for (const method of methods) {
        try {
            const data = await apiCall(auth, method, { limit: 1 });

            if (data.status === true) {
                const resultKeys = data.result ? Object.keys(data.result) : [];
                console.log(`✅ ${method.padEnd(25)} - ISHLAYDI (${resultKeys.join(', ')})`);
            } else {
                // Xato - lekin bu metodlar mavjud bo'lmasligi mumkin
                const errorMsg = typeof data.error === 'object' ? JSON.stringify(data.error) : (data.error || 'Xatolik');
                console.log(`❌ ${method.padEnd(25)} - ${errorMsg.substring(0, 40)}`);
            }
        } catch (e) {
            console.log(`⚠️ ${method.padEnd(25)} - EXCEPTION: ${e.message.substring(0, 30)}`);
        }
    }

    // Ishlaydigan metodlardan ma'lumot olish
    console.log('\n' + '='.repeat(70));
    console.log('📌 ISHLAYDIGAN METODLAR MA\'LUMOTI:\n');

    // getBalance batafsil
    const balanceData = await apiCall(auth, 'getBalance', { limit: 5 });
    if (balanceData.result?.balance) {
        console.log('getBalance javob strukturasi:');
        console.log('  pagination:', balanceData.pagination);
        console.log('  balance[0] kalitlari:', Object.keys(balanceData.result.balance[0] || {}));
    }

    // getPayment batafsil
    const paymentData = await apiCall(auth, 'getPayment', { limit: 5 });
    if (paymentData.result?.payment?.length > 0) {
        console.log('\ngetPayment javob strukturasi:');
        console.log('  pagination:', paymentData.pagination);
        console.log('  payment[0] kalitlari:', Object.keys(paymentData.result.payment[0] || {}));
    }

    // getOrder batafsil
    const orderData = await apiCall(auth, 'getOrder', { limit: 5 });
    if (orderData.result?.order?.length > 0) {
        console.log('\ngetOrder javob strukturasi:');
        console.log('  pagination:', orderData.pagination);
        console.log('  order[0] kalitlari:', Object.keys(orderData.result.order[0] || {}));
    } else {
        console.log('\ngetOrder: Buyurtmalar yo\'q yoki dostup cheklangan');
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ YAKUNLANDI\n');
}

testAllMethods().catch(console.error);
