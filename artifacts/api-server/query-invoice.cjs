const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.gkezrzbxcsgpguqsfhkq:Starlord_098@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres' });
client.connect().then(async () => {
  const res = await client.query("SELECT * FROM sale_invoices WHERE invoice_number = 'INV-26-27-0138'");
  console.log(res.rows[0]);
  client.end();
});
