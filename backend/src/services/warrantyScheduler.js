import cron from 'node-cron';
import { checkExpiredWarranties, checkExpiringWarranties } from './warrantyChecker.js';
import { checkOverdueMaintenanceAlerts } from './assetHealthService.js';

/**
 * Initialize cron jobs for warranty checks and maintenance monitoring
 */
export function initWarrantyCronJobs() {
  // Run expired warranty check daily at 9 AM
  cron.schedule('0 9 * * *', async () => {
    console.log('Running daily expired warranty check...');
    const result = await checkExpiredWarranties();
    console.log('Expired warranty check completed:', result);
  }, {
    timezone: 'Asia/Kolkata' // Adjust to your timezone
  });

  // Run expiring soon check weekly on Monday at 9 AM
  cron.schedule('0 9 * * 1', async () => {
    console.log('Running weekly expiring soon warranty check...');
    const result = await checkExpiringWarranties();
    console.log('Expiring soon warranty check completed:', result);
  }, {
    timezone: 'Asia/Kolkata' // Adjust to your timezone
  });

  // Check for overdue maintenance daily at 10 AM
  cron.schedule('0 10 * * *', async () => {
    console.log('Running daily overdue maintenance check...');
    const result = await checkOverdueMaintenanceAlerts();
    console.log('Overdue maintenance check completed:', result);
  }, {
    timezone: 'Asia/Kolkata' // Adjust to your timezone
  });

  console.log('✅ Cron jobs initialized');
  console.log('  - Warranty expired check: Daily at 9:00 AM');
  console.log('  - Warranty expiring soon check: Weekly (Monday) at 9:00 AM');
  console.log('  - Overdue maintenance check: Daily at 10:00 AM');
}

