const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'pivot (18).xlsx');
const wb = XLSX.readFile(filePath);
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws);

// Maxmudov qatorlarini topish
const maxRows = data.filter(r => {
    const agent = r['Агент'] || '';
    return agent.includes('Maxmudov') || agent.includes('Abdulaziz');
});

console.log('Maxmudov qatorlari:', maxRows.length);
if (maxRows.length > 0) {
    console.log('Agent ID:', maxRows[0]['ИД агента']);
    console.log('Agent nomi:', maxRows[0]['Агент']);
}

// Barcha agentlar va ID lari
console.log('\n===== BARCHA AGENTLAR =====');
const agents = {};
data.forEach(r => {
    const id = r['ИД агента'];
    const name = r['Агент'];
    if (id && !agents[id]) {
        agents[id] = name;
    }
});

Object.entries(agents).sort((a, b) => a[0].localeCompare(b[0])).forEach(([id, name]) => {
    console.log(`${id}: ${name}`);
});
