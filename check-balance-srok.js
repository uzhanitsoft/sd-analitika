// Balans ma'lumotlarida срок (muddat) bor-yo'qligini tekshirish

const https = require('https');

const BASE_URL = 'https://api.salesdoc.io/api/v1.1';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoiNjQ0YTFmNjM4OTMxMzdmZjE3MWI1M2NjIiwic2VydmVyIjoiNjM4MzMwNTI3NjQzYzc2ZjBhMDNmNDE3IiwiZXhwIjoxNzM4NzcwMTE4MDQ3LCJpYXQiOjE3Mzg1OTczMTh9.oPz94qohe1O48b4fJE7g3N-qZCrL2AhAmLx8DlD_3gs';

function makeRequest(action, params = {}) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({ ...params, action });

        const options = {
            hostname: 'api.salesdoc.io',
            path: '/api/v1.1',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AUTH_TOKEN}`,
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
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
        console.log('Balance ma\'lumotlarini olish...\n');

        const res = await makeRequest('getBalance', { page: 1, limit: 5 });

        if (res.result?.balance?.length > 0) {
            console.log('=== BIRINCHI 3 TA BALANS TUZILMASI ===\n');

            res.result.balance.slice(0, 3).forEach((b, i) => {
                console.log(`--- Balans ${i + 1} ---`);
                console.log('Barcha kalitlar:', Object.keys(b));
                console.log('');

                // Срок ga o'xshash maydonlarni qidirish
                Object.keys(b).forEach(key => {
                    const keyLower = key.toLowerCase();
                    if (keyLower.includes('срок') ||
                        keyLower.includes('srok') ||
                        keyLower.includes('date') ||
                        keyLower.includes('day') ||
                        keyLower.includes('deadline') ||
                        keyLower.includes('due') ||
                        keyLower.includes('term') ||
                        keyLower.includes('period') ||
                        keyLower.includes('last') ||
                        keyLower.includes('payment')) {
                        console.log(`  ${key}:`, b[key]);
                    }
                });

                console.log('\nTO\'LIQ OB\'EKT:');
                console.log(JSON.stringify(b, null, 2));
                console.log('\n');
            });
        } else {
            console.log('Balans topilmadi');
        }

    } catch (error) {
        console.error('Xato:', error);
    }
}

main();
