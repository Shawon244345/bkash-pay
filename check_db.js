const Database = require('better-sqlite3');
const db = new Database('database.sqlite');
const info = db.prepare("PRAGMA table_info(refunds)").all();
console.log(JSON.stringify(info, null, 2));
db.close();
