/**
 * Buyurtmalardagi owner ismlarini tekshirish
 */

const http = require('http');

const config = {
    serverUrl: 'rafiq.salesdoc.io',
    userId: 'd0_67',
    token: '460e6b260534c4b7d005fea460d5feda'
};

function makeRequest(method, params = {}) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            method: method,
            serverUrl: config.serverUrl,
            params: {
                ...params,
                userId: config.userId,
                token: config.token
            }
        });

        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/proxy',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function main() {
    try {
        console.log('📦 Buyurtmalarni yuklash...\n');

        const ordersRes = await makeRequest('getOrder', { limit: 500 });
        const orders = ordersRes.result?.order || [];

        console.log(`📋 Jami ${orders.length} ta buyurtma\n`);

        // Owner ismlarini yig'ish
        const ownerNames = new Set();
        orders.forEach(order => {
            if (order.owner?.name) {
                ownerNames.add(order.owner.name);
            }
        });

        console.log('👥 Buyurtmalardagi barcha owner ismlari:');
        console.log('═══════════════════════════════════════════════');
        [...ownerNames].sort().forEach(name => {
            console.log(`   - ${name}`);
        });
        console.log('═══════════════════════════════════════════════');

        // Iroda agentlarini qidirish
        const irodaAgentNames = [
            'Nilufarxon', 'Oybek', 'Tojiboyev Abubakir', 'Ostonaqulov Abdulloh',
            'Usmonqulov Asadulloh', 'Axmedova Xalimaxon', 'Abduraxmonov Shuxrat',
            'Aliakbar Yusupov', 'Abduraximova Muxayyoxon', 'Xolmirzayeva Honzodaxon',
            'Xolmuxamedova Ziroatxon', 'Soliev Ibrohimjon', 'Matkarimov Bexruz'
        ];

        console.log('\n🔍 Iroda agentlari qidiruvi:');
        irodaAgentNames.forEach(agentName => {
            const found = [...ownerNames].find(ownerName => {
                const ownerLower = ownerName.toLowerCase();
                const agentLower = agentName.toLowerCase();
                return ownerLower.includes(agentLower) || agentLower.includes(ownerLower);
            });
            console.log(`   ${agentName}: ${found ? '✅ ' + found : '❌ topilmadi'}`);
        });

    } catch (error) {
        console.error('❌ Xato:', error.message);
    }
}

main();
