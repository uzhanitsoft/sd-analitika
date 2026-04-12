/**
 * Users ro'yxatini tekshirish
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
        console.log('👥 Foydalanuvchilarni yuklash...\n');

        const usersRes = await makeRequest('getUser', {});
        console.log('API javob:', JSON.stringify(usersRes, null, 2));

        const users = usersRes.result?.user || [];
        console.log(`\n📋 Jami ${users.length} ta foydalanuvchi\n`);

        if (users.length > 0) {
            console.log('Birinchi user:', users[0]);
        }

        // Iroda agentlarini qidirish
        const irodaAgentNames = [
            'Nilufarxon', 'Oybek', 'Tojiboyev Abubakir', 'Ostonaqulov Abdulloh',
            'Usmonqulov Asadulloh', 'Axmedova Xalimaxon', 'Abduraxmonov Shuxrat',
            'Alakbar Yusupov', 'Abduraximova Muxayyoxon', 'Xolmirzayeva Honzodaxon',
            'Xolmuxamedova Ziroatxon', 'Soliev Ibrohimjon', 'Matkarimov Bexruz'
        ];

        console.log('\n🔍 Iroda agentlari qidiruvi:\n');
        users.forEach(user => {
            const userName = user.name || '';
            const isMatch = irodaAgentNames.some(irodaName => {
                return userName.toLowerCase().includes(irodaName.toLowerCase()) ||
                    irodaName.toLowerCase().includes(userName.toLowerCase());
            });
            if (isMatch) {
                console.log(`✅ ${user.name} (SD_id: ${user.SD_id})`);
            }
        });

    } catch (error) {
        console.error('❌ Xato:', error);
    }
}

main();
