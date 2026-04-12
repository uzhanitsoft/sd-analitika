const fetch = require('node-fetch');

const url = 'https://rafiq.salesdoc.io/api/v2/';
const auth = { userId: 'd0_67', token: '460e6b260534c4b7d005fea460d5feda' };

async function checkDocuments() {
    console.log('📋 Hujjat metodlarini tekshirish...\n');

    // Sales Doctor API - mavjud metodlarni sinash
    const methodsToTry = [
        // Hujjatlar
        'getDocument',
        'getDocuments',
        'getDocumentList',
        'getDocumentOrder',
        'getDocumentSale',

        // Nakladnoylar
        'getInvoice',
        'getInvoices',
        'getNakladnoy',
        'getNakladnaya',

        // Realizatsiya
        'getRealization',
        'getRealizations',
        'getRealizationList',

        // Otgruzka
        'getShipment',
        'getShipments',
        'getOtgruzka',

        // Prodaja
        'getProdaja',
        'getProdazha',

        // Request info
        'getInfo',
        'getMethods',
        'getApiMethods',
        'help',
    ];

    const found = [];

    for (const method of methodsToTry) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ auth, method, params: {} })
            });
            const data = await res.json();
            if (data.status === true) {
                found.push(method);
                console.log(`✅ ${method}:`);
                console.log(`   Keys: ${Object.keys(data.result || {}).join(', ')}`);
                const keys = Object.keys(data.result || {});
                keys.forEach(key => {
                    if (Array.isArray(data.result[key])) {
                        console.log(`   ${key}: ${data.result[key].length} ta`);
                    }
                });
            }
        } catch (e) { }
    }

    console.log('\n\n=== TOPILGAN METODLAR ===');
    console.log(found.join(', ') || 'Hech narsa topilmadi');

    // Endi barcha ishlaydigan metodlarni ro'yxatini olamiz
    console.log('\n\n🔍 Barcha ishlaydigan metodlar ro\'yxati:');
    const allKnownMethods = [
        'getOrder', 'getProduct', 'getClient', 'getAgent',
        'getStock', 'getWarehouse', 'getPriceType', 'getPaymentType',
        'getPayment', 'getBalance', 'getExpeditor', 'getCategory'
    ];

    let totalSum = 0;
    for (const method of allKnownMethods) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ auth, method, params: {} })
            });
            const data = await res.json();
            if (data.status === true) {
                const keys = Object.keys(data.result || {});
                let count = 0;
                keys.forEach(key => {
                    if (Array.isArray(data.result[key])) {
                        count = data.result[key].length;
                    }
                });
                console.log(`${method}: ${count} ta`);
            }
        } catch (e) { }
    }
}

checkDocuments().catch(console.error);
