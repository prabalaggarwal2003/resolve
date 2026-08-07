import app from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { initWarrantyCronJobs } from './services/warrantyScheduler.js';
import { migrateVendorsToBusinessPartners } from './services/businessPartnerMigration.js';

connectDB()
  .then(async () => {
    try {
      await migrateVendorsToBusinessPartners();
    } catch (err) {
      console.error('Partners migration failed (non-fatal):', err.message);
    }

    app.listen(env.port, () => {
      console.log(`Server running on http://localhost:${env.port}`);

      // Initialize warranty check cron jobs
      initWarrantyCronJobs();
    });
  })
  .catch((err) => {
    console.error('Failed to start:', err);
    process.exit(1);
  });
