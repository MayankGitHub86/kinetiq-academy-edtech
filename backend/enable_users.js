const { Client } = require('pg');
const client = new Client({ host:'localhost', port:5432, database:'kinetiq_academy', user:'postgres', password:'5515@' });

async function fix() {
  await client.connect();
  // Enable all users and verify their emails
  const res = await client.query(`UPDATE users SET is_active = true, is_email_verified = true WHERE is_active = false OR is_email_verified = false RETURNING email`);
  console.log('Enabled users:', res.rows.map(r => r.email));
  // Check current users
  const users = await client.query('SELECT email, role, is_active, is_email_verified FROM users');
  console.log('All users:', JSON.stringify(users.rows));
  await client.end();
}

fix().catch(e => { console.error(e.message); process.exit(1); });
