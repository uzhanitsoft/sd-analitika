/**
 * Sales Doctor - /clients/transactions/JsonData dan SROK olish
 * Bu WEB PANEL ichki API endpoint - srok bilan to'liq data qaytaradi!
 */
var fetch = require('node-fetch');
var baseUrl = 'https://rafiq.salesdoc.io';

function extractCookies(response, existing) {
    var cookies = existing || {};
    (response.headers.raw()['set-cookie'] || []).forEach(function (c) {
        var parts = c.split(';')[0].split('=');
        cookies[parts[0].trim()] = parts.slice(1).join('=').trim();
    });
    return cookies;
}
function cs(cookies) {
    return Object.keys(cookies).map(function (k) { return k + '=' + cookies[k]; }).join('; ');
}

async function main() {
    var cookies = {};
    var p1 = await fetch(baseUrl + '/site/login', { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'manual' });
    cookies = extractCookies(p1, cookies);
    var loginRes = await fetch(baseUrl + '/site/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': cs(cookies), 'User-Agent': 'Mozilla/5.0' },
        body: 'LoginForm[username]=admin&LoginForm[password]=1234567rafiq&LoginForm[rememberMe]=1',
        redirect: 'manual'
    });
    cookies = extractCookies(loginRes, cookies);
    var loc = loginRes.headers.get('location');
    if (loc) {
        var rr = await fetch(loc.startsWith('http') ? loc : baseUrl + loc, {
            headers: { 'Cookie': cs(cookies), 'User-Agent': 'Mozilla/5.0' }, redirect: 'manual'
        });
        cookies = extractCookies(rr, cookies);
    }

    // Sahifaga borish (session yaratish)
    await fetch(baseUrl + '/clients/transactions', {
        headers: { 'Cookie': cs(cookies), 'User-Agent': 'Mozilla/5.0' }
    });

    // JsonData endpointiga so'rov
    console.log('=== /clients/transactions/JsonData ===\n');
    var jsonUrl = baseUrl + '/clients/transactions/JsonData?hand=1';
    var jsonRes = await fetch(jsonUrl, {
        headers: {
            'Cookie': cs(cookies),
            'User-Agent': 'Mozilla/5.0',
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'application/json, text/plain, */*'
        }
    });
    var jsonBody = await jsonRes.text();
    console.log('Status:', jsonRes.status, 'Size:', jsonBody.length);

    try {
        var json = JSON.parse(jsonBody);
        console.log('\nTop-level keys:', Object.keys(json));

        if (json.data && Array.isArray(json.data)) {
            console.log('Data rows:', json.data.length);

            // Birinchi qator strukturasini ko'rish
            if (json.data.length > 0) {
                var first = json.data[0];
                console.log('\nBirinchi qator (array bo\'lsa indekslar):');
                if (Array.isArray(first)) {
                    first.forEach(function (val, idx) {
                        var valStr = typeof val === 'object' ? JSON.stringify(val) : String(val);
                        console.log('  [' + idx + '] = ' + valStr.substring(0, 100));
                    });
                } else {
                    console.log('Object keys:', Object.keys(first));
                    console.log(JSON.stringify(first, null, 2).substring(0, 1000));
                }

                // Table ustunlari: 0-checkbox, 1-ID, 2-Nomi, 3-Kod, 4-YurNomi, 5-TipKlient, 
                // 6-Territoriya, 7-Poseshenie, 8-Adres, 9-Telefon, 10-Komment, 
                // 11-SROK, 12-DniProsrochki, 13-INN, 14-DataPosledOplaty, 
                // 15-DniSPosledOplaty, 16-DataPosledOtgruzki, 17-SummaPosledOtgruzki,
                // 18-SummaPosledOplaty, 19-Agent, 20-KodAgenta, 21-Ekspeditor

                console.log('\n=== Birinchi 5 ta qator - SROK ma\'lumotlari ===');
                json.data.slice(0, 5).forEach(function (row, i) {
                    if (Array.isArray(row)) {
                        console.log('\n#' + (i + 1) + ': ' + (row[2] || '').substring(0, 30));
                        console.log('   Balanslar: Umumiy=' + row[3] + ', Nalichniy=' + row[4] + ', Dollar=' + row[5]);
                        console.log('   SROK: ' + row[11]);
                        console.log('   Dni prosrochki: ' + row[12]);
                        console.log('   Agent: ' + row[19]);
                    }
                });

                // "Wash Up" ni izlash (screenshotdagi mijoz)
                console.log('\n=== "Wash Up" qidirish ===');
                json.data.forEach(function (row) {
                    var name = Array.isArray(row) ? row[2] : (row.name || '');
                    if (String(name).toLowerCase().indexOf('wash') >= 0) {
                        if (Array.isArray(row)) {
                            console.log('Topildi: ' + row[2]);
                            row.forEach(function (v, idx) {
                                console.log('  [' + idx + '] = ' + String(v).substring(0, 80));
                            });
                        }
                    }
                });
            }
        }

        if (json.currency) {
            console.log('\nCurrency:', JSON.stringify(json.currency));
        }
    } catch (e) {
        console.log('JSON parse xatosi:', e.message);
        console.log('Javob (birinchi 1000 char):', jsonBody.substring(0, 1000));
    }
}

main().catch(function (e) { console.error('Xato:', e.message); });
