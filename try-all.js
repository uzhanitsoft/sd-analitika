/**
 * Sales Doctor - Barcha ma'lumotlarni olish uchun turli usullar
 */

const fetch = require('node-fetch');

const serverUrl = 'https://rafiq.salesdoc.io/api/v2/';
const userId = 'd0_67';
const token = '460e6b260534c4b7d005fea460d5feda';

async function tryAllMethods() {
    console.log('🔍 Turli usullar bilan sinash...\n');

    // 1. Oddiy getOrder
    console.log('1️⃣ getOrder (oddiy)');
    let res = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            auth: { userId, token },
            method: 'getOrder',
            params: {}
        })
    });
    let data = await res.json();
    console.log(`   Orders: ${data.result?.order?.length || 0}`);

    // 2. getOrder with all agents parameter
    console.log('\n2️⃣ getOrder (allAgents: true)');
    res = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            auth: { userId, token },
            method: 'getOrder',
            params: { allAgents: true }
        })
    });
    data = await res.json();
    console.log(`   Orders: ${data.result?.order?.length || 0}`);

    // 3. getOrder with agent filter empty
    console.log('\n3️⃣ getOrder (agent: null)');
    res = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            auth: { userId, token },
            method: 'getOrder',
            params: { agent: null }
        })
    });
    data = await res.json();
    console.log(`   Orders: ${data.result?.order?.length || 0}`);

    // 4. Boshqa metodlar bilan o'xshash ma'lumotlarni olishga harakat
    const otherMethods = [
        'getOrderAll', 'getAllOrders', 'orderList', 'orders',
        'getSale', 'getSales', 'getInvoice', 'getDocument',
        'getReport', 'getDashboard', 'getStatistics', 'getSummary'
    ];

    console.log('\n4️⃣ Boshqa metodlar:');
    for (const method of otherMethods) {
        try {
            res = await fetch(serverUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    auth: { userId, token },
                    method: method,
                    params: {}
                })
            });
            data = await res.json();
            if (data.status === true) {
                console.log(`   ✅ ${method} - ISHLADI!`);
                console.log(`      Result keys: ${Object.keys(data.result || {}).join(', ')}`);
            }
        } catch (e) { }
    }

    // 5. Agentlar ro'yxatidan har birining buyurtmalarini sanash
    console.log('\n5️⃣ Har bir agent buyurtmalari (agar ruxsat bo\'lsa):');
    res = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            auth: { userId, token },
            method: 'getAgent',
            params: {}
        })
    });
    data = await res.json();

    if (data.result?.agent) {
        console.log(`   Jami agentlar: ${data.result.agent.length}`);

        // Birinchi 3 ta agent uchun buyurtmalar
        for (let i = 0; i < Math.min(3, data.result.agent.length); i++) {
            const agent = data.result.agent[i];
            res = await fetch(serverUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    auth: { userId, token },
                    method: 'getOrder',
                    params: { agentId: agent.SD_id }
                })
            });
            const orderData = await res.json();
            console.log(`   ${agent.name}: ${orderData.result?.order?.length || 0} buyurtma`);
        }
    }
}

tryAllMethods().catch(console.error);
