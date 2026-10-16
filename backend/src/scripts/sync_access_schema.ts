import { sequelize } from '../config/database';
import { models } from '../models';

async function syncSchema() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database');

    // Safe column additions for learning_projects
    await sequelize.query(`
      ALTER TABLE learning_projects 
      ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS published_by UUID,
      ADD COLUMN IF NOT EXISTS publication_settings JSONB DEFAULT '{"publishNotes": true, "publishFlashcards": true, "publishQuiz": true, "publishPracticePaper": true, "publishVideo": true, "publishTutor": true, "allowDownload": true, "targetAudience": "assigned"}'::jsonb;
    `);
    console.log('✅ Added publication columns to learning_projects if not present');

    sequelize.addModels(models);
    await sequelize.sync({ force: false, alter: false });
    console.log('✅ Models synced successfully');

    process.exit(0);
  } catch (err) {
    console.error('❌ Schema sync error:', err);
    process.exit(1);
  }
}

syncSchema();
