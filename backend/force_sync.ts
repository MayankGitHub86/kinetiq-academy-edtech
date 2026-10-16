import { sequelize } from './src/config/database';
import { models } from './src/models';

async function forceSync() {
  sequelize.addModels(models);
  try {
    await sequelize.authenticate();
    console.log('DB connected');
    
    // Attempt alter sync with full logging
    await sequelize.sync({ alter: true, logging: console.log });
    console.log('Sync complete');
    process.exit(0);
  } catch (error) {
    console.error('SYNC ERROR:', error);
    process.exit(1);
  }
}

forceSync();
