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
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS first_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS last_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255),
    ADD COLUMN IF NOT EXISTS bio TEXT,
    ADD COLUMN IF NOT EXISTS phone VARCHAR(255),
    ADD COLUMN IF NOT EXISTS timezone VARCHAR(255),
    ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'student',
    ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'local',
    ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255),
    ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255),
    ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS preferences JSONB,
    ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
  `;
  try {
    await client.query(alterQuery);
    console.log('Columns added successfully');
  } catch(e) {
    console.error('Error altering table:', e);
  }
  
  await client.end();
}
run();
