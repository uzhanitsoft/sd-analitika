// Browser console'da ishlatish uchun:
// Buyurtma mahsulotlarini tekshirish - tan narxi bormi?

const order = window.app?.cachedOrders?.[0];
if (order) {
    console.log('Order:', order);
    const item = order.orderProducts?.[0];
    if (item) {
        console.log('Order item keys:', Object.keys(item));
        console.log('Order item:', item);
        console.log('Product:', item.product);
        console.log('Product keys:', Object.keys(item.product || {}));

        // Tan narxi
        console.log('singleTanNarx:', item.singleTanNarx);
        console.log('costPrice:', item.costPrice);
        console.log('tanNarx:', item.tanNarx);
        console.log('product.tanNarx:', item.product?.tanNarx);
        console.log('product.costPrice:', item.product?.costPrice);
    }
}
