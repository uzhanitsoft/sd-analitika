/**
 * Sales Doctor API Structure Test
 */

const fetch = require('node-fetch');

const serverUrl = 'https://rafiq.salesdoc.io/api/v2/';
const userId = 'd0_67';
const token = '460e6b260534c4b7d005fea460d5feda';

async function checkStructure() {
    console.log('📊 API javob strukturasini tekshirish...\n');

    const methods = ['getOrder', 'getProduct', 'getClient', 'getAgent'];

    for (const method of methods) {
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

        console.log(`\n${'='.repeat(50)}`);
        console.log(`📦 Method: ${method}`);
        console.log(`${'='.repeat(50)}`);
        console.log('Status:', data.status);
        console.log('Result type:', typeof data.result);

        if (data.result) {
            console.log('Result keys:', Object.keys(data.result));

            // Birinchi elementni ko'rsatish
            const firstKey = Object.keys(data.result)[0];
            if (firstKey && data.result[firstKey]) {
                const firstItem = data.result[firstKey];
                if (Array.isArray(firstItem)) {
                    console.log(`${firstKey} is Array with ${firstItem.length} items`);
                    if (firstItem.length > 0) {
                        console.log('First item keys:', Object.keys(firstItem[0]));
                        console.log('Sample:', JSON.stringify(firstItem[0], null, 2).substring(0, 500));
                    }
                } else {
                    console.log(`${firstKey}:`, JSON.stringify(firstItem, null, 2).substring(0, 300));
                }
            }
        }
    }
}

checkStructure().catch(console.error);
