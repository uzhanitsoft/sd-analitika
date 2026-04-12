/**
 * getBalance API'ni turli parametrlar bilan tekshirish
 * Admin dostupini to'liq tekshirish
 */

const fetch = require('node-fetch');

const serverUrl = 'https://rafiq.salesdoc.io/api/v2/';

async function freshLogin() {
    const res = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            method: 'login',
            auth: { login: 'admin', password: '1234567rafiq' }
        })
    });
    const data = await res.json();
    return data.result;
}

async function apiCall(auth, method, params = {}) {
    const res = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth, method, params })
    });
    return res.json();
}

async function testAllParameters() {
    console.log('🔍 GETBALANCE TURLI PARAMETRLAR BILAN TEKSHIRISH\n');

    const auth = await freshLogin();
    console.log(`✅ Login: ${auth.userId}`);
    console.log(`   Token: ${auth.token.substring(0, 20)}...`);
    console.log('');

    // 1. Oddiy chaqiruv
    console.log('='.repeat(70));
    console.log('📌 1. ODDIY CHAQIRUV (limit: 10000):\n');

    const data1 = await apiCall(auth, 'getBalance', { limit: 10000 });
    console.log(`  Balanslar soni: ${data1.result?.balance?.length || 0}`);
    console.log(`  Pagination:`, data1.pagination);

    // 2. active: true
    console.log('\n' + '='.repeat(70));
    console.log('📌 2. FILTER: active = true:\n');

    const data2 = await apiCall(auth, 'getBalance', {
        limit: 10000,
        filter: { active: true }
    });
    console.log(`  Balanslar soni: ${data2.result?.balance?.length || 0}`);

    // 3. active: false (nofaol mijozlar)
    console.log('\n' + '='.repeat(70));
    console.log('📌 3. FILTER: active = false (NOFAOL):\n');

    const data3 = await apiCall(auth, 'getBalance', {
        limit: 10000,
        filter: { active: false }
    });
    console.log(`  Balanslar soni: ${data3.result?.balance?.length || 0}`);

    if (data3.result?.balance?.length > 0) {
        // Nofaol mijozlar balanslarini hisoblash
        let inactiveTotal = 0;
        data3.result.balance.forEach(b => {
            inactiveTotal += parseFloat(b.balance) || 0;
        });
        console.log(`  Nofaol mijozlar jami balans: ${inactiveTotal.toLocaleString()}`);

        // Birinchi 5 tasini ko'rsatish
        console.log('\n  Nofaol mijozlar (5 ta):');
        data3.result.balance.slice(0, 5).forEach(b => {
            console.log(`    ${b.name}: ${parseFloat(b.balance).toLocaleString()}`);
        });
    }

    // 4. Filtersiz barcha mijozlar
    console.log('\n' + '='.repeat(70));
    console.log('📌 4. FILTER: all (barcha holat):\n');

    const data4 = await apiCall(auth, 'getBalance', {
        limit: 10000,
        filter: { active: 'all' }
    });
    console.log(`  Balanslar soni: ${data4.result?.balance?.length || 0}`);

    // 5. with_inactive parametri
    console.log('\n' + '='.repeat(70));
    console.log('📌 5. with_inactive: true:\n');

    const data5 = await apiCall(auth, 'getBalance', {
        limit: 10000,
        with_inactive: true
    });
    console.log(`  Balanslar soni: ${data5.result?.balance?.length || 0}`);

    // 6. include_inactive parametri
    console.log('\n' + '='.repeat(70));
    console.log('📌 6. include_inactive: true:\n');

    const data6 = await apiCall(auth, 'getBalance', {
        limit: 10000,
        include_inactive: true
    });
    console.log(`  Balanslar soni: ${data6.result?.balance?.length || 0}`);

    // 7. Mavjud balanslardagi active holatlarni tekshirish
    console.log('\n' + '='.repeat(70));
    console.log('📌 7. MAVJUD BALANSLARDAGI ACTIVE HOLAT:\n');

    const allBalances = data1.result?.balance || [];
    let activeCount = 0;
    let inactiveCount = 0;
    let nullCount = 0;

    allBalances.forEach(b => {
        if (b.active === true) activeCount++;
        else if (b.active === false) inactiveCount++;
        else nullCount++;
    });

    console.log(`  active=true: ${activeCount}`);
    console.log(`  active=false: ${inactiveCount}`);
    console.log(`  active=null/undefined: ${nullCount}`);

    // 8. getClient vs getBalance solishtirish
    console.log('\n' + '='.repeat(70));
    console.log('📌 8. GETCLIENT VA GETBALANCE SOLISHTIRISH:\n');

    const clientData = await apiCall(auth, 'getClient', { limit: 10000 });
    const clients = clientData.result?.client || [];
    console.log(`  getClient: ${clients.length} ta mijoz`);
    console.log(`  getBalance: ${allBalances.length} ta balans`);

    // Farqni aniqlash
    if (clients.length !== allBalances.length) {
        console.log(`  FARQ: ${Math.abs(clients.length - allBalances.length)}`);
    }

    // getClient'dan active holatni tekshirish
    let clientActiveCount = 0;
    let clientInactiveCount = 0;
    clients.forEach(c => {
        if (c.active === true) clientActiveCount++;
        else clientInactiveCount++;
    });
    console.log(`  Mijozlar (active=true): ${clientActiveCount}`);
    console.log(`  Mijozlar (active=false): ${clientInactiveCount}`);

    // 9. Pagination tekshirish
    console.log('\n' + '='.repeat(70));
    console.log('📌 9. GETBALANCE PAGINATION TEKSHIRISH:\n');

    const pageData = await apiCall(auth, 'getBalance', { page: 1, limit: 100 });
    console.log(`  page=1, limit=100: ${pageData.result?.balance?.length || 0} ta`);
    console.log(`  pagination:`, pageData.pagination);

    const pageData2 = await apiCall(auth, 'getBalance', { page: 2, limit: 100 });
    console.log(`  page=2, limit=100: ${pageData2.result?.balance?.length || 0} ta`);

    // Ikkala sahifadagi birinchi elementni solishtirish
    if (pageData.result?.balance?.[0] && pageData2.result?.balance?.[0]) {
        const first1 = pageData.result.balance[0].name;
        const first2 = pageData2.result.balance[0].name;
        console.log(`  page=1 birinchi: ${first1}`);
        console.log(`  page=2 birinchi: ${first2}`);
        console.log(`  Bir xilmi: ${first1 === first2 ? 'HA (pagination ishlamayapti)' : 'YO\'Q (pagination ishlayapti)'}`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ YAKUNLANDI\n');
}

testAllParameters().catch(console.error);
