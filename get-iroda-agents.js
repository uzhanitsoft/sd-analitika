/**
 * Iroda supervayzerga bog'langan agentlar va ularning sotuvlarini olish
 * Fresh login bilan
 */

const fetch = require('node-fetch');

const config = {
    serverUrl: 'rafiq.salesdoc.io'
};

async function login() {
    const response = await fetch(`https://${config.serverUrl}/api/v2/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            method: 'login',
            params: {
                login: 'Iroda',
                password: '1234567rafiq'
            }
        })
    });

    const data = await response.json();
    if (data.status && data.result) {
        console.log('✅ Login muvaffaqiyatli!');
        console.log(`   UserID: ${data.result.userId}`);
        console.log(`   Token: ${data.result.token}`);
        return data.result;
    } else {
        throw new Error(data.error?.message || 'Login xato');
    }
}

async function makeRequest(method, params, auth) {
    const response = await fetch(`https://${config.serverUrl}/api/v2/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            method: method,
            params: {
                ...params,
                userId: auth.userId,
                token: auth.token
            }
        })
    });

    return await response.json();
}

async function main() {
    try {
        // 1. Login
        console.log('🔐 Login qilish...\n');
        const auth = await login();

        console.log('\n🔍 Foydalanuvchilar ro\'yxatini olish...\n');

        // 2. Barcha foydalanuvchilarni olish
        const usersRes = await makeRequest('getUser', {}, auth);
        const users = usersRes.result?.user || [];

        console.log(`📋 Jami ${users.length} ta foydalanuvchi topildi\n`);

        if (users.length === 0) {
            console.log('❌ Foydalanuvchilar topilmadi!');
            console.log('API javob:', JSON.stringify(usersRes, null, 2).slice(0, 500));
            return;
        }

        // 3. Barcha foydalanuvchilarni ko'rsatish
        console.log('📝 Barcha foydalanuvchilar:');
        users.forEach(u => {
            console.log(`   - ${u.name} (${u.SD_id}) role=${u.role || 'unknown'} parent=${u.parent_id || 'null'}`);
        });

        // 4. Iroda ni topish
        const iroda = users.find(u => u.name && u.name.toLowerCase().includes('iroda'));

        if (!iroda) {
            console.log('\n❌ Iroda topilmadi!');
            return;
        }

        console.log(`\n✅ Iroda topildi:`);
        console.log(`   ID: ${iroda.SD_id}`);
        console.log(`   Ism: ${iroda.name}`);
        console.log(`   Rol: ${iroda.role}`);
        console.log(`   Parent ID: ${iroda.parent_id || 'yo\'q'}`);

        // 5. Iroda'ga bog'langan agentlarni topish (parent_id = iroda.SD_id)
        console.log('\n🔍 Iroda\'ga bog\'langan agentlarni qidirish...\n');

        const agents = users.filter(u => u.parent_id === iroda.SD_id);

        console.log(`👥 Iroda\'ga bog\'langan agentlar: ${agents.length} ta\n`);

        if (agents.length > 0) {
            agents.forEach(a => {
                console.log(`   👤 ${a.name} (${a.SD_id})`);
            });
        }

        // 6. Agentlar buyurtmalarini olish
        console.log('\n📦 Buyurtmalarni yuklash...\n');

        const ordersRes = await makeRequest('getOrder', { limit: 5000 }, auth);
        const allOrders = ordersRes.result?.order || [];

        console.log(`📋 Jami ${allOrders.length} ta buyurtma\n`);

        // 7. Owner bo'yicha tahlil
        const ownerStats = {};
        allOrders.forEach(order => {
            const ownerId = order.owner?.SD_id;
            const ownerName = order.owner?.name || 'Unknown';

            if (!ownerStats[ownerId]) {
                ownerStats[ownerId] = {
                    name: ownerName,
                    id: ownerId,
                    orders: 0,
                    totalUZS: 0,
                    totalUSD: 0
                };
            }

            const sum = parseFloat(order.totalSumma) || 0;
            const paymentTypeId = order.paymentType?.SD_id;

            ownerStats[ownerId].orders++;
            if (paymentTypeId === 'd0_4') {
                ownerStats[ownerId].totalUSD += sum;
            } else {
                ownerStats[ownerId].totalUZS += sum;
            }
        });

        console.log('📊 Buyurtmalar egalari (owner) bo\'yicha:');
        Object.entries(ownerStats)
            .sort((a, b) => b[1].totalUZS - a[1].totalUZS)
            .forEach(([id, stats]) => {
                console.log(`   ${stats.name}: ${stats.orders} buyurtma, ${(stats.totalUZS / 1000000).toFixed(1)} mln so'm, $${stats.totalUSD.toLocaleString()}`);
            });

        // 8. Agentlar statistikasi
        if (agents.length > 0) {
            const agentIds = agents.map(a => a.SD_id);
            let totalSalesUZS = 0;
            let totalSalesUSD = 0;
            let totalOrders = 0;

            allOrders.forEach(order => {
                const ownerId = order.owner?.SD_id;

                if (agentIds.includes(ownerId)) {
                    const sum = parseFloat(order.totalSumma) || 0;
                    const paymentTypeId = order.paymentType?.SD_id;

                    if (paymentTypeId === 'd0_4') {
                        totalSalesUSD += sum;
                    } else {
                        totalSalesUZS += sum;
                    }
                    totalOrders++;
                }
            });

            console.log('\n═══════════════════════════════════════════════');
            console.log('📊 IRODA AGENTLARI SOTUVLARI');
            console.log('═══════════════════════════════════════════════');
            console.log(`👥 Agentlar soni: ${agents.length}`);
            console.log(`📦 Buyurtmalar: ${totalOrders}`);
            console.log(`💰 So'm: ${totalSalesUZS.toLocaleString()}`);
            console.log(`💵 Dollar: ${totalSalesUSD.toLocaleString()}`);
            console.log('═══════════════════════════════════════════════');
        }

    } catch (error) {
        console.error('❌ Xato:', error.message);
    }
}

main();
