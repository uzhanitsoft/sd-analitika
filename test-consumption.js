const fetch = require('node-fetch');

(async () => {
    const webBase = 'https://rafiq.salesdoc.io';
    const login = 'admin';
    const password = '1234567rafiq';
    let cookies = {};
    
    // Login
    const page1 = await fetch(webBase + '/site/login', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        redirect: 'manual'
    });
    (page1.headers.raw()['set-cookie'] || []).forEach(c => {
        const parts = c.split(';')[0].split('=');
        cookies[parts[0].trim()] = parts.slice(1).join('=').trim();
    });
    
    let cookieStr = Object.keys(cookies).map(k => k + '=' + cookies[k]).join('; ');
    const loginRes = await fetch(webBase + '/site/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': cookieStr,
            'User-Agent': 'Mozilla/5.0'
        },
        body: `LoginForm[username]=${login}&LoginForm[password]=${password}&LoginForm[rememberMe]=1`,
        redirect: 'manual'
    });
    (loginRes.headers.raw()['set-cookie'] || []).forEach(c => {
        const parts = c.split(';')[0].split('=');
        cookies[parts[0].trim()] = parts.slice(1).join('=').trim();
    });
    
    const loc = loginRes.headers.get('location');
    if (loc) {
        const fullUrl = loc.startsWith('http') ? loc : webBase + loc;
        const rr = await fetch(fullUrl, {
            headers: { 'Cookie': cookieStr, 'User-Agent': 'Mozilla/5.0' },
            redirect: 'manual'
        });
        (rr.headers.raw()['set-cookie'] || []).forEach(c => {
            const parts = c.split(';')[0].split('=');
            cookies[parts[0].trim()] = parts.slice(1).join('=').trim();
        });
    }
    
    cookieStr = Object.keys(cookies).map(k => k + '=' + cookies[k]).join('; ');
    
    // Get consumption page HTML and look for AJAX urls, script blocks, etc.
    const res = await fetch(webBase + '/finans/consumption', {
        headers: { 'Cookie': cookieStr, 'User-Agent': 'Mozilla/5.0' }
    });
    const html = await res.text();
    
    // Find all ajax/url references
    const ajaxMatches = html.match(/url[\s]*:[\s]*['"]([^'"]+)['"]/g) || [];
    console.log('AJAX URLs found:', ajaxMatches.length);
    ajaxMatches.forEach(m => console.log(' ', m));
    
    // Find DataTable init
    const dtMatches = html.match(/DataTable\s*\(\s*\{[^}]*\}/g) || [];
    console.log('\nDataTable init blocks:', dtMatches.length);
    dtMatches.forEach(m => console.log(' ', m.substring(0, 200)));
    
    // Find all /finans/ references
    const finansMatches = html.match(/\/finans\/[a-zA-Z\/-]+/g) || [];
    const uniqueFinans = [...new Set(finansMatches)];
    console.log('\n/finans/ URLs:', uniqueFinans.length);
    uniqueFinans.forEach(u => console.log(' ', u));
    
    // Extract table rows from HTML
    const trMatches = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
    console.log('\nTable rows found:', trMatches.length);
    
    // Look for JSON data embedded in page 
    const varMatches = html.match(/var\s+\w+\s*=\s*\[[\s\S]*?\];/g) || [];
    console.log('\nJS var arrays:', varMatches.length);
    
    // Look for tbody content
    const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/i);
    if (tbodyMatch) {
        const tbody = tbodyMatch[1];
        const rows = tbody.match(/<tr[\s\S]*?<\/tr>/gi) || [];
        console.log('\nTbody rows:', rows.length);
        if (rows.length > 0) {
            // Parse first row
            const tds = rows[0].match(/<td[\s\S]*?<\/td>/gi) || [];
            console.log('First row cells:', tds.length);
            tds.forEach((td, i) => {
                const text = td.replace(/<[^>]+>/g, '').trim();
                console.log(`  [${i}]: ${text.substring(0, 100)}`);
            });
        }
    }
})();
