/**
 * Mijozlar balansini batafsil tekshirish
 * Sales Doctor web sahifasi bilan taqqoslash
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

async function checkClientsBalance() {
    console.log('🔍 MIJOZLAR BALANSINI TEKSHIRISH\n');

    const auth = await freshLogin();
    console.log(`✅ Login: ${auth.userId}\n`);

    // Balanslarni olish
    const balanceData = await apiCall(auth, 'getBalance', { limit: 10000 });
    const balances = balanceData.result?.balance || [];

    // Mijozlar ma'lumotlarini olish
    const clientsData = await apiCall(auth, 'getClient', { limit: 5000 });
    const clients = clientsData.result?.client || [];

    // Mijozlar lug'atini yaratish
    const clientMap = {};
    clients.forEach(c => {
        clientMap[c.SD_id] = c.name;
    });

    console.log(`📊 Balanslar: ${balances.length}, Mijozlar: ${clients.length}\n`);

    // Web sahifadagi mijozlarni qidirish
    const webClients = ['Asmo', 'Beshariq bozor', 'ISMOILXON MARKET'];

    console.log('='.repeat(60));
    console.log('📌 WEB SAHIFADAGI MIJOZLARNI QIDIRISH:\n');

    webClients.forEach(name => {
        const found = balances.find(b => {
            const clientId = b.client_id || b.client?.SD_id;
            const clientName = clientMap[clientId] || b.client?.name || '';
            return clientName.toLowerCase().includes(name.toLowerCase());
        });

        if (found) {
            const clientId = found.client_id || found.client?.SD_id;
            const clientName = clientMap[clientId] || found.client?.name || clientId;
            console.log(`  ✅ ${name}:`);
            console.log(`     Balans: ${parseFloat(found.balance).toLocaleString()}`);
            if (found['by-currency']) {
                found['by-currency'].forEach(c => {
                    const currNames = {
                        'd0_2': 'Naqd so\'m',
                        'd0_3': 'Beznal so\'m',
                        'd0_4': 'Dollar',
                        'd0_5': 'Clic'
                    };
                    console.log(`     ${currNames[c.currency_id] || c.currency_id}: ${parseFloat(c.amount).toLocaleString()}`);
                });
            }
        } else {
            console.log(`  ❌ ${name}: Topilmadi`);
        }
        console.log('');
    });

    // Valyuta bo'yicha qayta hisoblash - faqat manfiy balanslar (qarzdorlar)
    console.log('='.repeat(60));
    console.log('📌 FAQAT QARZDORLAR (balans < 0) VALYUTA BO\'YICHA:\n');

    const debtorTotals = {
        'd0_2': 0,
        'd0_3': 0,
        'd0_4': 0,
        'd0_5': 0
    };

    let debtorCount = 0;

    balances.forEach(b => {
        const balance = parseFloat(b.balance) || 0;

        if (balance < 0) {
            debtorCount++;
            if (b['by-currency'] && Array.isArray(b['by-currency'])) {
                b['by-currency'].forEach(curr => {
                    const amount = parseFloat(curr.amount) || 0;
                    if (debtorTotals.hasOwnProperty(curr.currency_id)) {
                        debtorTotals[curr.currency_id] += amount;
                    }
                });
            }
        }
    });

    console.log(`  Qarzdorlar soni: ${debtorCount}\n`);
    console.log('  Valyuta            | Jami qarz');
    console.log('  ' + '-'.repeat(50));

    const currNames = {
        'd0_2': 'Naqd so\'m',
        'd0_3': 'Beznal so\'m',
        'd0_4': 'Dollar',
        'd0_5': 'Clic'
    };

    for (const [id, total] of Object.entries(debtorTotals)) {
        console.log(`  ${currNames[id].padEnd(18)} | ${total.toLocaleString()}`);
    }

    // Kreditorlar (ijobiy balans)
    console.log('\n' + '='.repeat(60));
    console.log('📌 KREDITORLAR (balans > 0) VALYUTA BO\'YICHA:\n');

    const creditorTotals = {
        'd0_2': 0,
        'd0_3': 0,
        'd0_4': 0,
        'd0_5': 0
    };

    let creditorCount = 0;

    balances.forEach(b => {
        const balance = parseFloat(b.balance) || 0;

        if (balance > 0) {
            creditorCount++;
            if (b['by-currency'] && Array.isArray(b['by-currency'])) {
                b['by-currency'].forEach(curr => {
                    const amount = parseFloat(curr.amount) || 0;
                    if (creditorTotals.hasOwnProperty(curr.currency_id)) {
                        creditorTotals[curr.currency_id] += amount;
                    }
                });
            }
        }
    });

    console.log(`  Kreditorlar soni: ${creditorCount}\n`);
    console.log('  Valyuta            | Jami kredit');
    console.log('  ' + '-'.repeat(50));

    for (const [id, total] of Object.entries(creditorTotals)) {
        console.log(`  ${currNames[id].padEnd(18)} | ${total.toLocaleString()}`);
    }

    // Sof farq (Net)
    console.log('\n' + '='.repeat(60));
    console.log('📌 SOF FARQ (Net = Qarzdor + Kreditor):\n');

    console.log('  Valyuta            | Net jami');
    console.log('  ' + '-'.repeat(50));

    for (const id of Object.keys(debtorTotals)) {
        const net = debtorTotals[id] + creditorTotals[id];
        console.log(`  ${currNames[id].padEnd(18)} | ${net.toLocaleString()}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ YAKUNLANDI\n');
}

checkClientsBalance().catch(console.error);
