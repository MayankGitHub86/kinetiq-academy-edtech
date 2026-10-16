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
  const tables = [
    'users', 'profiles', 'courses', 'sections', 'lessons', 
    'enrollments', 'lesson_progress', 'reviews', 'orders', 
    'quiz_attempts', 'notifications', 'certificates', 
    'live_sessions', 'analytics_events'
  ];
  
  for (const t of tables) {
    const q = `
      ALTER TABLE ${t}
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
    `;
    try {
      await client.query(q);
      console.log('Added timestamps to', t);
    } catch(e) {
      console.log('Error for', t, ':', e.message);
    }
  }
  
  await client.end();
}
run();
