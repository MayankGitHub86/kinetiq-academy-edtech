const { Client } = require('pg');
const client = new Client({ host:'localhost', port:5432, database:'kinetiq_academy', user:'postgres', password:'5515@' });

async function fix() {
  await client.connect();
  const tables = ['users','user_profiles','onboarding_data','courses','sections','lessons','enrollments','lesson_progress','reviews'];
  for (const t of tables) {
    try {
      await client.query(`UPDATE ${t} SET created_at = NOW() WHERE created_at IS NULL`);
      await client.query(`UPDATE ${t} SET updated_at = NOW() WHERE updated_at IS NULL`);
      console.log('Fixed timestamps for:', t);
    } catch(e) { console.log('Skip', t, ':', e.message); }
  }
  await client.end();
  console.log('Done!');
}

fix().catch(e => { console.error(e.message); process.exit(1); });
