var f = require('node-fetch');
f('http://localhost:3000/api/cache/agentDebts?currency=all')
    .then(function (r) { return r.json(); })
    .then(function (d) {
        console.log('Jami agentlar:', d.result.agents.length);
        // Maxmudov ni topish
        var maxmudov = d.result.agents.find(function (a) { return a.name.indexOf('Maxmudov') >= 0; });
        if (maxmudov) {
            console.log('\n=== Maxmudov Abdulazizxon ===');
            console.log('Mijozlar:', maxmudov.clientCount);
            console.log('Dollar:', maxmudov.totalDollar);
            // Wash Up 9-May ni izlash
            var washUp = maxmudov.clients.find(function (c) { return c.name.indexOf('Wash Up 9') >= 0; });
            if (washUp) {
                console.log('\nWash Up 9-May:');
                console.log('  Dollar:', washUp.dollarDebt);
                console.log('  SROK sana:', washUp.srokDate);
                console.log('  Kechikkan kun:', washUp.overdueDays);
                console.log('  Qolgan kun:', washUp.daysLeft);
                console.log('  Muddati otgan:', washUp.isOverdue);
            }
            // Wash Up Kosmonavt
            var washKosmo = maxmudov.clients.find(function (c) { return c.name.indexOf('Kosmonavt') >= 0; });
            if (washKosmo) {
                console.log('\nWash Up Kosmonavt:');
                console.log('  Dollar:', washKosmo.dollarDebt);
                console.log('  SROK sana:', washKosmo.srokDate);
                console.log('  Kechikkan kun:', washKosmo.overdueDays);
                console.log('  Muddati otgan:', washKosmo.isOverdue);
            }
            // Birinchi 5 ta mijoz srok bilan
            console.log('\nBirinchi 10 ta mijoz:');
            maxmudov.clients.slice(0, 10).forEach(function (c, i) {
                var srok = c.srokDate ? (c.isOverdue ? '-' + c.overdueDays + ' kun' : '+' + c.daysLeft + ' kun') : '-';
                console.log((i + 1) + '. ' + c.name.substring(0, 30) + ' $' + Math.abs(c.dollarDebt) + ' srok=' + c.srokDate + ' (' + srok + ')');
            });
        }
    })
    .catch(function (e) { console.log('Xato:', e.message); });
