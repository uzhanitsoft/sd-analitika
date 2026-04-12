/**
 * Dollar buyurtmalarini to'liq tekshirish (yangi token bilan)
 */

const fetch = require('node-fetch');

const serverUrl = 'https://rafiq.salesdoc.io/api/v2/';
const auth = { userId: 'd0_67', token: '3df6601894cad4a9d7437ecf95449ac0' };

async function apiCall(method, params = {}) {
    const res = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth, method, params })
    });
    return res.json();
}

async function fetchAllOrders() {
    let allOrders = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 10) {
        const data = await apiCall('getOrder', {
            filter: { status: 'all' },
            page: page,
            limit: 1000
        });

        if (data.result?.order?.length > 0) {
            console.log(`  Sahifa ${page}: ${data.result.order.length} ta`);
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
    return allOrders;
}

async function checkDollarOrders() {
    console.log('💲 DOLLAR BUYURTMALARINI TEKSHIRISH (yangi token)\n');

    // 1. PriceType larni olish
    console.log('📌 1. NARX TURLARI:\n');
    const ptRes = await apiCall('getPriceType');
    const priceTypes = ptRes.result?.priceType || [];

    if (priceTypes.length > 0) {
        priceTypes.forEach(pt => {
            console.log(`  ${pt.SD_id}: ${pt.name}`);
        });
    } else {
        console.log('  PriceType topilmadi');
    }

    // 2. Barcha buyurtmalarni olish
    console.log('\n📌 2. BUYURTMALARNI YUKLASH:\n');
    const allOrders = await fetchAllOrders();
    console.log(`\n  ✅ Jami: ${allOrders.length} ta buyurtma`);

    // 3. Bugungi buyurtmalar
    const todayOrders = allOrders.filter(o => {
        const date = (o.dateCreate || o.dateDocument || '').split(' ')[0];
        return date === '2026-02-05';
    });
    console.log(`\n📌 3. BUGUNGI BUYURTMALAR: ${todayOrders.length} ta\n`);

    // 4. PriceType bo'yicha gruppalash
    console.log('📌 4. NARX TURI BO\'YICHA TAQSIMOT:\n');

    const byPriceType = {};
    todayOrders.forEach(order => {
        const ptId = order.priceType?.SD_id || 'unknown';
        const ptName = order.priceType?.name || priceTypes.find(p => p.SD_id === ptId)?.name || 'Noma\'lum';
        const key = `${ptId}`;

        if (!byPriceType[key]) {
            byPriceType[key] = { name: ptName, count: 0, sum: 0 };
        }
        byPriceType[key].count++;
        byPriceType[key].sum += parseFloat(order.totalSumma) || 0;
    });

    for (const [id, data] of Object.entries(byPriceType)) {
        console.log(`  ${id}: "${data.name}" - ${data.count} ta, ${data.sum.toLocaleString()}`);
    }

    // 5. Birinchi buyurtmani batafsil ko'rish
    if (todayOrders[0]) {
        console.log('\n📌 5. BIRINCHI BUYURTMA STRUKTURASI:\n');
        const order = todayOrders[0];
        console.log(`  dateCreate: ${order.dateCreate}`);
        console.log(`  totalSumma: ${order.totalSumma}`);
        console.log(`  priceType: ${JSON.stringify(order.priceType)}`);
        console.log(`  client: ${JSON.stringify(order.client)}`);

        // Barcha maydonlarni ko'rish
        console.log('\n  Barcha maydonlar:');
        Object.keys(order).forEach(key => {
            const val = order[key];
            if (typeof val !== 'object') {
                console.log(`    ${key}: ${val}`);
            }
        });
    }

    // 6. Dollar aniqlash mantiqini tekshirish
    console.log('\n📌 6. VALYUTA BO\'YICHA HISOBLASH:\n');

    let totalUZS = 0;
    let totalUSD = 0;
    let dollarOrders = [];

    todayOrders.forEach(order => {
        const sum = parseFloat(order.totalSumma) || 0;
        const ptId = order.priceType?.SD_id || '';
        const ptName = (order.priceType?.name || '').toLowerCase();

        // PriceType dan dollar aniqlash
        const ptInfo = priceTypes.find(p => p.SD_id === ptId);
        const fullName = (ptInfo?.name || ptName || '').toLowerCase();

        // Dollar aniqlash
        const isDollar = fullName.includes('$') ||
            fullName.includes('dollar') ||
            fullName.includes('usd') ||
            fullName.includes('долл') ||
            fullName.includes('валют');

        if (isDollar) {
            totalUSD += sum;
            dollarOrders.push({ sum, ptName: fullName, ptId });
        } else {
            totalUZS += sum;
        }
    });

    console.log(`  💵 UZS: ${totalUZS.toLocaleString()} so'm`);
    console.log(`  💲 USD: ${totalUSD.toLocaleString()} $`);
    console.log(`  📦 Dollar buyurtmalar soni: ${dollarOrders.length}`);

    if (dollarOrders.length > 0) {
        console.log('\n  Dollar buyurtmalar:');
        dollarOrders.slice(0, 10).forEach((o, i) => {
            console.log(`    ${i + 1}. ${o.ptName} - ${o.sum.toLocaleString()}`);
        });
    }

    console.log(`\n  🎯 Kutilgan: ~156,900,222 so'm va ~53,389 $`);
}

checkDollarOrders().catch(console.error);
