// getClient API da срок bor-yo'qligini tekshirish
// Browser konsolida ishga tushirish uchun

(async function () {
    try {
        // API dan client olish
        const res = await window.app.api.request('getClient', { page: 1, limit: 3 });

        if (res.result?.client?.length > 0) {
            console.log('📋 MIJOZ KALITLARI:', Object.keys(res.result.client[0]));
            console.log('📋 BIRINCHI MIJOZ:', JSON.stringify(res.result.client[0], null, 2));
        }
    } catch (e) {
        console.error('Xato:', e);
    }
})();
