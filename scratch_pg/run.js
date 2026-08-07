const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.gkezrzbxcsgpguqsfhkq:Starlord_098@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres' });
client.connect().then(() => {
  return client.query(`
    INSERT INTO ledgers (name, "group", nature, opening_balance, is_system, is_deleted)
    SELECT 'Round Off', 'Indirect Expenses', 'dr', '0', 'true', 'false'
    WHERE NOT EXISTS (SELECT 1 FROM ledgers WHERE name = 'Round Off' AND is_deleted = 'false')
  `);
}).then(res => {
  console.log("Inserted?", res.rowCount);
  process.exit();
}).catch(console.error);
