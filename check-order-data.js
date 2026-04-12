// Buyurtma ma'lumotlarni tekshirish - item.summa tuzilishi
const fetch = require('node-fetch');

async function check() {
    try {
        console.log('Server cache status tekshirish...');
        const statusRes = await fetch('http://localhost:3000/api/cache/status', { timeout: 5000 });
        const status = await statusRes.json();
        console.log('Status:', JSON.stringify(status, null, 2));

        if (!status.hasData) {
            console.log('Cache tayyor emas!');
            return;
        }

        console.log('\nBuyurtmalar yuklanmoqda...');
        const ordersRes = await fetch('http://localhost:3000/api/cache/orders/today', { timeout: 10000 });
        const ordersData = await ordersRes.json();

        if (!ordersData.status) {
            console.log('Buyurtmalar xatosi:', ordersData.error);
            return;
        }

        const orders = ordersData.result?.order || [];
        console.log(`\nJami ${orders.length} ta buyurtma (bugun)\n`);

        // Birinchi 3 ta buyurtmani batafsil ko'rsatish
        orders.slice(0, 3).forEach((order, i) => {
            console.log(`\n=== Buyurtma #${i + 1} ===`);
            console.log(`  Status: ${order.status}`);
            console.log(`  totalSumma: ${order.totalSumma}`);
            console.log(`  Mahsulotlar soni: ${(order.orderProducts || []).length}`);

            (order.orderProducts || []).slice(0, 5).forEach((item, j) => {
                console.log(`\n  Mahsulot ${j + 1}:`);
                console.log(`    Nomi: ${item.product?.name || 'nomalum'}`);
                console.log(`    product.SD_id: ${item.product?.SD_id}`);
                console.log(`    quantity: ${item.quantity}`);
                console.log(`    summa: ${item.summa}`);
                console.log(`    price: ${item.price}`);
                console.log(`    costPrice: ${item.costPrice}`);
                console.log(`    To'liq item:`, JSON.stringify(item, null, 6).substring(0, 300));
            });
        });

        // PEMOLUKS ni qidiramiz
        console.log('\n\n=== PEMOLUKS QIDIRISH ===');
        let pemoluks = { sold: 0, revenue: 0, count: 0 };
        orders.forEach(order => {
            (order.orderProducts || []).forEach(item => {
                const name = (item.product?.name || '').toUpperCase();
                if (name.includes('PEMOLUKS') && name.includes('480')) {
                    pemoluks.sold += parseFloat(item.quantity) || 0;
                    pemoluks.revenue += parseFloat(item.summa) || 0;
                    pemoluks.count++;
                    if (pemoluks.count <= 5) {
                        console.log(`  Topildi: qty=${item.quantity}, summa=${item.summa}, price=${item.price}`);
                    }
                }
            });
        });
        console.log(`\nPEMOLUKS 480g: ${pemoluks.count} ta qayd, soni: ${pemoluks.sold}, summa: ${pemoluks.revenue}`);

    } catch (error) {
        console.error('Xato:', error.message);
    }
}

check();
