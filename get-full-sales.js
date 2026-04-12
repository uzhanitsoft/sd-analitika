/**
 * Sales Doctor - To'liq sotuvlarni olish (barcha statuslar)
 */

const fetch = require('node-fetch');

const serverUrl = 'https://rafiq.salesdoc.io/api/v2/';
const auth = { userId: 'd0_67', token: '460e6b260534c4b7d005fea460d5feda' };

async function apiCall(method, params = {}) {
    const res = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth, method, params })
    });
    return res.json();
}

async function getFullSales() {
    console.log('💰 TO\'LIQ SOTUVLARNI HISOBLASH\n');
    console.log('='.repeat(70));

    // 1. Barcha statusdagi buyurtmalarni olish
    console.log('\n📌 1. BARCHA STATUSDAGI BUYURTMALAR:\n');

    let allOrders = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 20) { // Max 20 page
        const data = await apiCall('getOrder', {
            filter: { status: 'all' },
            page: page,
            limit: 1000
        });

        if (data.result?.order && data.result.order.length > 0) {
            console.log(`  Page ${page}: ${data.result.order.length} ta buyurtma`);
            allOrders = allOrders.concat(data.result.order);

            if (data.result.order.length < 1000) {
                hasMore = false;
            } else {
                page++;
            }
        } else {
            hasMore = false;
        }
    }

    console.log(`\n  📊 JAMI BUYURTMALAR: ${allOrders.length}`);

    // 2. Status bo'yicha gruppalash
    console.log('\n' + '='.repeat(70));
    console.log('📌 2. STATUS BO\'YICHA TAQSIMOT:\n');

    const statusGroups = {};
    allOrders.forEach(order => {
        // Statusni topish
        let status = order.status || order.orderStatus || order.state || 'unknown';
        if (typeof status === 'object') {
            status = status.name || status.title || JSON.stringify(status);
        }

        if (!statusGroups[status]) {
            statusGroups[status] = { count: 0, sum: 0 };
        }
        statusGroups[status].count++;
        statusGroups[status].sum += parseFloat(order.totalSumma) || parseFloat(order.totalSummaAfterDiscount) || 0;
    });

    for (const [status, data] of Object.entries(statusGroups)) {
        console.log(`  📦 ${String(status).padEnd(20)}: ${String(data.count).padStart(5)} ta | ${data.sum.toLocaleString().padStart(20)} UZS`);
    }

    // 3. Umumiy summa
    console.log('\n' + '='.repeat(70));
    console.log('📌 3. UMUMIY HISOB-KITOB:\n');

    let totalSumUZS = 0;
    let totalSumUSD = 0;

    allOrders.forEach(order => {
        const sum = parseFloat(order.totalSumma) || parseFloat(order.totalSummaAfterDiscount) || 0;
        const priceTypeName = order.priceType?.name || '';

        if (priceTypeName.includes('$') || priceTypeName.toLowerCase().includes('dollar')) {
            totalSumUSD += sum;
        } else {
            totalSumUZS += sum;
        }
    });

    console.log(`  💵 UZS summa:  ${totalSumUZS.toLocaleString()} so'm`);
    console.log(`  💲 USD summa:  ${totalSumUSD.toLocaleString()} $`);
    console.log(`  📦 Buyurtmalar: ${allOrders.length} ta`);

    // 4. Sana bo'yicha (bu oy)
    console.log('\n' + '='.repeat(70));
    console.log('📌 4. BU OY (2026-02) SOTUVLAR:\n');

    const thisMonth = allOrders.filter(o => {
        const date = o.dateCreate || o.dateDocument || o.orderCreated || '';
        return date.startsWith('2026-02');
    });

    let monthSumUZS = 0;
    thisMonth.forEach(o => {
        const sum = parseFloat(o.totalSumma) || parseFloat(o.totalSummaAfterDiscount) || 0;
        monthSumUZS += sum;
    });

    console.log(`  📅 Bu oy buyurtmalar: ${thisMonth.length} ta`);
    console.log(`  💰 Bu oy summa: ${monthSumUZS.toLocaleString()} UZS`);

    // 5. Bugun
    console.log('\n📌 5. BUGUN (2026-02-05) SOTUVLAR:\n');

    const today = allOrders.filter(o => {
        const date = o.dateCreate || o.dateDocument || o.orderCreated || '';
        return date.startsWith('2026-02-05');
    });

    let todaySumUZS = 0;
    today.forEach(o => {
        const sum = parseFloat(o.totalSumma) || parseFloat(o.totalSummaAfterDiscount) || 0;
        todaySumUZS += sum;
    });

    console.log(`  📅 Bugungi buyurtmalar: ${today.length} ta`);
    console.log(`  💰 Bugungi summa: ${todaySumUZS.toLocaleString()} UZS`);

    // 6. So'nggi 5 buyurtma
    console.log('\n' + '='.repeat(70));
    console.log('📌 6. SO\'NGGI 5 BUYURTMA:\n');

    const recent = allOrders.slice(0, 5);
    recent.forEach((o, i) => {
        const date = o.dateCreate || o.dateDocument || '';
        const sum = parseFloat(o.totalSumma) || 0;
        const status = o.status?.name || o.status || '';
        const client = o.client?.name || o.clientName || '';
        console.log(`  ${i + 1}. ${date.substring(0, 10)} | ${String(status).padEnd(12)} | ${client.substring(0, 20).padEnd(20)} | ${sum.toLocaleString().padStart(15)} UZS`);
    });

    console.log('\n' + '='.repeat(70));
    console.log('✅ HISOBLASH YAKUNLANDI\n');
}

getFullSales().catch(console.error);
