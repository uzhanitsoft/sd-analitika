/**
 * To'g'ri bugungi raqamlar - CLIENT-SIDE SANA FILTRI bilan
 */
var fetch = require('node-fetch');
var API_URL = 'https://rafiq.salesdoc.io/api/v2/';

var today = new Date();
var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

console.log('Sana: ' + todayStr);
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
    console.log('Login OK: userId=' + auth.userId);

    // BARCHA buyurtmalarni olish (API sana filtrini ignor qiladi)
    console.log('Barcha buyurtmalar yuklanmoqda...');
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
                params: { page: page, limit: 1000, filter: { status: 'all' } }
            })
        });
        var data = await res.json();
        var orders = (data.result && data.result.order) ? data.result.order : [];
        if (orders.length > 0) {
            allOrders = allOrders.concat(orders);
            hasMore = orders.length === 1000;
            page++;
        } else {
            hasMore = false;
        }
    }
    console.log('Jami API dan keldi: ' + allOrders.length + ' ta');

    // CLIENT-SIDE filtrlash
    var todayOrders = allOrders.filter(function (o) {
        var d = (o.dateCreate || o.dateDocument || '').split('T')[0].split(' ')[0];
        return d === todayStr;
    });

    console.log('Bugungi (filtr bilan): ' + todayOrders.length + ' ta');
    console.log('');

    // Dollar turlari
    var dollarPriceTypes = ['d0_7', 'd0_8', 'd0_11', 'd0_9', 'd0_6'];
    function isDollar(id) { return dollarPriceTypes.indexOf(id) >= 0; }

    // BUGUNGI hisoblash
    var salesUZS = 0, salesUSD = 0, returnCount = 0;
    var activeClients = {};
    var agentNames = {
        'd0_2': 'Nilufarxon', 'd0_3': 'Muxtorxon Onlem', 'd0_4': 'Ofis',
        'd0_6': 'Usmonqulov', 'd0_7': 'Axmedova', 'd0_10': 'Abduraximova',
        'd0_11': 'Aliakbar', 'd0_19': 'Soliev', 'd0_21': 'Maxmudov',
        'd0_22': 'Tojiboyev', 'd0_24': 'Xolmirzayeva', 'd0_25': 'Xolmuxamedova',
        'd0_27': 'Muxtorxon Sleppy', 'd0_12': 'Agent d0_12', 'd0_14': 'Agent d0_14',
        'd0_8': 'Agent d0_8', 'd0_28': 'Agent d0_28', 'd0_9': 'Agent d0_9',
        'd0_13': 'Agent d0_13', 'd0_23': 'Agent d0_23', 'd0_26': 'Agent d0_26'
    };
    var agentSales = {};

    todayOrders.forEach(function (order) {
        var st = order.status;
        var summa = parseFloat(order.totalSumma) || 0;
        var rets = parseFloat(order.totalReturnsSumma) || 0;
        if (st === 4 || st === 5 || (rets > 0 && rets === summa)) { returnCount++; return; }

        var sum = summa || parseFloat(order.totalSummaAfterDiscount) || 0;
        var ptId = order.paymentType ? order.paymentType.SD_id : '';
        var prId = order.priceType ? order.priceType.SD_id : '';

        if (order.client && order.client.SD_id) activeClients[order.client.SD_id] = true;

        var isUsd = (ptId === 'd0_4' || isDollar(prId));
        if (isUsd) { salesUSD += sum; } else { salesUZS += sum; }

        // Agent
        var agId = (order.agent && order.agent.SD_id) ? order.agent.SD_id : 'unknown';
        if (!agentSales[agId]) agentSales[agId] = { name: agentNames[agId] || agId, count: 0, uzs: 0, usd: 0, clients: {} };
        agentSales[agId].count++;
        if (order.client && order.client.SD_id) agentSales[agId].clients[order.client.SD_id] = true;
        if (isUsd) { agentSales[agId].usd += sum; } else { agentSales[agId].uzs += sum; }
    });

    console.log('============================================');
    console.log('  BUGUNGI HAQIQIY RAQAMLAR (' + todayStr + ')');
    console.log('============================================');
    console.log('  Buyurtmalar: ' + todayOrders.length + ' (' + returnCount + ' qaytarish)');
    console.log('  Sotuvlar UZS: ' + Math.round(salesUZS).toLocaleString());
    console.log('  Sotuvlar USD: ' + Math.round(salesUSD).toLocaleString());
    console.log('  AKB: ' + Object.keys(activeClients).length);
    console.log('');

    // Agent bo'yicha
    console.log('  AGENTLAR:');
    var sorted = Object.keys(agentSales).map(function (id) {
        var d = agentSales[id];
        return { id: id, name: d.name, count: d.count, uzs: d.uzs, usd: d.usd, cl: Object.keys(d.clients).length };
    }).sort(function (a, b) { return (b.uzs + b.usd * 12800) - (a.uzs + a.usd * 12800); });

    sorted.forEach(function (a, i) {
        var uzsStr = Math.round(a.uzs).toLocaleString();
        var usdStr = a.usd > 0 ? ' + $' + Math.round(a.usd).toLocaleString() : '';
        console.log('  ' + (i + 1) + '. ' + a.name.padEnd(22) + a.count + ' ta | ' + uzsStr + ' som' + usdStr + ' | ' + a.cl + ' mijoz');
    });

    // Iroda
    var irodaIds = ['d0_2', 'd0_3', 'd0_4', 'd0_6', 'd0_7', 'd0_10', 'd0_11', 'd0_19', 'd0_21', 'd0_22', 'd0_24', 'd0_25', 'd0_27'];
    var iUzs = 0, iUsd = 0, iCnt = 0;
    irodaIds.forEach(function (id) {
        if (agentSales[id]) { iUzs += agentSales[id].uzs; iUsd += agentSales[id].usd; iCnt += agentSales[id].count; }
    });
    console.log('');
    console.log('  IRODA JAMI: ' + iCnt + ' ta | ' + Math.round(iUzs).toLocaleString() + ' som + $' + Math.round(iUsd).toLocaleString());

    // HAFTA
    var weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    var weekStr = weekAgo.getFullYear() + '-' + String(weekAgo.getMonth() + 1).padStart(2, '0') + '-' + String(weekAgo.getDate()).padStart(2, '0');
    var weekOrders = allOrders.filter(function (o) {
        var d = (o.dateCreate || o.dateDocument || '').split('T')[0].split(' ')[0];
        return d >= weekStr && d <= todayStr;
    });
    var weekUZS = 0, weekUSD = 0;
    weekOrders.forEach(function (order) {
        var st = order.status;
        var summa = parseFloat(order.totalSumma) || 0;
        var rets = parseFloat(order.totalReturnsSumma) || 0;
        if (st === 4 || st === 5 || (rets > 0 && rets === summa)) return;
        var sum = summa || parseFloat(order.totalSummaAfterDiscount) || 0;
        var ptId = order.paymentType ? order.paymentType.SD_id : '';
        var prId = order.priceType ? order.priceType.SD_id : '';
        if (ptId === 'd0_4' || isDollar(prId)) { weekUSD += sum; } else { weekUZS += sum; }
    });
    console.log('');
    console.log('  HAFTALIK (' + weekStr + ' - ' + todayStr + '): ' + weekOrders.length + ' ta');
    console.log('  Sotuvlar UZS: ' + Math.round(weekUZS).toLocaleString());
    console.log('  Sotuvlar USD: ' + Math.round(weekUSD).toLocaleString());
    console.log('');
}

main().catch(function (e) { console.error('Xato:', e.message); });
