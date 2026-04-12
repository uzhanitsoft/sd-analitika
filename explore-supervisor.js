/**
 * Supervisor va agentlar orqali to'liq ma'lumot olish
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

async function exploreSupervisor() {
    console.log('🔍 SUPERVISOR VA AGENTLAR MA\'LUMOTI\n');
    console.log('='.repeat(70));

    // 1. SUPERVISOR TO'LIQ MA'LUMOTI
    console.log('\n📌 1. SUPERVISORLAR:\n');
    const supData = await apiCall('getSupervisor');

    if (supData.result?.supervisor) {
        supData.result.supervisor.forEach(sup => {
            console.log(`\n👔 SUPERVISOR: ${sup.name} (${sup.SD_id})`);
            console.log(`   Code: ${sup.code_1C}`);
            console.log(`   Faol: ${sup.active}`);

            if (sup.agents && sup.agents.length > 0) {
                console.log(`   Agentlari (${sup.agents.length}):`);
                sup.agents.forEach(agent => {
                    console.log(`     - ${agent.name} (${agent.SD_id})`);
                });
            }
        });
    }

    // 2. EXPEDITORLAR
    console.log('\n' + '='.repeat(70));
    console.log('\n📌 2. EXPEDITORLAR:\n');
    const expData = await apiCall('getExpeditor');

    if (expData.result?.expeditor) {
        expData.result.expeditor.forEach(exp => {
            console.log(`🚚 ${exp.name} (${exp.SD_id}) - ${exp.active === 'Y' ? 'Faol' : 'Nofaol'}`);
        });
    }

    // 3. AGENTLAR TO'LIQ RO'YXATI
    console.log('\n' + '='.repeat(70));
    console.log('\n📌 3. BARCHA AGENTLAR:\n');
    const agentData = await apiCall('getAgent');

    if (agentData.result?.agent) {
        agentData.result.agent.forEach(agent => {
            console.log(`👤 ${agent.name.padEnd(25)} | ID: ${agent.SD_id.padEnd(8)} | ${agent.active === 'Y' ? '✅' : '❌'}`);
        });
    }

    // 4. WAREHOUSE/SKLAD
    console.log('\n' + '='.repeat(70));
    console.log('\n📌 4. OMBORLAR:\n');
    const stockData = await apiCall('getStock');

    if (stockData.result?.warehouse) {
        stockData.result.warehouse.forEach(wh => {
            console.log(`🏭 ${wh.name} (${wh.SD_id})`);
        });
    }

    // 5. TO'LOVLAR STATISTIKASI
    console.log('\n' + '='.repeat(70));
    console.log('\n📌 5. TO\'LOVLAR STATISTIKASI:\n');
    const payData = await apiCall('getPayment');

    if (payData.result?.payment) {
        const payments = payData.result.payment;
        let total = 0;
        let today = 0;
        const todayDate = new Date().toISOString().split('T')[0];

        payments.forEach(p => {
            const amount = parseFloat(p.amount) || 0;
            total += amount;
            if (p.paymentDate?.startsWith(todayDate)) {
                today += amount;
            }
        });

        console.log(`Jami to'lovlar soni: ${payments.length}`);
        console.log(`Umumiy summa: ${total.toLocaleString()} UZS`);
        console.log(`Bugungi: ${today.toLocaleString()} UZS`);

        // Oxirgi 5 ta to'lov
        console.log('\nOxirgi 5 ta to\'lov:');
        payments.slice(0, 5).forEach(p => {
            console.log(`  ${p.paymentDate} | ${(parseFloat(p.amount) || 0).toLocaleString().padStart(12)} UZS | ${p.client?.name || '-'}`);
        });
    }

    // 6. BALANSLAR (QARZDORLIK)
    console.log('\n' + '='.repeat(70));
    console.log('\n📌 6. QARZDORLIK (TOP 10):\n');
    const balData = await apiCall('getBalance');

    if (balData.result?.balance) {
        const debtors = balData.result.balance
            .filter(b => (b.balance || 0) < 0)
            .sort((a, b) => a.balance - b.balance)
            .slice(0, 10);

        let totalDebt = 0;
        debtors.forEach((d, i) => {
            const debt = Math.abs(d.balance);
            totalDebt += debt;
            console.log(`${(i + 1).toString().padStart(2)}. ${d.name?.substring(0, 30).padEnd(30)} | ${debt.toLocaleString().padStart(15)} UZS`);
        });

        console.log(`\n💰 Top 10 umumiy: ${totalDebt.toLocaleString()} UZS`);

        // Umumiy qarzdorlik
        const allDebt = balData.result.balance
            .filter(b => (b.balance || 0) < 0)
            .reduce((sum, b) => sum + Math.abs(b.balance), 0);
        console.log(`📊 JAMI QARZDORLIK: ${allDebt.toLocaleString()} UZS`);
    }

    // 7. XULOSA
    console.log('\n' + '='.repeat(70));
    console.log('\n📌 XULOSA:\n');
    console.log('❌ getOrder - buyurtmalar ko\'rinmayapti (huquq cheklangan)');
    console.log('✅ getPayment - to\'lovlar ko\'rinyapti');
    console.log('✅ getBalance - qarzdorlik ko\'rinyapti');
    console.log('✅ getSupervisor - supervisor ma\'lumoti bor');
    console.log('\n💡 MASLAHAT: "Iroda" supervisor akkaunti bilan kirish kerak');
    console.log('   - Iroda SD_id: d0_72');
    console.log('   - 28 ta agent uning qo\'l ostida');
}

exploreSupervisor().catch(console.error);
