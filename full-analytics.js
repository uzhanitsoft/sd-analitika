const fetch = require('node-fetch');
const url = 'https://rafiq.salesdoc.io/api/v2/';
const auth = { userId: 'd0_67', token: '460e6b260534c4b7d005fea460d5feda' };

async function getAnalytics() {
    console.log('📊 TO\'LIQ ANALITIKA MA\'LUMOTLARI\n');
    console.log('='.repeat(60));

    // 1. TO'LOVLAR (PUL KIRIMI)
    console.log('\n💰 TO\'LOVLAR (getPayment):');
    console.log('-'.repeat(40));

    const payRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth, method: 'getPayment', params: {} })
    });
    const payData = await payRes.json();

    if (payData.result?.payment) {
        const payments = payData.result.payment;
        console.log(`Jami to'lovlar: ${payments.length}`);

        let totalPayments = 0;
        let todayPayments = 0;
        const today = new Date().toISOString().split('T')[0];

        payments.forEach(p => {
            const amount = p.amount || 0;
            totalPayments += amount;

            if (p.paymentDate && p.paymentDate.startsWith(today)) {
                todayPayments += amount;
            }
        });

        console.log(`Jami summa: ${totalPayments.toLocaleString()} so'm`);
        console.log(`Bugungi: ${todayPayments.toLocaleString()} so'm`);

        // Oxirgi 5 ta to'lov
        console.log('\nOxirgi 5 ta to\'lov:');
        payments.slice(0, 5).forEach(p => {
            console.log(`  ${p.paymentDate}: ${(p.amount || 0).toLocaleString()} so'm`);
        });
    }

    // 2. BALANSLAR (QARZDORLIK)
    console.log('\n\n📋 MIJOZLAR BALANSI (getBalance):');
    console.log('-'.repeat(40));

    const balRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth, method: 'getBalance', params: {} })
    });
    const balData = await balRes.json();

    if (balData.result?.balance) {
        const balances = balData.result.balance;
        console.log(`Jami mijozlar: ${balances.length}`);

        let totalDebt = 0;
        let debtors = 0;
        let creditors = 0;

        balances.forEach(b => {
            const bal = b.balance || 0;
            if (bal < 0) {
                totalDebt += Math.abs(bal);
                debtors++;
            } else if (bal > 0) {
                creditors++;
            }
        });

        console.log(`Qarzdor mijozlar: ${debtors}`);
        console.log(`Jami qarzdorlik: ${totalDebt.toLocaleString()} so'm`);
        console.log(`Oldindan to'lagan: ${creditors}`);

        // Top 5 qarzdorlar
        const topDebtors = balances
            .filter(b => b.balance < 0)
            .sort((a, b) => a.balance - b.balance)
            .slice(0, 5);

        if (topDebtors.length > 0) {
            console.log('\nTop 5 qarzdorlar:');
            topDebtors.forEach((d, i) => {
                console.log(`  ${i + 1}. ${d.name}: ${Math.abs(d.balance).toLocaleString()} so'm`);
            });
        }
    }

    // 3. BUYURTMALAR (SOTUV)
    console.log('\n\n🛒 SOTUVLAR (getOrder):');
    console.log('-'.repeat(40));

    const orderRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth, method: 'getOrder', params: {} })
    });
    const orderData = await orderRes.json();

    if (orderData.result?.order) {
        const orders = orderData.result.order;
        let totalSales = 0;
        orders.forEach(o => totalSales += o.totalSumma || 0);

        console.log(`Buyurtmalar: ${orders.length}`);
        console.log(`Jami sotuv: ${totalSales.toLocaleString()} so'm`);
    }

    // XULOSALAR
    console.log('\n\n' + '='.repeat(60));
    console.log('📈 XULOSA:');
    console.log('='.repeat(60));
    console.log('✅ Sotuvlar - mavjud');
    console.log('✅ To\'lovlar - mavjud');
    console.log('✅ Qarzdorlik - mavjud');
    console.log('❌ Xarajatlar - API da topilmadi');
    console.log('❌ Foyda - API da to\'g\'ridan-to\'g\'ri yo\'q (hisoblash kerak)');
}

getAnalytics().catch(console.error);
