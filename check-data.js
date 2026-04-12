/**
 * Sales Doctor API Full Data Check
 */

const fetch = require('node-fetch');

const serverUrl = 'https://rafiq.salesdoc.io/api/v2/';
const userId = 'd0_67';
const token = '460e6b260534c4b7d005fea460d5feda';

async function checkFullData() {
    console.log('📊 To\'liq API ma\'lumotlarini tekshirish...\n');

    // 1. Orders - barcha buyurtmalar
    console.log('='.repeat(60));
    console.log('📦 BUYURTMALAR (getOrder)');
    console.log('='.repeat(60));

    const ordersRes = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            auth: { userId, token },
            method: 'getOrder',
            params: {}
        })
    });
    const ordersData = await ordersRes.json();

    if (ordersData.result?.order) {
        const orders = ordersData.result.order;
        console.log(`Jami buyurtmalar: ${orders.length}`);

        // Har bir buyurtmani ko'rish
        let totalSum = 0;
        let totalUSD = 0;
        orders.forEach((order, i) => {
            console.log(`\n--- Buyurtma ${i + 1} ---`);
            console.log(`ID: ${order.SD_id}`);
            console.log(`Sana: ${order.dateCreate}`);
            console.log(`Mijoz: ${order.client?.name}`);
            console.log(`Agent: ${order.agent?.name}`);
            console.log(`Summa: ${order.totalSumma}`);
            console.log(`Chegirma: ${order.discountSumma}`);
            console.log(`Chegirmadan keyin: ${order.totalSummaAfterDiscount}`);
            console.log(`Status: ${order.status}`);

            // Valyuta bormi?
            if (order.currency) console.log(`Valyuta: ${order.currency}`);
            if (order.priceType) console.log(`Narx turi:`, JSON.stringify(order.priceType));

            totalSum += parseFloat(order.totalSumma) || 0;
        });

        console.log(`\n💰 JAMI SUMMA: ${totalSum.toLocaleString()}`);
    }

    // 2. Barcha metodlardan qo'shimcha ma'lumotlar
    console.log('\n\n' + '='.repeat(60));
    console.log('🔍 QOSHIMCHA METODLAR');
    console.log('='.repeat(60));

    // Reference/Spravochnik - valyutalar, narx turlari
    const refMethods = ['getReference', 'getPriceType', 'getCurrency', 'getPaymentType', 'getStock'];

    for (const method of refMethods) {
        try {
            const res = await fetch(serverUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    auth: { userId, token },
                    method: method,
                    params: {}
                })
            });
            const data = await res.json();

            if (data.status === true) {
                console.log(`\n✅ ${method}:`);
                console.log(`   Keys: ${Object.keys(data.result || {}).join(', ')}`);
                const firstKey = Object.keys(data.result || {})[0];
                if (firstKey && Array.isArray(data.result[firstKey])) {
                    console.log(`   ${firstKey}: ${data.result[firstKey].length} ta`);
                    if (data.result[firstKey][0]) {
                        console.log(`   Sample: ${JSON.stringify(data.result[firstKey][0]).substring(0, 200)}`);
                    }
                }
            }
        } catch (e) {
            // skip
        }
    }

    // 3. getAgent - barcha agentlar
    console.log('\n\n' + '='.repeat(60));
    console.log('👥 AGENTLAR');
    console.log('='.repeat(60));

    const agentsRes = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            auth: { userId, token },
            method: 'getAgent',
            params: {}
        })
    });
    const agentsData = await agentsRes.json();

    if (agentsData.result?.agent) {
        const agents = agentsData.result.agent;
        console.log(`Jami agentlar: ${agents.length}`);
        agents.forEach((agent, i) => {
            console.log(`${i + 1}. ${agent.name} (${agent.active === 'Y' ? 'Faol' : 'Nofaol'})`);
        });
    }
}

checkFullData().catch(console.error);
