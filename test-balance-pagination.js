/**
 * getBalance pagination va limit tekshirish
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

async function testPagination() {
    console.log('🔍 getBalance PAGINATION TEST\n');

    const auth = await freshLogin();
    console.log(`✅ Login: ${auth.userId}\n`);

    console.log('='.repeat(60));
    console.log('📌 1. TURLI LIMITLAR BILAN TEST:\n');

    const limits = [100, 500, 1000, 2000, 5000, 10000, 50000];

    for (const limit of limits) {
        const data = await apiCall(auth, 'getBalance', { limit });
        const balances = data.result?.balance || [];
        console.log(`  limit=${limit.toString().padStart(5)}: ${balances.length} ta balans`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('📌 2. PAGINATION BILAN TEST (page parametri):\n');

    let allBalances = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 10) {
        const data = await apiCall(auth, 'getBalance', { page, limit: 500 });
        const balances = data.result?.balance || [];
        console.log(`  page=${page}: ${balances.length} ta balans`);

        if (balances.length > 0) {
            if (page === 1) {
                allBalances = balances;
            } else {
                // Yangi balanslar bormi tekshirish
                const newBalances = balances.filter(b =>
                    !allBalances.some(ab => ab.client_id === b.client_id && ab.balance === b.balance)
                );
                console.log(`       Yangi balanslar: ${newBalances.length}`);
                allBalances = allBalances.concat(newBalances);
            }
            page++;
        } else {
            hasMore = false;
        }

        if (balances.length < 500) {
            hasMore = false;
        }
    }

    console.log(`\n  Jami yig'ilgan: ${allBalances.length}`);

    console.log('\n' + '='.repeat(60));
    console.log('📌 3. OFFSET BILAN TEST:\n');

    for (let offset = 0; offset <= 2000; offset += 500) {
        const data = await apiCall(auth, 'getBalance', { offset, limit: 500 });
        const balances = data.result?.balance || [];
        console.log(`  offset=${offset.toString().padStart(4)}, limit=500: ${balances.length} ta balans`);
        if (balances.length === 0) break;
    }

    console.log('\n' + '='.repeat(60));
    console.log('📌 4. GETCLIENTS BILAN SOLISHTIRISH:\n');

    const clientsData = await apiCall(auth, 'getClient', { limit: 10000 });
    const clients = clientsData.result?.client || [];
    console.log(`  getClient: ${clients.length} ta mijoz`);
    console.log(`  getBalance: 1262 ta balans`);
    console.log(`  Farq: ${Math.abs(clients.length - 1262)} ta`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ YAKUNLANDI\n');
}

testPagination().catch(console.error);
