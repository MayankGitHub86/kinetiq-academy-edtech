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
  const alterQuery = `
    ALTER TABLE courses 
    ADD COLUMN IF NOT EXISTS instructor_id UUID,
    ADD COLUMN IF NOT EXISTS short_description TEXT,
    ADD COLUMN IF NOT EXISTS thumbnail_url VARCHAR(255),
    ADD COLUMN IF NOT EXISTS preview_video_url VARCHAR(255),
    ADD COLUMN IF NOT EXISTS original_price DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS is_free BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS total_duration_minutes INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_lessons INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_enrollments INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS avg_rating DECIMAL(3,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_reviews INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS learning_objectives JSONB,
    ADD COLUMN IF NOT EXISTS target_audience JSONB,
    ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS has_certificate BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
  `;
  try {
    await client.query(alterQuery);
    console.log('Columns added successfully');
    
    // Now we also need to make sure instructor_id references users.id if users table exists
    // We can just leave it as a loose UUID for now to prevent foreign key errors during sync if data doesn't match
  } catch(e) {
    console.error('Error altering table:', e);
  }
  
  await client.end();
}
run();
