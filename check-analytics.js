const fetch = require('node-fetch');
const url = 'https://rafiq.salesdoc.io/api/v2/';
const auth = { userId: 'd0_67', token: '460e6b260534c4b7d005fea460d5feda' };

async function checkAllMethods() {
    console.log('📊 Analitika metodlarini qidirish...\n');

    // Analitikaga tegishli metodlar
    const methods = [
        // Qarz va to'lov
        'getDebt', 'getDebts', 'getClientDebt', 'getClientDebts',
        'getPayment', 'getPayments', 'getTransaction', 'getTransactions',
        'getCashflow', 'getCash', 'getBalance', 'getBalances',

        // Hisobotlar
        'getReport', 'getReports', 'getDashboard', 'getSummary',
        'getStatistics', 'getAnalytics', 'getFinance', 'getFinancial',

        // Xarajatlar
        'getExpense', 'getExpenses', 'getCost', 'getCosts',
        'getOutcome', 'getOutgoing',

        // Foyda
        'getProfit', 'getProfits', 'getIncome', 'getRevenue',

        // Hisobvaraq
        'getInvoice', 'getInvoices', 'getReceipt', 'getReceipts',

        // Kassa
        'getCashDesk', 'getCassa', 'getKassa',

        // Debitor
        'getDebtor', 'getDebtors', 'getReceivable', 'getReceivables'
    ];

    const workingMethods = [];

    for (const method of methods) {
        try {
            const r = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ auth, method, params: {} })
            });
            const d = await r.json();

            if (d.status === true) {
                console.log(`✅ ${method} - ISHLAYDI!`);
                console.log(`   Keys: ${Object.keys(d.result || {}).join(', ')}`);
                workingMethods.push({ method, result: d.result });
            }
        } catch (e) { }
    }

    console.log('\n' + '='.repeat(50));
    console.log('ISHLAYDIGAN METODLAR:');
    console.log('='.repeat(50));

    if (workingMethods.length > 0) {
        for (const m of workingMethods) {
            console.log(`\n📦 ${m.method}:`);
            console.log(JSON.stringify(m.result, null, 2).substring(0, 500));
        }
    } else {
        console.log('Qo\'shimcha metodlar topilmadi');
    }

    // Client Debts - maxsus tekshirish
    console.log('\n\n📋 MIJOZLAR QARZI (getClient orqali):');
    const clientRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth, method: 'getClient', params: {} })
    });
    const clientData = await clientRes.json();

    if (clientData.result?.client) {
        const clients = clientData.result.client;
        // Qarzi bor mijozlar
        let totalDebt = 0;
        let debtClients = 0;

        clients.forEach(c => {
            if (c.debt && c.debt > 0) {
                debtClients++;
                totalDebt += c.debt;
            }
        });

        console.log(`Jami mijozlar: ${clients.length}`);
        console.log(`Qarzi bor: ${debtClients}`);
        console.log(`Jami qarz: ${totalDebt.toLocaleString()} so'm`);

        // Birinchi mijoz strukturasi
        if (clients[0]) {
            console.log('\nMijoz strukturasi:');
            console.log(Object.keys(clients[0]).join(', '));
        }
    }
}

checkAllMethods().catch(console.error);
