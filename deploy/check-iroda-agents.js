// Iroda agentlarini tekshirish skripti
// Sales Doctor API dan haqiqiy agentlar ro'yxatini olib, Iroda supervisoriga tegishlilarni aniqlash

const API_URL = 'https://rafiq.salesdoc.io/api/v2/';

async function login() {
    const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            auth: { login: 'admin', password: '1234567rafiq' },
            method: 'login',
            params: {}
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
            method: method,
            params: params
        })
    });
    return await res.json();
}

async function main() {
    console.log('🔐 Login...');
    const auth = await login();
    console.log(`✅ userId: ${auth.userId}\n`);

    // 1. Agentlar ro'yxati
    console.log('📋 Agentlar yuklanmoqda...');
    const agentData = await apiRequest(auth, 'getAgent', { page: 1, limit: 100 });
    const agents = agentData?.result?.agent || [];
    console.log(`   ✅ ${agents.length} ta agent topildi\n`);

    // 2. Barcha agentlarni ko'rsatish
    console.log('═══════════════════════════════════════════════════════');
    console.log('BARCHA AGENTLAR RO\'YXATI:');
    console.log('═══════════════════════════════════════════════════════');
    agents.forEach(a => {
        const supervisorName = a.supervisor?.name || 'YO\'Q';
        const supervisorId = a.supervisor?.SD_id || '';
        console.log(`   ${a.SD_id.padEnd(8)} | ${(a.name || 'Nomsiz').padEnd(30)} | Supervisor: ${supervisorName} (${supervisorId})`);
    });

    // 3. Supervayzerlarni aniqlash
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('SUPERVAYZERLAR BO\'YICHA GURUHLASH:');
    console.log('═══════════════════════════════════════════════════════');
    
    const supervisorGroups = {};
    agents.forEach(a => {
        const supervisorName = a.supervisor?.name || 'Supervayzer yo\'q';
        const supervisorId = a.supervisor?.SD_id || 'none';
        const key = `${supervisorId}|${supervisorName}`;
        if (!supervisorGroups[key]) {
            supervisorGroups[key] = [];
        }
        supervisorGroups[key].push(a);
    });

    Object.entries(supervisorGroups).forEach(([key, groupAgents]) => {
        const [supId, supName] = key.split('|');
        console.log(`\n🏢 SUPERVISOR: ${supName} (${supId}) — ${groupAgents.length} ta agent`);
        groupAgents.forEach(a => {
            console.log(`   ├── ${a.SD_id.padEnd(8)} | ${a.name}`);
        });
    });

    // 4. Hozirgi server.js dagi iroda ro'yxati
    const currentIrodaIds = new Set([
        'd0_2', 'd0_6', 'd0_7', 'd0_8', 'd0_10', 'd0_11',
        'd0_19', 'd0_20', 'd0_22', 'd0_24', 'd0_25', 'd0_28'
    ]);

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('HOZIRGI server.js DAGI IRODA AGENTLARI (12 ta):');
    console.log('═══════════════════════════════════════════════════════');
    currentIrodaIds.forEach(id => {
        const agent = agents.find(a => a.SD_id === id);
        const name = agent?.name || '❌ TOPILMADI';
        const supervisor = agent?.supervisor?.name || '?';
        console.log(`   ${id.padEnd(8)} | ${name.padEnd(30)} | Supervisor: ${supervisor}`);
    });

    // 5. IRODA supervisoriga tegishli agentlarni aniqlash
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🔍 IRODA SUPERVISORIGA TEGISHLI AGENTLAR (API dan):');
    console.log('═══════════════════════════════════════════════════════');

    // "Iroda" nomli supervisorni izlash
    const irodaAgents = agents.filter(a => {
        const supName = (a.supervisor?.name || '').toLowerCase();
        return supName.includes('iroda') || supName.includes('ирода');
    });

    if (irodaAgents.length > 0) {
        console.log(`\n✅ ${irodaAgents.length} ta agent Iroda supervisoriga tegishli:`);
        const irodaApiIds = new Set();
        irodaAgents.forEach(a => {
            irodaApiIds.add(a.SD_id);
            const isInCurrent = currentIrodaIds.has(a.SD_id) ? '✅ BOR' : '🆕 YANGI!';
            console.log(`   ${a.SD_id.padEnd(8)} | ${(a.name || '').padEnd(30)} | ${isInCurrent}`);
        });

        // Qo'shilmagan agentlar (server.js da bor, lekin API da Iroda emas)
        console.log('\n⚠️ server.js da BOR lekin API da Iroda EMAS:');
        currentIrodaIds.forEach(id => {
            if (!irodaApiIds.has(id)) {
                const agent = agents.find(a => a.SD_id === id);
                console.log(`   ${id.padEnd(8)} | ${agent?.name || 'TOPILMADI'} | Supervisor: ${agent?.supervisor?.name || '?'}`);
            }
        });

        // Yangi qo'shilishi kerak bo'lganlar
        console.log('\n🆕 YANGI QO\'SHILISHI KERAK (API da Iroda, lekin server.js da yo\'q):');
        irodaAgents.forEach(a => {
            if (!currentIrodaIds.has(a.SD_id)) {
                console.log(`   ${a.SD_id.padEnd(8)} | ${a.name}`);
            }
        });

        // FINAL: To'g'ri ro'yxat
        console.log('\n═══════════════════════════════════════════════════════');
        console.log('📋 TO\'G\'RI IRODA AGENTLARI RO\'YXATI (server.js ga yozish):');
        console.log('═══════════════════════════════════════════════════════');
        const finalIds = irodaAgents.map(a => `'${a.SD_id}'`);
        console.log(`const irodaAgentIds = new Set([${finalIds.join(', ')}]);`);
        console.log(`// Jami: ${irodaAgents.length} ta agent`);
    } else {
        console.log('❌ Iroda nomli supervisor topilmadi! Barcha supervisor nomlarini ko\'ring yuqorida.');
    }

    // 6. Bugungi savdo tekshirish
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📊 BUGUNGI IRODA SAVDOSI (tekshirish):');
    console.log('═══════════════════════════════════════════════════════');
    
    const today = new Date().toISOString().split('T')[0];
    const ordersData = await apiRequest(auth, 'getOrder', { 
        page: 1, limit: 500,
        filter: { status: 'all' }
    });
    const orders = ordersData?.result?.order || [];
    const todayOrders = orders.filter(o => (o.dateCreate || o.dateDocument || '').startsWith(today));
    
    console.log(`   Bugungi barcha buyurtmalar: ${todayOrders.length}`);

    // Iroda agentlari bo'yicha savdo (hozirgi ro'yxat)
    let currentIrodaSum = 0;
    let currentIrodaCount = 0;
    todayOrders.forEach(o => {
        if (currentIrodaIds.has(o.agent?.SD_id)) {
            const sum = parseFloat(o.totalSumma) || 0;
            if (o.status !== 4 && o.status !== 5 && sum > 0) {
                currentIrodaSum += sum;
                currentIrodaCount++;
            }
        }
    });
    console.log(`   Hozirgi ro'yxat (${currentIrodaIds.size} ta): ${currentIrodaSum.toLocaleString()} so'm, ${currentIrodaCount} ta zakaz`);

    // Iroda agentlari bo'yicha savdo (API dan)
    if (irodaAgents.length > 0) {
        const apiIrodaIds = new Set(irodaAgents.map(a => a.SD_id));
        let apiIrodaSum = 0;
        let apiIrodaCount = 0;
        todayOrders.forEach(o => {
            if (apiIrodaIds.has(o.agent?.SD_id)) {
                const sum = parseFloat(o.totalSumma) || 0;
                if (o.status !== 4 && o.status !== 5 && sum > 0) {
                    apiIrodaSum += sum;
                    apiIrodaCount++;
                }
            }
        });
        console.log(`   API ro'yxat (${apiIrodaIds.size} ta):  ${apiIrodaSum.toLocaleString()} so'm, ${apiIrodaCount} ta zakaz`);
        console.log(`\n   FARQ: ${(apiIrodaSum - currentIrodaSum).toLocaleString()} so'm, ${apiIrodaCount - currentIrodaCount} ta zakaz`);
    }
}

main().catch(console.error);
