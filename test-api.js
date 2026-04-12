/**
 * Sales Doctor API Method Discovery Script
 */

const fetch = require('node-fetch');

const serverUrl = 'https://rafiq.salesdoc.io/api/v2/';
const userId = 'd0_67';
const token = '460e6b260534c4b7d005fea460d5feda';

// Ko'plab mumkin bo'lgan metodlarni sinash
const methodsToTry = [
    // Common patterns
    'getOrders', 'orders', 'order', 'getOrder', 'orderList',
    'getProducts', 'products', 'product', 'getProduct', 'productList',
    'getClients', 'clients', 'client', 'getClient', 'clientList',
    'getAgents', 'agents', 'agent', 'getAgent', 'agentList',
    'getSales', 'sales', 'sale', 'getSale',
    'getStock', 'stock', 'stocks', 'getStocks',
    'getWarehouse', 'warehouse', 'warehouses',
    'getReport', 'report', 'reports',
    'getUser', 'user', 'users',
    'getBranch', 'branch', 'branches',
    'getCategory', 'category', 'categories',
    'getPrices', 'prices', 'price',
    'getBalance', 'balance', 'balances',
    'getDebt', 'debt', 'debts',
    'getPayment', 'payment', 'payments',
    'getVisit', 'visit', 'visits',
    'getRoute', 'route', 'routes',
    'getTask', 'task', 'tasks',
    'getData', 'data',
    'getInfo', 'info',
    'getList', 'list',
    'getDashboard', 'dashboard',
    'getStatistics', 'statistics', 'stats',
    'getAnalytics', 'analytics',
    'reference', 'references', 'getReference',
    'directory', 'directories', 'getDirectory',
    'catalog', 'catalogs', 'getCatalog',
    'item', 'items', 'getItems',
    'entity', 'entities', 'getEntities',
    'record', 'records', 'getRecords',
    'getOutlets', 'outlets', 'outlet',
    'getDistributors', 'distributors',
    'getDocuments', 'documents', 'document',
    'getInvoices', 'invoices', 'invoice',
    'getReceipts', 'receipts', 'receipt',
    'getReturns', 'returns', 'return',
    'getMethods', 'methods', 'help', 'api', 'version',
    // Sales Doctor specific guesses
    'get', 'post', 'sync', 'upload', 'download',
    'getAll', 'getById', 'search', 'find',
    'mobile', 'getMobile', 'app', 'getApp',
    // Russian transliterated
    'tovary', 'tovar', 'klienty', 'klient',
    'zayavki', 'zayavka', 'agenty', 'agent',
    'prodazhi', 'sklad', 'ostatki', 'dolgi'
];

async function testMethods() {
    console.log(`\n🔍 ${methodsToTry.length} ta metodlarni sinash...\n`);
    console.log(`🔐 userId: ${userId}`);
    console.log(`🔑 token: ${token.substring(0, 10)}...`);
    console.log('');

    const workingMethods = [];
    const otherErrors = [];

    for (const method of methodsToTry) {
        try {
            const res = await fetch(serverUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    auth: { userId, token },
                    method: method,
                    params: {}
                })
            });

            const data = await res.json();

            if (data.status === true) {
                console.log(`✅ "${method}" - ISHLADI!`);
                if (data.result) {
                    const resultType = Array.isArray(data.result)
                        ? `Array (${data.result.length} ta)`
                        : typeof data.result;
                    console.log(`   📊 Result: ${resultType}`);
                    if (Array.isArray(data.result) && data.result.length > 0) {
                        console.log(`   🔑 Keys: ${Object.keys(data.result[0]).slice(0, 5).join(', ')}...`);
                    } else if (typeof data.result === 'object') {
                        console.log(`   🔑 Keys: ${Object.keys(data.result).slice(0, 5).join(', ')}...`);
                    }
                }
                workingMethods.push({ method, result: data.result });
            } else if (data.error?.code !== 402 && data.code !== 402) {
                // 402 = Invalid method, boshqa xatolarni yig'amiz
                otherErrors.push({ method, error: data.error || data });
            }
        } catch (e) {
            // Network errors - skip
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ ISHLAYDIGAN METODLAR:');
    console.log('='.repeat(50));
    if (workingMethods.length > 0) {
        workingMethods.forEach(m => console.log(`  - ${m.method}`));
    } else {
        console.log('  Hech qanday metod topilmadi :(');
    }

    if (otherErrors.length > 0) {
        console.log('\n⚠️ BOSHQA XATOLI METODLAR:');
        otherErrors.forEach(e => console.log(`  - ${e.method}: ${JSON.stringify(e.error)}`));
    }

    return workingMethods;
}

testMethods().then(results => {
    if (results.length > 0) {
        console.log('\n📦 Birinchi ishlaydigan metodning namunasi:');
        console.log(JSON.stringify(results[0].result, null, 2).substring(0, 500));
    }
}).catch(console.error);
