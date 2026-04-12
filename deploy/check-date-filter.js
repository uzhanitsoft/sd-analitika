/**
 * Sana filtrini tekshirish - API haqiqatan bugunni olyaptimi?
 */
const fetch = require('node-fetch');

const API_URL = 'https://rafiq.salesdoc.io/api/v2/';

var today = new Date();
var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

console.log('Bugungi sana: ' + todayStr);
console.log('');

async function main() {
    // Login
    var loginRes = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'login', auth: { login: 'admin', password: '1234567rafiq' } })
    });
    var loginData = await loginRes.json();
    var auth = { userId: loginData.result.userId, token: loginData.result.token };
    console.log('Login OK');

    // 1. Bugungi buyurtmalar (sana filtri bilan)
    console.log('');
    console.log('=== SANA FILTRI BILAN (startDate=' + todayStr + ', endDate=' + todayStr + ') ===');

    var allOrders = [];
    var page = 1;
    var hasMore = true;

    while (hasMore && page <= 20) {
        var res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                auth: auth,
                method: 'getOrder',
                params: {
                    page: page, limit: 500,
                    filter: { status: 'all', startDate: todayStr, endDate: todayStr }
                }
            })
        });
        var data = await res.json();
        var orders = (data.result && data.result.order) ? data.result.order : [];
        console.log('  Sahifa ' + page + ': ' + orders.length + ' ta buyurtma');
        if (orders.length > 0) {
            allOrders = allOrders.concat(orders);
            hasMore = orders.length === 500;
            page++;
        } else {
            hasMore = false;
        }
    }

    console.log('Jami: ' + allOrders.length + ' ta buyurtma');

    // Sanalarni tekshirish - haqiqatan bugunmi?
    var dateCounts = {};
    allOrders.forEach(function (o) {
        var d = (o.dateCreate || o.dateDocument || '').split('T')[0].split(' ')[0];
        if (!dateCounts[d]) dateCounts[d] = 0;
        dateCounts[d]++;
    });

    console.log('');
    console.log('=== BUYURTMALAR SANA BO\'YICHA TARQALISHI ===');
    var sortedDates = Object.keys(dateCounts).sort();
    sortedDates.forEach(function (d) {
        var marker = (d === todayStr) ? ' <-- BUGUN' : '';
        console.log('  ' + d + ': ' + dateCounts[d] + ' ta' + marker);
    });

    // Bugungi buyurtmalar soni
    var todayCount = dateCounts[todayStr] || 0;
    var otherCount = allOrders.length - todayCount;
    console.log('');
    console.log('XULOSA:');
    console.log('  Bugungi: ' + todayCount + ' ta');
    console.log('  Boshqa kunlar: ' + otherCount + ' ta');

    if (otherCount > 0) {
        console.log('  !!! API sana filtri to\'g\'ri ishlamayapti! Boshqa kunlar ham kelmoqda');
    } else {
        console.log('  OK - Faqat bugungi buyurtmalar kelmoqda');
    }

    // 2. Eng birinchi va oxirgi buyurtma sanalari
    if (allOrders.length > 0) {
        console.log('');
        console.log('=== BIRINCHI 5 TA BUYURTMA ===');
        allOrders.slice(0, 5).forEach(function (o, i) {
            var d = o.dateCreate || o.dateDocument || '';
            var sum = parseFloat(o.totalSumma) || 0;
            var client = (o.client && o.client.clientName) ? o.client.clientName : (o.client && o.client.name) ? o.client.name : 'noma\'lum';
            console.log('  ' + (i + 1) + '. #' + o.nomer + ' | ' + d + ' | ' + sum.toLocaleString() + ' | ' + client);
        });

        console.log('');
        console.log('=== OXIRGI 5 TA BUYURTMA ===');
        allOrders.slice(-5).forEach(function (o, i) {
            var d = o.dateCreate || o.dateDocument || '';
            var sum = parseFloat(o.totalSumma) || 0;
            var client = (o.client && o.client.clientName) ? o.client.clientName : (o.client && o.client.name) ? o.client.name : 'noma\'lum';
            console.log('  ' + (i + 1) + '. #' + o.nomer + ' | ' + d + ' | ' + sum.toLocaleString() + ' | ' + client);
        });
    }

    // 3. Filtrsiz (status: 'all' faqat, sana yo'q) - 1 sahifa ko'rib
    console.log('');
    console.log('=== FILTRSIZ (faqat 1 sahifa, sana yo\'q) ===');
    var noFilterRes = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            auth: auth,
            method: 'getOrder',
            params: { page: 1, limit: 10, filter: { status: 'all' } }
        })
    });
    var noFilterData = await noFilterRes.json();
    var noFilterOrders = (noFilterData.result && noFilterData.result.order) ? noFilterData.result.order : [];
    noFilterOrders.forEach(function (o, i) {
        var d = o.dateCreate || o.dateDocument || '';
        console.log('  ' + (i + 1) + '. #' + o.nomer + ' | sana: ' + d + ' | ' + (parseFloat(o.totalSumma) || 0).toLocaleString());
    });
}

main().catch(function (e) { console.error('Xato:', e.message); });
