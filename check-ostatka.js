// Ostatka (qoldiq) ma'lumotini tekshirish - proxy orqali
const http = require('http');

const PROXY_URL = 'localhost';
const PROXY_PORT = 3000;

function apiRequest(method, params = {}) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            method: method,
            params: params
        });

        const options = {
            hostname: PROXY_URL,
            port: PROXY_PORT,
            path: '/api/proxy',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function checkOstatka() {
    console.log('=== getProduct API tekshirilmoqda ===\n');

    try {
        // getProduct dan mahsulotlarni olish
        const productRes = await apiRequest('getProduct', { limit: 10 });
        const products = productRes.result?.product || [];

        console.log(`Mahsulotlar soni: ${products.length}`);

        if (products.length > 0) {
            console.log('\n--- Birinchi mahsulot tuzilmasi ---');
            console.log(JSON.stringify(products[0], null, 2));

            // Mavjud kalitlar
            const keys = Object.keys(products[0]);
            console.log('\n--- Mavjud kalitlar ---');
            console.log(keys.join(', '));
        }

        // getPurchase dan ostatka tekshirish
        console.log('\n\n=== getPurchase detail tekshirilmoqda ===\n');
        const purchaseRes = await apiRequest('getPurchase', { limit: 5 });
        const purchases = purchaseRes.result?.warehouse || [];

        console.log(`Purchase soni: ${purchases.length}`);

        if (purchases.length > 0 && purchases[0].detail?.length > 0) {
            console.log('\n--- Birinchi detail tuzilmasi ---');
            console.log(JSON.stringify(purchases[0].detail[0], null, 2));
        }

    } catch (error) {
        console.error('Xatolik:', error.message);
    }
}

checkOstatka();
