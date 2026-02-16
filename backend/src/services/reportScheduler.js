import cron from 'node-cron';
import reportGenerator from './reportGenerator.js';
import { Organization } from '../models/index.js';

export class ReportSchedulerService {

  startScheduledJobs() {
    // Daily report - Every day at 11:59 PM
    cron.schedule('59 23 * * *', async () => {
      console.log('Running scheduled daily reports generation...');
      try {
        await this.generateDailyReportsForAllOrgs();
        console.log('Daily reports generated successfully');
      } catch (error) {
        console.error('Error generating daily reports:', error);
      }
    }, {
      timezone: 'Asia/Kolkata'
    });

    // Weekly report - Every Sunday at 11:59 PM
    cron.schedule('59 23 * * 0', async () => {
      console.log('Running scheduled weekly reports generation...');
      try {
        await this.generateWeeklyReportsForAllOrgs();
        console.log('Weekly reports generated successfully');
      } catch (error) {
        console.error('Error generating weekly reports:', error);
      }
    }, {
      timezone: 'Asia/Kolkata'
    });

    // Monthly report - Last day of month at 11:59 PM
    cron.schedule('59 23 28-31 * *', async () => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Check if tomorrow is first day of next month
      if (tomorrow.getDate() === 1) {
        console.log('Running scheduled monthly reports generation...');
        try {
          await this.generateMonthlyReportsForAllOrgs();
          console.log('Monthly reports generated successfully');
        } catch (error) {
          console.error('Error generating monthly reports:', error);
        }
      }
    }, {
      timezone: 'Asia/Kolkata'
    });

    console.log('✅ Report scheduler initialized');
    console.log('  - Daily reports: Every day at 11:59 PM');
    console.log('  - Weekly reports: Every Sunday at 11:59 PM');
    console.log('  - Monthly reports: Last day of month at 11:59 PM');
  }

  async generateDailyReportsForAllOrgs() {
    const organizations = await Organization.find().lean();

    for (const org of organizations) {
      try {
        await reportGenerator.generateDailyReport(org._id);
        console.log(`Daily report generated for organization: ${org.name}`);
      } catch (error) {
        console.error(`Error generating daily report for ${org.name}:`, error);
      }
    }
  }

  async generateWeeklyReportsForAllOrgs() {
    const organizations = await Organization.find().lean();

    for (const org of organizations) {
      try {
        await reportGenerator.generateWeeklyReport(org._id);
        console.log(`Weekly report generated for organization: ${org.name}`);
      } catch (error) {
        console.error(`Error generating weekly report for ${org.name}:`, error);
      }
    }
  }

  async generateMonthlyReportsForAllOrgs() {
    const organizations = await Organization.find().lean();

    for (const org of organizations) {
      try {
        await reportGenerator.generateMonthlyReport(org._id);
        console.log(`Monthly report generated for organization: ${org.name}`);
      } catch (error) {
        console.error(`Error generating monthly report for ${org.name}:`, error);
      }
    }
  }
}

export default new ReportSchedulerService();

