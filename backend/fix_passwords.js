const bcrypt = require('bcryptjs');
const { Client } = require('pg');

async function fixPasswords() {
  const client = new Client({ host:'localhost', port:5432, database:'kinetiq_academy', user:'postgres', password:'5515@' });
  await client.connect();

  const updates = [
    { email: 'admin@kinetiqacademy.com', pass: 'Admin@1234' },
    { email: 'instructor@kinetiqacademy.com', pass: 'Instructor@1234' },
    { email: 'student@kinetiqacademy.com', pass: 'Student@1234' },
  ];

  for (const u of updates) {
    const hash = await bcrypt.hash(u.pass, 12);
    await client.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, u.email]);
    console.log('Fixed password for:', u.email);
  }

  await client.end();
}

fixPasswords().catch(console.error);
