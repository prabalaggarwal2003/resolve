import express from 'express';
import { protect } from '../middleware/auth.js';
import reportGenerator from '../services/reportGenerator.js';

const router = express.Router();

router.use(protect);

// Get all reports for organization
router.get('/', async (req, res) => {
  try {
    const { type, limit } = req.query;
    const reports = await reportGenerator.getReports(
      req.user.organizationId,
      type,
      parseInt(limit) || 20
    );
    res.json({ reports });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get single report by ID
router.get('/:id', async (req, res) => {
  try {
    const report = await reportGenerator.getReportById(
      req.params.id,
      req.user.organizationId
    );

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    res.json({ report });
  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({ message: error.message });
  }
});

// Generate daily report manually
router.post('/generate/daily', async (req, res) => {
  try {
    const report = await reportGenerator.generateDailyReport(req.user.organizationId);
    res.json({ report, message: 'Daily report generated successfully' });
  } catch (error) {
    console.error('Error generating daily report:', error);
    res.status(500).json({ message: error.message });
  }
});

// Generate weekly report manually
router.post('/generate/weekly', async (req, res) => {
  try {
    const report = await reportGenerator.generateWeeklyReport(req.user.organizationId);
    res.json({ report, message: 'Weekly report generated successfully' });
  } catch (error) {
    console.error('Error generating weekly report:', error);
    res.status(500).json({ message: error.message });
  }
});

// Generate monthly report manually
router.post('/generate/monthly', async (req, res) => {
  try {
    const report = await reportGenerator.generateMonthlyReport(req.user.organizationId);
    res.json({ report, message: 'Monthly report generated successfully' });
  } catch (error) {
    console.error('Error generating monthly report:', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;

