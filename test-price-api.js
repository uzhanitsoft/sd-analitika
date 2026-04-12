const fetch = require('node-fetch');

async function getCatalogPrices() {
    const serverUrl = 'rafiq.salesdoc.io';
    const webBase = `https://${serverUrl}`;
    let cookies = {};

    // Login
    const page1 = await fetch(webBase + '/site/login', { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'manual' });
    (page1.headers.raw()['set-cookie'] || []).forEach(c => { const p = c.split(';')[0].split('='); cookies[p[0].trim()] = p.slice(1).join('=').trim(); });
    let cookieStr = Object.keys(cookies).map(k => k + '=' + cookies[k]).join('; ');
    const loginRes = await fetch(webBase + '/site/login', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': cookieStr, 'User-Agent': 'Mozilla/5.0' },
        body: `LoginForm[username]=admin&LoginForm[password]=1234567rafiq&LoginForm[rememberMe]=1`, redirect: 'manual'
    });
    (loginRes.headers.raw()['set-cookie'] || []).forEach(c => { const p = c.split(';')[0].split('='); cookies[p[0].trim()] = p.slice(1).join('=').trim(); });
    const loc = loginRes.headers.get('location');
    if (loc) {
        const fullUrl = loc.startsWith('http') ? loc : webBase + loc;
        const rr = await fetch(fullUrl, { headers: { 'Cookie': cookieStr, 'User-Agent': 'Mozilla/5.0' }, redirect: 'manual' });
        (rr.headers.raw()['set-cookie'] || []).forEach(c => { const p = c.split(';')[0].split('='); cookies[p[0].trim()] = p.slice(1).join('=').trim(); });
    }
    cookieStr = Object.keys(cookies).map(k => k + '=' + cookies[k]).join('; ');

    // POST /catalog — narxlar bilan
    console.log('=== POST /catalog ===');
    const res = await fetch(webBase + '/catalog', {
        method: 'POST',
        headers: {
            'Cookie': cookieStr,
            'User-Agent': 'Mozilla/5.0',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
            active: {
                priceTypes: ['id', 'name', 'type', 'currency'],
            },
            all: {
                prices: ['id', 'price_type_id', 'product_id', 'price'],
            }
        })
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Length:', text.length);

    if (text.startsWith('{') || text.startsWith('[')) {
        const json = JSON.parse(text);

        // PriceTypes
        if (json.priceTypes) {
            console.log('\nPriceTypes count:', json.priceTypes.length);
            console.log('First 3:', JSON.stringify(json.priceTypes.slice(0, 3), null, 2));
        }

        // Prices
        if (json.prices) {
            console.log('\nPrices count:', json.prices.length);
            console.log('First 5:', JSON.stringify(json.prices.slice(0, 5), null, 2));

            // Statistika
            const byPriceType = {};
            json.prices.forEach(p => {
                const pt = p.price_type_id || p[1] || 'unknown';
                byPriceType[pt] = (byPriceType[pt] || 0) + 1;
            });
            console.log('\n--- Prices per priceType ---');
            Object.entries(byPriceType).sort((a, b) => b[1] - a[1]).forEach(([pt, count]) => {
                const typeInfo = json.priceTypes?.find(t => (t.id || t[0]) === pt);
                const name = typeInfo ? (typeInfo.name || typeInfo[1]) : 'Unknown';
                console.log(`  ${pt}: ${count} prices (${name})`);
            });
        }
    } else {
        console.log('Non-JSON response:', text.substring(0, 300));
    }
}

getCatalogPrices().catch(console.error);
