/**
 * Sales Doctor - Barcha statusdagi buyurtmalarni olish yo'lini topish
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

async function findAllStatuses() {
    console.log('🔍 BARCHA STATUSDAGI BUYURTMALARNI TOPISH\n');
    console.log('='.repeat(70));

    // 1. Avval order statuslarini olishga harakat qilamiz
    console.log('\n📌 1. STATUS TURLARI (getOrderStatus, getStatus, etc.):\n');

    const statusMethods = [
        'getOrderStatus', 'getStatus', 'getStatusList', 'status',
        'getOrderState', 'getState', 'getOrderType', 'orderStatus',
        'getDocumentStatus', 'getDeliveryStatus', 'getShipmentStatus'
    ];

    for (const method of statusMethods) {
        try {
            const data = await apiCall(method);
            if (data.status === true && data.result) {
                console.log(`  ✅ ${method}:`);
                console.log(`     ${JSON.stringify(data.result).substring(0, 300)}`);
            }
        } catch (e) { }
    }

    // 2. Turli status parametrlari bilan getOrder
    console.log('\n' + '='.repeat(70));
    console.log('📌 2. TURLI STATUS PARAMETRLARI:\n');

    const statusParams = [
        // Status nomi bilan
        { name: 'status: "all"', params: { status: 'all' } },
        { name: 'status: "shipped"', params: { status: 'shipped' } },
        { name: 'status: "delivered"', params: { status: 'delivered' } },
        { name: 'status: "Отгружен"', params: { status: 'Отгружен' } },
        { name: 'status: "Доставлен"', params: { status: 'Доставлен' } },
        { name: 'status: "completed"', params: { status: 'completed' } },
        { name: 'status: "done"', params: { status: 'done' } },

        // State parametri
        { name: 'state: "all"', params: { state: 'all' } },
        { name: 'state: "shipped"', params: { state: 'shipped' } },
        { name: 'state: "delivered"', params: { state: 'delivered' } },

        // Filter ichida
        { name: 'filter.status: "all"', params: { filter: { status: 'all' } } },
        { name: 'filter.status: "shipped"', params: { filter: { status: 'shipped' } } },
        { name: 'filter.status: "delivered"', params: { filter: { status: 'delivered' } } },
        { name: 'filter.state: "all"', params: { filter: { state: 'all' } } },

        // Raqam bilan (0, 1, 2, 3, ...)
        { name: 'status: 0', params: { status: 0 } },
        { name: 'status: 1', params: { status: 1 } },
        { name: 'status: 2', params: { status: 2 } },
        { name: 'status: 3', params: { status: 3 } },
        { name: 'status: 4', params: { status: 4 } },
        { name: 'status: 5', params: { status: 5 } },

        // ID bo'lishi mumkin
        { name: 'statusId: 1', params: { statusId: 1 } },
        { name: 'statusId: 2', params: { statusId: 2 } },
        { name: 'statusId: 3', params: { statusId: 3 } },

        // orderStatus
        { name: 'orderStatus: "shipped"', params: { orderStatus: 'shipped' } },
        { name: 'orderStatus: "delivered"', params: { orderStatus: 'delivered' } },
        { name: 'orderStatus: "all"', params: { orderStatus: 'all' } },

        // shipped/delivered flag
        { name: 'shipped: true', params: { shipped: true } },
        { name: 'delivered: true', params: { delivered: true } },
        { name: 'isDelivered: true', params: { isDelivered: true } },
        { name: 'isShipped: true', params: { isShipped: true } },

        // includeAll variants
        { name: 'includeAllStatuses: true', params: { includeAllStatuses: true } },
        { name: 'allStatuses: true', params: { allStatuses: true } },
        { name: 'withAllStatus: true', params: { withAllStatus: true } },
        { name: 'showAll: true', params: { showAll: true } },
        { name: 'includeDelivered: true', params: { includeDelivered: true } },
        { name: 'includeShipped: true', params: { includeShipped: true } },

        // Array sifatida
        { name: 'status: [1,2,3,4,5]', params: { status: [1, 2, 3, 4, 5] } },
        { name: 'statuses: [1,2,3,4,5]', params: { statuses: [1, 2, 3, 4, 5] } },
    ];

    let maxOrders = 0;
    let bestConfig = null;

    for (const { name, params } of statusParams) {
        try {
            const data = await apiCall('getOrder', params);
            const count = data.result?.order?.length || 0;
            if (count > 0) {
                console.log(`  📦 ${name.padEnd(35)} -> ${count} ta buyurtma`);
                if (count > maxOrders) {
                    maxOrders = count;
                    bestConfig = { name, params };
                }
            }
        } catch (e) { }
    }

    console.log(`\n  🏆 Eng yaxshi natija: ${maxOrders} ta (${bestConfig?.name || 'topilmadi'})`);

    // 3. getShipment, getDelivery metodlarini tekshirish
    console.log('\n' + '='.repeat(70));
    console.log('📌 3. YETKAZIB BERISH/YUBORISH METODLARI:\n');

    const deliveryMethods = [
        'getShipment', 'getDelivery', 'getDelivered', 'getShipped',
        'shipment', 'delivery', 'getOrderShipment', 'getOrderDelivery',
        'getCompletedOrders', 'getFinishedOrders', 'getProcessedOrders'
    ];

    for (const method of deliveryMethods) {
        try {
            const data = await apiCall(method);
            if (data.status === true && data.result) {
                const keys = Object.keys(data.result);
                let count = 0;
                for (const key of keys) {
                    if (Array.isArray(data.result[key])) {
                        count = data.result[key].length;
                        break;
                    }
                }
                console.log(`  ✅ ${method.padEnd(25)} -> ${count} items, keys: [${keys.join(', ')}]`);
            }
        } catch (e) { }
    }

    // 4. Hozirgi buyurtmalarning statuslarini tekshirish
    console.log('\n' + '='.repeat(70));
    console.log('📌 4. HOZIRGI BUYURTMALAR STATUSLARI:\n');

    const ordersData = await apiCall('getOrder', { limit: 50 });
    if (ordersData.result?.order) {
        const orders = ordersData.result.order;
        console.log(`  Olingan buyurtmalar: ${orders.length}\n`);

        // Status bo'yicha gruppalash
        const statusGroups = {};
        orders.forEach(o => {
            const status = o.status || o.state || o.orderStatus || 'unknown';
            if (!statusGroups[status]) statusGroups[status] = [];
            statusGroups[status].push(o);
        });

        for (const [status, items] of Object.entries(statusGroups)) {
            console.log(`  📊 Status "${status}": ${items.length} ta buyurtma`);
        }

        // Birinchi buyurtmaning barcha maydonlarini chiqarish
        if (orders[0]) {
            console.log('\n  Birinchi buyurtma maydonlari:');
            const fields = Object.keys(orders[0]);
            console.log(`  ${fields.join(', ')}`);

            // Status ga o'xshash maydonlarni qidirish
            const statusFields = fields.filter(f =>
                f.toLowerCase().includes('status') ||
                f.toLowerCase().includes('state') ||
                f.toLowerCase().includes('delivery') ||
                f.toLowerCase().includes('ship')
            );
            console.log(`\n  Status bilan bog'liq maydonlar: ${statusFields.join(', ') || 'topilmadi'}`);

            for (const field of statusFields) {
                console.log(`    ${field}: ${JSON.stringify(orders[0][field])}`);
            }
        }
    }

    // 5. Period bilan birga status
    console.log('\n' + '='.repeat(70));
    console.log('📌 5. PERIOD + STATUS KOMBINATSIYALARI:\n');

    const periodParams = [
        {
            name: 'Bu oy + all status',
            params: {
                period: { dateFrom: '2026-02-01', dateTo: '2026-02-28' },
                status: 'all'
            }
        },
        {
            name: 'Bu oy + delivered',
            params: {
                period: { dateFrom: '2026-02-01', dateTo: '2026-02-28' },
                status: 'delivered'
            }
        },
        {
            name: 'Bu oy + filter.all',
            params: {
                period: { dateFrom: '2026-02-01', dateTo: '2026-02-28' },
                filter: { all: true }
            }
        },
        {
            name: 'dateFrom + dateTo + all',
            params: {
                dateFrom: '2026-02-01',
                dateTo: '2026-02-28',
                status: 'all'
            }
        },
    ];

    for (const { name, params } of periodParams) {
        try {
            const data = await apiCall('getOrder', params);
            const count = data.result?.order?.length || 0;
            console.log(`  📦 ${name.padEnd(35)} -> ${count} ta buyurtma`);
        } catch (e) { }
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ TEKSHIRISH YAKUNLANDI\n');
}

findAllStatuses().catch(console.error);
