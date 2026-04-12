// API pagination muammosini tekshirish
const fetch = require('node-fetch');

async function main() {
    const loginRes = await fetch('https://rafiq.salesdoc.io/api/v2/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'login', auth: { login: 'admin', password: '1234567rafiq' } })
    });
    const { userId, token } = (await loginRes.json()).result;
    console.log('✅ Login OK\n');

    async function api(method, params = {}) {
        const r = await fetch('https://rafiq.salesdoc.io/api/v2/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ auth: { userId, token }, method, params })
        });
        return r.json();
    }

    // Test 1: DateFilter bilan pagination (server.js kabi)
    console.log('═══ TEST 1: DateFilter BILAN (server.js kabi) ═══');
    const startDate = '2025-02-10';
    const endDate = '2026-02-10';
    let total1 = 0;
    let page = 1;
    const limit = 500;
    while (page <= 10) {
        const data = await api('getOrder', {
            page, limit,
            filter: { status: 'all', startDate, endDate }
        });
        const items = data?.result?.order || [];
        console.log(`  Sahifa ${page}: ${items.length} ta`);
        total1 += items.length;
        if (items.length === 0 || items.length < limit) break;
        page++;
    }
    console.log(`  JAMI: ${total1} ta\n`);

    // Test 2: DateFilter SIZ pagination
    console.log('═══ TEST 2: DateFilter SIZ ═══');
    let total2 = 0;
    page = 1;
    while (page <= 10) {
        const data = await api('getOrder', {
            page, limit,
            filter: { status: 'all' }
        });
        const items = data?.result?.order || [];
        console.log(`  Sahifa ${page}: ${items.length} ta`);
        total2 += items.length;
        if (items.length === 0 || items.length < limit) break;
        page++;
    }
    console.log(`  JAMI: ${total2} ta\n`);

    // Test 3: limit=1000 bilan
    console.log('═══ TEST 3: limit=1000, filtersiz ═══');
    let total3 = 0;
    page = 1;
    while (page <= 10) {
        const data = await api('getOrder', {
            page, limit: 1000,
            filter: { status: 'all' }
        });
        const items = data?.result?.order || [];
        console.log(`  Sahifa ${page}: ${items.length} ta`);
        total3 += items.length;
        if (items.length === 0 || items.length < 1000) break;
        page++;
    }
    console.log(`  JAMI: ${total3} ta\n`);

    // Test 4: DateFilter bilan, limit=1000 
    console.log('═══ TEST 4: limit=1000, DateFilter BILAN ═══');
    let total4 = 0;
    page = 1;
    while (page <= 10) {
        const data = await api('getOrder', {
            page, limit: 1000,
            filter: { status: 'all', startDate, endDate }
        });
        const items = data?.result?.order || [];
        console.log(`  Sahifa ${page}: ${items.length} ta`);
        total4 += items.length;
        if (items.length === 0 || items.length < 1000) break;
        page++;
    }
    console.log(`  JAMI: ${total4} ta\n`);

    console.log('═══ XULOSA ═══');
    console.log(`  DateFilter BILAN, limit=500:  ${total1} ta`);
    console.log(`  DateFilter SIZ, limit=500:    ${total2} ta`);
    console.log(`  limit=1000, filtersiz:        ${total3} ta`);
    console.log(`  limit=1000, DateFilter BILAN: ${total4} ta`);
}

main().catch(console.error);
