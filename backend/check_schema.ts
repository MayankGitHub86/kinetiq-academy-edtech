import { sequelize } from './src/config/database';
import { models } from './src/models';

async function checkSchema() {
  sequelize.addModels(models);
  try {
    await sequelize.authenticate();
    console.log('DB connected');
    const queryInterface = sequelize.getQueryInterface();
    const columns = await queryInterface.describeTable('courses');
    console.log(Object.keys(columns));
    
    // Force alter to ensure columns exist
    await sequelize.sync({ alter: true });
    console.log('Sync complete');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkSchema();
