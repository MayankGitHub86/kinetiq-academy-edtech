const { Client } = require('pg');

const client = new Client({
  user: 'postgres',
  password: '5515@',
  host: 'localhost',
  port: 5432,
  database: 'kinetiq_academy',
});

async function run() {
  await client.connect();
  const res = await client.query('SELECT * FROM courses LIMIT 1');
  console.log('Columns:', Object.keys(res.rows[0]));
  await client.end();
}
run();
