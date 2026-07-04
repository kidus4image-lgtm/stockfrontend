const fs = require('fs');
let code = fs.readFileSync('app/reports/page.tsx', 'utf8');
code = code.replace(/\\`/g, '`');
code = code.replace(/\\\$/g, '$');
fs.writeFileSync('app/reports/page.tsx', code);
