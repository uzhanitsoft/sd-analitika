/**
 * Dollar narx turlarini aniqlash
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
            allOrders = allOrders.concat(data.result.order);
            if (data.result.order.length < 1000) hasMore = false;
            else page++;
        } else {
            hasMore = false;
        }
    }
    return allOrders;
}

async function analyzePriceTypes() {
    console.log('💲 NARX TURLARINI TAHLIL QILISH\n');

    // PriceType larni olish
    console.log('📌 NARX TURLARI:\n');
    const ptRes = await apiCall('getPriceType');
    const priceTypes = ptRes.result?.priceType || [];

    // Dollar ekanligini aniqlash - summa kichik bo'lsa (< 1,000,000) dollar bo'lishi mumkin
    // Yoki nomida $ bo'lsa
    const dollarPriceTypeIds = new Set();

    priceTypes.forEach(pt => {
        const name = (pt.name || '').toLowerCase();
        const isDollarByName = name.includes('$') ||
            name.includes('dollar') ||
            name.includes('usd') ||
            name.includes('долл');

        if (isDollarByName) {
            dollarPriceTypeIds.add(pt.SD_id);
            console.log(`  💲 ${pt.SD_id}: ${pt.name} (Dollar - nomida $ bor)`);
        } else {
            console.log(`  💵 ${pt.SD_id}: ${pt.name}`);
        }
    });

    // Buyurtmalarni olish
    console.log('\n📥 Buyurtmalarni yuklash...');
    const allOrders = await fetchAllOrders();

    // Bugungi
    const todayOrders = allOrders.filter(o => {
        const date = (o.dateCreate || o.dateDocument || '').split(' ')[0];
        return date === '2026-02-05';
    });
    console.log(`✅ Bugungi: ${todayOrders.length} ta\n`);

    // Har bir narx turi bo'yicha o'rtacha summa
    console.log('📌 NARX TURI BO\'YICHA O\'RTACHA SUMMA:\n');

    const byPriceType = {};
    todayOrders.forEach(order => {
        const ptId = order.priceType?.SD_id || 'unknown';
        const sum = parseFloat(order.totalSumma) || 0;

        if (!byPriceType[ptId]) {
            byPriceType[ptId] = { sums: [], count: 0, total: 0 };
        }
        byPriceType[ptId].sums.push(sum);
        byPriceType[ptId].count++;
        byPriceType[ptId].total += sum;
    });

    // O'rtacha summa bo'yicha dollar yoki so'm aniqlash
    const avgThreshold = 100000; // 100,000 dan past bo'lsa dollar bo'lishi mumkin

    for (const [ptId, data] of Object.entries(byPriceType)) {
        const avg = data.total / data.count;
        const ptInfo = priceTypes.find(p => p.SD_id === ptId);
        const ptName = ptInfo?.name || 'Noma\'lum';

        // Dollar bo'lishi mumkinmi?
        const isDollarByAvg = avg < avgThreshold;
        const isDollarByName = dollarPriceTypeIds.has(ptId);

        const sign = isDollarByName ? '💲' : (isDollarByAvg ? '❓' : '💵');

        console.log(`  ${sign} ${ptId}: "${ptName}"`);
        console.log(`     Soni: ${data.count}, Jami: ${data.total.toLocaleString()}, O'rtacha: ${avg.toLocaleString()}`);
    }

    // FINAL hisoblash - faqat nomida $ bor bo'lganlarni dollar deb hisoblaymiz
    console.log('\n' + '='.repeat(60));
    console.log('📊 FINAL HISOBLASH (nomida $ bor = dollar):\n');

    let totalUZS = 0;
    let totalUSD = 0;

    todayOrders.forEach(order => {
        const sum = parseFloat(order.totalSumma) || 0;
        const ptId = order.priceType?.SD_id || '';

        if (dollarPriceTypeIds.has(ptId)) {
            totalUSD += sum;
        } else {
            totalUZS += sum;
        }
    });

    console.log(`  💵 UZS: ${totalUZS.toLocaleString()} so'm`);
    console.log(`  💲 USD: ${totalUSD.toLocaleString()} $`);

    // Agar kutilgan qiymatga yetmasa, boshqa narx turlarini ham dollar deb hisoblash kerak
    console.log('\n' + '='.repeat(60));
    console.log('📊 ALTERNATIVE HISOBLASH (summa < 100,000 = dollar):\n');

    let altUZS = 0;
    let altUSD = 0;

    todayOrders.forEach(order => {
        const sum = parseFloat(order.totalSumma) || 0;
        const ptId = order.priceType?.SD_id || '';
        const ptInfo = priceTypes.find(p => p.SD_id === ptId);
        const ptName = (ptInfo?.name || '').toLowerCase();

        // Dollar aniqlash: nomida $ yoki summa juda kichik
        const hasDollarSign = ptName.includes('$');
        const isSmallSum = sum < 50000 && sum > 0; // 50,000 dan kichik va musbat

        if (hasDollarSign) {
            altUSD += sum;
        } else if (['d0_11', 'd0_9', 'd0_6'].includes(ptId) && sum < 100000) {
            // Bu narx turlari dollar bo'lishi mumkin
            altUSD += sum;
        } else {
            altUZS += sum;
        }
    });

    console.log(`  💵 UZS: ${altUZS.toLocaleString()} so'm`);
    console.log(`  💲 USD: ${altUSD.toLocaleString()} $`);

    console.log('\n🎯 Kutilgan: ~156,846,833 so\'m va ~53,389 $');
}

analyzePriceTypes().catch(console.error);
