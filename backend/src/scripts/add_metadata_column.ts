import 'dotenv/config';
import { sequelize } from '../config/database';

async function main() {
  try {
    await sequelize.authenticate();
    console.log('Postgres connected');
    await sequelize.query('ALTER TABLE "learning_projects" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT \'{}\'::jsonb;');
    await sequelize.query('ALTER TABLE "flashcards" ADD COLUMN IF NOT EXISTS "topic" VARCHAR(255);');
    console.log('✅ Added metadata and topic columns');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

main();
