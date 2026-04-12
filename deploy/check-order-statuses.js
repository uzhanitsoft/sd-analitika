// Bugungi buyurtmalarning statuslarini tekshirish
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
    console.log('Login OK:', auth.userId);

    // Bugungi buyurtmalar
    const today = new Date().toISOString().split('T')[0];
    console.log('Sana:', today);

    let allOrders = [];
    let page = 1;
    while (page <= 5) {
        const data = await apiRequest(auth, 'getOrder', { page, limit: 500, filter: { status: 'all' } });
        const orders = data?.result?.order || [];
        if (orders.length === 0) break;
        allOrders = allOrders.concat(orders);
        page++;
    }

    // Bugungi filtr
    const todayOrders = allOrders.filter(o => {
        const d = (o.dateCreate || o.dateDocument || '').split('T')[0].split(' ')[0];
        return d === today;
    });

    console.log(`\nBugungi barcha buyurtmalar: ${todayOrders.length}`);

    // Status bo'yicha guruhlash
    const statusGroups = {};
    todayOrders.forEach(o => {
        const s = o.status ?? 'null';
        if (!statusGroups[s]) statusGroups[s] = { count: 0, sum: 0, orders: [] };
        statusGroups[s].count++;
        statusGroups[s].sum += parseFloat(o.totalSumma) || 0;
        statusGroups[s].orders.push(o);
    });

    console.log('\n═══════════════════════════════════════');
    console.log('BARCHA BUYURTMALAR STATUS BO\'YICHA:');
    console.log('═══════════════════════════════════════');
    Object.entries(statusGroups).sort((a,b) => a[0]-b[0]).forEach(([status, data]) => {
        console.log(`  Status ${status}: ${data.count} ta, ${data.sum.toLocaleString()} so'm`);
    });

    // Iroda agentlari
    const irodaIds = new Set([
        'd0_2', 'd0_5', 'd0_6', 'd0_7', 'd0_8', 'd0_10', 'd0_11',
        'd0_19', 'd0_20', 'd0_22', 'd0_24', 'd0_25', 'd0_28',
        'd0_29', 'd0_30', 'd0_34'
    ]);

    const irodaOrders = todayOrders.filter(o => irodaIds.has(o.agent?.SD_id));

    console.log('\n═══════════════════════════════════════');
    console.log('IRODA BUYURTMALARI STATUS BO\'YICHA:');
    console.log('═══════════════════════════════════════');

    const irodaStatusGroups = {};
    irodaOrders.forEach(o => {
        const s = o.status ?? 'null';
        if (!irodaStatusGroups[s]) irodaStatusGroups[s] = { count: 0, sum: 0 };
        irodaStatusGroups[s].count++;
        irodaStatusGroups[s].sum += parseFloat(o.totalSumma) || 0;
    });

    Object.entries(irodaStatusGroups).sort((a,b) => a[0]-b[0]).forEach(([status, data]) => {
        console.log(`  Status ${status}: ${data.count} ta, ${data.sum.toLocaleString()} so'm`);
    });

    // Filterlangan (hozirgi logika)
    const currentFilter = irodaOrders.filter(o => {
        const totalSumma = parseFloat(o.totalSumma) || 0;
        const returnsSumma = parseFloat(o.totalReturnsSumma) || 0;
        if (o.status === 4 || o.status === 5) return false;
        if (returnsSumma > 0 && returnsSumma === totalSumma) return false;
        if (totalSumma === 0) return false;
        return true;
    });

    console.log(`\nIRODA HOZIRGI FILTR: ${currentFilter.length} ta (SD: 45 ta)`);
    console.log(`FARQ: ${currentFilter.length - 45} ta ortiq`);

    // Qaysi statuslar filtrlansa 45 ga tushadi?
    console.log('\n═══════════════════════════════════════');
    console.log('QAYSI STATUSLARNI FILTRLASH KERAK:');
    console.log('═══════════════════════════════════════');

    // Status 0 ni ham filtrlasak
    const withoutStatus0 = currentFilter.filter(o => o.status !== 0);
    console.log(`  Status 0 ni olib tashlasak: ${withoutStatus0.length} ta`);

    // Status 1 ni ham filtrlasak
    const withoutStatus01 = withoutStatus0.filter(o => o.status !== 1);
    console.log(`  Status 0,1 ni olib tashlasak: ${withoutStatus01.length} ta`);

    // Detailni ko'rsatish
    console.log('\n═══════════════════════════════════════');
    console.log('BARCHA IRODA BUYURTMALARI (batafsil):');
    console.log('═══════════════════════════════════════');
    irodaOrders.forEach(o => {
        const sum = parseFloat(o.totalSumma) || 0;
        const ret = parseFloat(o.totalReturnsSumma) || 0;
        const agent = o.agent?.name || o.agent?.SD_id || '?';
        const excluded = (o.status === 4 || o.status === 5 || (ret > 0 && ret === sum) || sum === 0) ? ' ❌ EXCLUDED' : '';
        console.log(`  #${(o.SD_id || '').padEnd(8)} | St:${o.status} | ${sum.toLocaleString().padStart(15)} | Ret:${ret.toLocaleString().padStart(10)} | ${agent.substring(0,25).padEnd(25)}${excluded}`);
    });
}

main().catch(console.error);
