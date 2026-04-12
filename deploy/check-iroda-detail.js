// Iroda buyurtmalarini BATAFSIL tahlil qilish
// Sales Doctor rasmiy raqamlariga mos kelishini tekshirish
const API_URL = 'https://rafiq.salesdoc.io/api/v2/';

async function login() {
    const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            auth: { login: 'admin', password: '1234567rafiq' },
            method: 'login', params: {}
        })
    });
    const data = await res.json();
    return { userId: data.result?.userId, token: data.result?.token };
}

async function apiRequest(auth, method, params = {}) {
    const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            auth: { userId: auth.userId, token: auth.token },
            method, params
        })
    });
    return await res.json();
}

async function main() {
    const auth = await login();
    const today = '2026-04-09';
    console.log('Sana:', today);

    // Barcha buyurtmalarni yuklash (barcha sahifalar)
    let allOrders = [];
    let page = 1;
    while (true) {
        const data = await apiRequest(auth, 'getOrder', { page, limit: 1000, filter: { status: 'all' } });
        const orders = data?.result?.order || [];
        if (orders.length === 0) break;
        allOrders = allOrders.concat(orders);
        console.log(`Sahifa ${page}: ${orders.length} ta buyurtma`);
        if (orders.length < 1000) break;
        page++;
    }
    console.log(`Jami: ${allOrders.length} ta buyurtma\n`);

    // Iroda agentlari
    const irodaIds = new Set([
        'd0_2', 'd0_5', 'd0_6', 'd0_7', 'd0_8', 'd0_10', 'd0_11',
        'd0_19', 'd0_20', 'd0_22', 'd0_24', 'd0_25', 'd0_28',
        'd0_29', 'd0_30', 'd0_34'
    ]);

    // ===== BUGUNGI IRODA BUYURTMALARI (dateDocument bo'yicha) =====
    const irodaTodayByDoc = allOrders.filter(o => {
        const dateDoc = (o.dateDocument || '').split('T')[0].split(' ')[0];
        return dateDoc === today && irodaIds.has(o.agent?.SD_id);
    });

    // ===== BUGUNGI IRODA BUYURTMALARI (dateCreate bo'yicha) =====
    const irodaTodayByCreate = allOrders.filter(o => {
        const dateCreate = (o.dateCreate || '').split('T')[0].split(' ')[0];
        return dateCreate === today && irodaIds.has(o.agent?.SD_id);
    });

    console.log('═══════════════════════════════════════════════════');
    console.log('IRODA BUGUNGI BUYURTMALARI:');
    console.log('═══════════════════════════════════════════════════');
    console.log(`  dateDocument bo'yicha: ${irodaTodayByDoc.length} ta`);
    console.log(`  dateCreate bo'yicha: ${irodaTodayByCreate.length} ta`);

    // Status bo'yicha guruhlash
    console.log('\n═══════════════════════════════════════════════════');
    console.log('STATUS BO\'YICHA (dateDocument):');
    console.log('═══════════════════════════════════════════════════');

    const statusMap = {};
    irodaTodayByDoc.forEach(o => {
        const s = o.status;
        if (!statusMap[s]) statusMap[s] = { count: 0, sum: 0 };
        statusMap[s].count++;
        statusMap[s].sum += parseFloat(o.totalSumma) || 0;
    });

    Object.entries(statusMap).sort((a,b) => a[0]-b[0]).forEach(([s, d]) => {
        console.log(`  Status ${s}: ${d.count} ta, ${d.sum.toLocaleString()} so'm`);
    });

    // Hozirgi filtr (status 4,5 va returns filtrlash)
    const filtered = irodaTodayByDoc.filter(o => {
        const sum = parseFloat(o.totalSumma) || 0;
        const ret = parseFloat(o.totalReturnsSumma) || 0;
        if (o.status === 4 || o.status === 5) return false;
        if (ret > 0 && ret === sum) return false;
        if (sum === 0) return false;
        return true;
    });

    const totalSum = filtered.reduce((s, o) => s + (parseFloat(o.totalSumma) || 0), 0);
    console.log(`\n  Hozirgi filtr natijasi: ${filtered.length} ta, ${totalSum.toLocaleString()} so'm`);
    console.log(`  SD rasmiy:              45 ta, 31,210,964 so'm`);
    console.log(`  FARQ:                   ${filtered.length - 45} ta, ${(totalSum - 31210964).toLocaleString()} so'm`);

    // Turli filtr variantlarini sinash
    console.log('\n═══════════════════════════════════════════════════');
    console.log('FILTR VARIANTLARI:');
    console.log('═══════════════════════════════════════════════════');

    // Faqat status 2
    const onlyStatus2 = irodaTodayByDoc.filter(o => o.status === 2 && (parseFloat(o.totalSumma) || 0) > 0);
    const sum2 = onlyStatus2.reduce((s, o) => s + (parseFloat(o.totalSumma) || 0), 0);
    console.log(`  Faqat status=2: ${onlyStatus2.length} ta, ${sum2.toLocaleString()} so'm`);

    // Status 2 + 3
    const status23 = irodaTodayByDoc.filter(o => (o.status === 2 || o.status === 3) && (parseFloat(o.totalSumma) || 0) > 0);
    const sum23 = status23.reduce((s, o) => s + (parseFloat(o.totalSumma) || 0), 0);
    console.log(`  Status=2,3:     ${status23.length} ta, ${sum23.toLocaleString()} so'm`);

    // Status 1 + 2
    const status12 = irodaTodayByDoc.filter(o => (o.status === 1 || o.status === 2) && (parseFloat(o.totalSumma) || 0) > 0);
    const sum12 = status12.reduce((s, o) => s + (parseFloat(o.totalSumma) || 0), 0);
    console.log(`  Status=1,2:     ${status12.length} ta, ${sum12.toLocaleString()} so'm`);

    // Status 1 + 2 + 3
    const status123 = irodaTodayByDoc.filter(o => (o.status === 1 || o.status === 2 || o.status === 3) && (parseFloat(o.totalSumma) || 0) > 0);
    const sum123 = status123.reduce((s, o) => s + (parseFloat(o.totalSumma) || 0), 0);
    console.log(`  Status=1,2,3:   ${status123.length} ta, ${sum123.toLocaleString()} so'm`);

    // BATAFSIL - har bir buyurtma
    console.log('\n═══════════════════════════════════════════════════');
    console.log('HAR BIR BUYURTMA (dateDocument=' + today + '):');
    console.log('═══════════════════════════════════════════════════');

    irodaTodayByDoc.sort((a, b) => (a.SD_id || '').localeCompare(b.SD_id || '')).forEach((o, i) => {
        const sum = parseFloat(o.totalSumma) || 0;
        const ret = parseFloat(o.totalReturnsSumma) || 0;
        const agent = o.agent?.name || o.agent?.SD_id || '?';
        const dateDoc = (o.dateDocument || '').split('T')[0];
        const dateCreate = (o.dateCreate || '').split('T')[0];
        const dateDiff = dateDoc !== dateCreate ? ` ⚠️ CREATE=${dateCreate}` : '';
        const status = o.status;
        console.log(`  ${(i+1+'').padStart(2)}. #${(o.SD_id||'').padEnd(9)} St:${status} | ${sum.toLocaleString().padStart(15)} | Ret:${ret.toLocaleString().padStart(10)} | ${agent.padEnd(28)} | Doc:${dateDoc}${dateDiff}`);
    });

    // dateCreate bilan dateDocument farq bo'lgan buyurtmalar
    console.log('\n═══════════════════════════════════════════════════');
    console.log('⚠️ SANASI FARQ QI\'LGANLAR (dateCreate != dateDocument):');
    console.log('═══════════════════════════════════════════════════');

    // dateCreate=today lekin dateDocument!=today
    const createTodayDocNot = allOrders.filter(o => {
        const dc = (o.dateCreate || '').split('T')[0].split(' ')[0];
        const dd = (o.dateDocument || '').split('T')[0].split(' ')[0];
        return dc === today && dd !== today && irodaIds.has(o.agent?.SD_id);
    });
    console.log(`\n  dateCreate=bugun, dateDocument≠bugun: ${createTodayDocNot.length} ta`);
    createTodayDocNot.forEach(o => {
        const sum = parseFloat(o.totalSumma) || 0;
        console.log(`    #${o.SD_id} St:${o.status} | ${sum.toLocaleString()} | Doc:${(o.dateDocument||'').split('T')[0]} | Create:${(o.dateCreate||'').split('T')[0]} | ${o.agent?.name}`);
    });

    // dateDocument=today lekin dateCreate!=today
    const docTodayCreateNot = allOrders.filter(o => {
        const dc = (o.dateCreate || '').split('T')[0].split(' ')[0];
        const dd = (o.dateDocument || '').split('T')[0].split(' ')[0];
        return dd === today && dc !== today && irodaIds.has(o.agent?.SD_id);
    });
    console.log(`\n  dateDocument=bugun, dateCreate≠bugun: ${docTodayCreateNot.length} ta`);
    docTodayCreateNot.forEach(o => {
        const sum = parseFloat(o.totalSumma) || 0;
        console.log(`    #${o.SD_id} St:${o.status} | ${sum.toLocaleString()} | Doc:${(o.dateDocument||'').split('T')[0]} | Create:${(o.dateCreate||'').split('T')[0]} | ${o.agent?.name}`);
    });
}

main().catch(console.error);
