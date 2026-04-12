// Browser console'da Sales API va Stock API ni tekshirish
// Tan narxi (costPrice, tanNarx, priceIn) mavjudligini tekshirish

// 1. getSales - sotuvlar
window.app?.api?.request('getSales', { page: 1, limit: 1 }).then(r => {
    console.log('=== SALES ===');
    const sale = r?.result?.sale?.[0];
    console.log('Sale keys:', Object.keys(sale || {}));
    console.log('Sale item:', sale);
    if (sale?.items) {
        console.log('Sale item keys:', Object.keys(sale.items[0] || {}));
    }
});

// 2. getStock - ombor
window.app?.api?.request('getStock', { page: 1, limit: 1 }).then(r => {
    console.log('=== STOCK ===');
    const stock = r?.result?.stock?.[0];
    console.log('Stock keys:', Object.keys(stock || {}));
    console.log('Stock:', stock);
});

// 3. getProduct batafsil
window.app?.api?.request('getProduct', { page: 1, limit: 1 }).then(r => {
    console.log('=== PRODUCT FULL ===');
    const p = r?.result?.product?.[0];
    console.log('Full product:', p);
});
