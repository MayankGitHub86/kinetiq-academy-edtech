const { Client } = require('pg');
const client = new Client({ host:'localhost', port:5432, database:'kinetiq_academy', user:'postgres', password:'5515@' });

async function fix() {
  await client.connect();
  
  // Get instructor user ID
  const instrRes = await client.query("SELECT id FROM users WHERE role='instructor' LIMIT 1");
  if (instrRes.rows.length === 0) {
    console.log('No instructor found');
    await client.end();
    return;
  }
  const instructorId = instrRes.rows[0].id;
  console.log('Instructor ID:', instructorId);
  
  // Assign instructor to all courses that don't have one
  const res = await client.query('UPDATE courses SET instructor_id = $1 WHERE instructor_id IS NULL RETURNING title', [instructorId]);
  console.log('Updated courses:', res.rows.map(r => r.title));
  
  await client.end();
}

fix().catch(console.error);
