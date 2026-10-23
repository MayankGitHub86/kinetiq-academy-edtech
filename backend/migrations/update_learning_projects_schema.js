const { Client } = require('pg');

async function main() {
  const c = new Client({ user: 'postgres', password: '5515@', host: 'localhost', port: 5432, database: 'kinetiq_academy' });
  await c.connect();

  const res = await c.query("SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'enum_learning_projects_status'");
  const current = res.rows.map(r => r.enumlabel);
  console.log('Current enum labels:', current);

  const needed = ['processing', 'review_required', 'approved', 'published', 'archived'];
  for (const label of needed) {
    if (!current.includes(label)) {
      try {
        await c.query(`ALTER TYPE "enum_learning_projects_status" ADD VALUE IF NOT EXISTS '${label}'`);
        console.log(`Added enum value: ${label}`);
      } catch (err) {
        console.warn(`Could not add enum value ${label}:`, err.message);
      }
    }
  }

  // Also check if columns exist on learning_projects
  const colRes = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'learning_projects'");
  const existingCols = colRes.rows.map(r => r.column_name);
  console.log('Existing columns:', existingCols);

  const newCols = [
    { name: 'category', type: 'VARCHAR(255)' },
    { name: 'target_level', type: 'VARCHAR(100)' },
    { name: 'language', type: 'VARCHAR(100)' },
    { name: 'difficulty', type: 'VARCHAR(100)' },
    { name: 'learning_objectives', type: 'JSONB' },
    { name: 'prerequisites', type: 'JSONB' },
    { name: 'target_audience', type: 'JSONB' },
    { name: 'estimated_duration_minutes', type: 'INTEGER' },
    { name: 'thumbnail_url', type: 'VARCHAR(500)' },
  ];

  for (const col of newCols) {
    if (!existingCols.includes(col.name)) {
      await c.query(`ALTER TABLE learning_projects ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type}`);
      console.log(`Added column ${col.name}`);
    }
  }

  await c.end();
  console.log('Migration complete.');
}

main().catch(console.error);
