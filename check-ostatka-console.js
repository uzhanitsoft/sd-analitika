// Brauzerdagi console'da ishga tushiring:
// F12 > Console > bu kodni paste qiling

(async function () {
    console.log('=== Ostatka tekshirilmoqda ===');

    // getProduct
    const productRes = await window.app.api.request('getProduct', { limit: 10 });
    const products = productRes.result?.product || [];

    console.log('Products count:', products.length);
    if (products.length > 0) {
        console.log('First product:', JSON.stringify(products[0], null, 2));
        console.log('Keys:', Object.keys(products[0]));
    }

    // getPurchase detail
    const purchaseRes = await window.app.api.request('getPurchase', { limit: 5 });
    const purchases = purchaseRes.result?.warehouse || [];

    console.log('\nPurchases count:', purchases.length);
    if (purchases.length > 0 && purchases[0].detail?.length > 0) {
        console.log('First detail:', JSON.stringify(purchases[0].detail[0], null, 2));
        console.log('Detail keys:', Object.keys(purchases[0].detail[0]));
    }
})();
