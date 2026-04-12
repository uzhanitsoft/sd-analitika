const fetch = require('node-fetch');
async function check() {
    try {
        const r = await fetch('http://localhost:3000/api/cache/orders/today', { timeout: 5000 });
        const d = await r.json();
        const orders = d.result?.order || [];
        console.log('Birinchi 3 buyurtma agent ma\'lumotlari:');
        orders.slice(0, 3).forEach((o, i) => {
            console.log(`\nOrder ${i + 1}:`);
            console.log('  agent:', JSON.stringify(o.agent));
        });

        // Agents endpoint
        const a = await fetch('http://localhost:3000/api/cache/agents', { timeout: 5000 });
        const ad = await a.json();
        console.log('\nAgents endpoint:', JSON.stringify(ad).substring(0, 500));
    } catch (e) { console.error(e.message); }
}
check();
