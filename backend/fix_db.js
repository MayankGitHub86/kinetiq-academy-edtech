/**
 * fix_db.js - Restore all missing columns to the kinetiq_academy database
 * Run with: node fix_db.js
 */

const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'kinetiq_academy',
  user: 'postgres',
  password: '5515@',
});

async function fix() {
  await client.connect();
  console.log('✅ Connected to PostgreSQL');

  const alterStatements = [
    // users table - restore dropped columns
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(255)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(255)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'local'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN DEFAULT false`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMP`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`,

    // user_profiles table
    `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id)`,
    `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS first_name VARCHAR(255)`,
    `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_name VARCHAR(255)`,
    `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS display_name VARCHAR(255)`,
    `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255)`,
    `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE`,
    `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`,
    `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`,
    `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`,

    // onboarding_data table
    `ALTER TABLE onboarding_data ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id)`,
    `ALTER TABLE onboarding_data ADD COLUMN IF NOT EXISTS selected_interests JSONB DEFAULT '[]'`,
    `ALTER TABLE onboarding_data ADD COLUMN IF NOT EXISTS experience_level VARCHAR(50)`,
    `ALTER TABLE onboarding_data ADD COLUMN IF NOT EXISTS learning_goals JSONB DEFAULT '[]'`,
    `ALTER TABLE onboarding_data ADD COLUMN IF NOT EXISTS daily_learning_target_minutes INTEGER DEFAULT 30`,
    `ALTER TABLE onboarding_data ADD COLUMN IF NOT EXISTS preferred_learning_format VARCHAR(50)`,
    `ALTER TABLE onboarding_data ADD COLUMN IF NOT EXISTS completed_status BOOLEAN DEFAULT false`,
    `ALTER TABLE onboarding_data ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`,
    `ALTER TABLE onboarding_data ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`,
    `ALTER TABLE onboarding_data ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`,

    // courses table
    `ALTER TABLE courses ADD COLUMN IF NOT EXISTS short_description TEXT`,
    `ALTER TABLE courses ADD COLUMN IF NOT EXISTS instructor_id UUID REFERENCES users(id)`,
    `ALTER TABLE courses ADD COLUMN IF NOT EXISTS thumbnail_url VARCHAR(255)`,
    `ALTER TABLE courses ADD COLUMN IF NOT EXISTS preview_video_url VARCHAR(255)`,
    `ALTER TABLE courses ADD COLUMN IF NOT EXISTS original_price DECIMAL(10,2)`,
    `ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_free BOOLEAN DEFAULT false`,
    `ALTER TABLE courses ADD COLUMN IF NOT EXISTS total_duration_minutes INTEGER DEFAULT 0`,
    `ALTER TABLE courses ADD COLUMN IF NOT EXISTS total_lessons INTEGER DEFAULT 0`,
    `ALTER TABLE courses ADD COLUMN IF NOT EXISTS total_enrollments INTEGER DEFAULT 0`,
    `ALTER TABLE courses ADD COLUMN IF NOT EXISTS avg_rating DECIMAL(3,2) DEFAULT 0`,
    `ALTER TABLE courses ADD COLUMN IF NOT EXISTS total_reviews INTEGER DEFAULT 0`,
    `ALTER TABLE courses ADD COLUMN IF NOT EXISTS learning_objectives JSONB`,
    `ALTER TABLE courses ADD COLUMN IF NOT EXISTS target_audience JSONB`,
    `ALTER TABLE courses ADD COLUMN IF NOT EXISTS published_at TIMESTAMP`,
    `ALTER TABLE courses ADD COLUMN IF NOT EXISTS has_certificate BOOLEAN DEFAULT false`,
    `ALTER TABLE courses ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`,
    `ALTER TABLE courses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`,
    `ALTER TABLE courses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`,

    // sections table
    `ALTER TABLE sections ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id)`,
    `ALTER TABLE sections ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0`,
    `ALTER TABLE sections ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT true`,
    `ALTER TABLE sections ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`,
    `ALTER TABLE sections ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`,
    `ALTER TABLE sections ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`,

    // lessons table
    `ALTER TABLE lessons ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES sections(id)`,
    `ALTER TABLE lessons ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id)`,
    `ALTER TABLE lessons ADD COLUMN IF NOT EXISTS video_url VARCHAR(500)`,
    `ALTER TABLE lessons ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 0`,
    `ALTER TABLE lessons ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0`,
    `ALTER TABLE lessons ADD COLUMN IF NOT EXISTS is_free BOOLEAN DEFAULT false`,
    `ALTER TABLE lessons ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT true`,
    `ALTER TABLE lessons ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`,
    `ALTER TABLE lessons ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`,
    `ALTER TABLE lessons ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`,

    // enrollments table
    `ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id)`,
    `ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id)`,
    `ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS progress_percent DECIMAL(5,2) DEFAULT 0`,
    `ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP`,
    `ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS last_lesson_id UUID`,
    `ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`,
    `ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`,
    `ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`,
    `ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`,

    // lesson_progress table
    `ALTER TABLE lesson_progress ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id)`,
    `ALTER TABLE lesson_progress ADD COLUMN IF NOT EXISTS lesson_id UUID REFERENCES lessons(id)`,
    `ALTER TABLE lesson_progress ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id)`,
    `ALTER TABLE lesson_progress ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT false`,
    `ALTER TABLE lesson_progress ADD COLUMN IF NOT EXISTS watched_seconds INTEGER DEFAULT 0`,
    `ALTER TABLE lesson_progress ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP`,
    `ALTER TABLE lesson_progress ADD COLUMN IF NOT EXISTS playback_position INTEGER DEFAULT 0`,
    `ALTER TABLE lesson_progress ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`,
    `ALTER TABLE lesson_progress ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`,
    `ALTER TABLE lesson_progress ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`,

    // reviews table
    `ALTER TABLE reviews ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id)`,
    `ALTER TABLE reviews ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id)`,
    `ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT true`,
    `ALTER TABLE reviews ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`,
    `ALTER TABLE reviews ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`,
    `ALTER TABLE reviews ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`,
  ];

  let fixed = 0;
  for (const sql of alterStatements) {
    try {
      await client.query(sql);
      fixed++;
    } catch (e) {
      console.warn(`⚠️  Skipped: ${sql.slice(0, 80)}... => ${e.message}`);
    }
  }

  console.log(`✅ Applied ${fixed}/${alterStatements.length} fix statements`);
  await client.end();
}

fix().catch(e => {
  console.error('❌ Fix failed:', e.message);
  client.end();
  process.exit(1);
});
