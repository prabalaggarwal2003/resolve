import { Report, Issue, Asset } from '../models/index.js';

export class ReportGeneratorService {

  async generateDailyReport(organizationId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.generateReport('daily', organizationId, today, tomorrow);
  }

  async generateWeeklyReport(organizationId) {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    return this.generateReport('weekly', organizationId, weekStart, today);
  }

  async generateMonthlyReport(organizationId) {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    return this.generateReport('monthly', organizationId, monthStart, today);
  }

  async generateReport(type, organizationId, startDate, endDate) {
    try {
      // Gather data - get issues with basic info
      const issues = await Issue.find({
        organizationId,
        createdAt: { $gte: startDate, $lt: endDate }
      }).lean();

      // Manually populate assetId with departmentId and locationId
      for (let i = 0; i < issues.length; i++) {
        if (issues[i].assetId) {
          const asset = await Asset.findById(issues[i].assetId)
            .populate('departmentId', 'name')
            .populate('locationId', 'name')
            .lean();
          issues[i].assetId = asset;
        }
      }

      // Calculate summary statistics
      const summary = await this.calculateSummary(issues, organizationId);
      const insights = await this.calculateInsights(issues, startDate, type, organizationId);

      // Create report
      const report = await Report.create({
        organizationId,
        reportType: type,
        period: { start: startDate, end: endDate },
        summary,
        insights,
        generatedBy: 'manual',
        status: 'completed'
      });

      return report;

    } catch (error) {
      console.error(`Error generating ${type} report:`, error);
      throw error;
    }
  }

  async calculateSummary(issues, organizationId) {
    // Most reported assets
    const assetCounts = new Map();
    issues.forEach(issue => {
      if (issue.assetId) {
        const key = issue.assetId._id.toString();
        if (!assetCounts.has(key)) {
          assetCounts.set(key, {
            assetId: key,
            assetName: issue.assetId.name,
            assetTag: issue.assetId.assetId,
            issueCount: 0
          });
        }
        assetCounts.get(key).issueCount++;
      }
    });

    // Most reported locations
    const locationCounts = new Map();
    issues.forEach(issue => {
      // Check if assetId exists and has locationId
      const location = issue.assetId?.locationId;
      if (location && location._id && location.name) {
        const key = location._id.toString();
        if (!locationCounts.has(key)) {
          locationCounts.set(key, {
            locationId: key,
            locationName: location.name,
            issueCount: 0
          });
        }
        locationCounts.get(key).issueCount++;
      }
    });

    // Most reported departments
    const departmentCounts = new Map();
    issues.forEach(issue => {
      // Check if assetId exists and has departmentId
      const dept = issue.assetId?.departmentId;
      if (dept) {
        const key = dept._id ? dept._id.toString() : 'unknown';
        const name = dept.name || 'Unknown Department';
        if (!departmentCounts.has(key)) {
          departmentCounts.set(key, {
            departmentId: key,
            departmentName: name,
            issueCount: 0
          });
        }
        departmentCounts.get(key).issueCount++;
      }
    });

    // Issues by category
    const categoryMap = new Map();
    issues.forEach(issue => {
      const category = issue.category || 'Uncategorized';
      categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
    });

    // Issues by status
    const statusCounts = {
      open: issues.filter(i => i.status === 'open').length,
      in_progress: issues.filter(i => i.status === 'in_progress').length,
      completed: issues.filter(i => i.status === 'completed').length,
      cancelled: issues.filter(i => i.status === 'cancelled').length
    };

    // Get unique assets affected
    const uniqueAssets = new Set(issues.map(i => i.assetId?._id?.toString()).filter(Boolean));

    return {
      totalIssuesReported: issues.length,
      totalAssetsAffected: uniqueAssets.size,
      mostReportedAssets: Array.from(assetCounts.values())
        .sort((a, b) => b.issueCount - a.issueCount)
        .slice(0, 10),
      mostReportedLocations: Array.from(locationCounts.values())
        .sort((a, b) => b.issueCount - a.issueCount)
        .slice(0, 10),
      issuesByCategory: Array.from(categoryMap.entries()).map(([category, count]) => ({
        category,
        count
      })),
      issuesByStatus: statusCounts,
      topDepartmentIssues: Array.from(departmentCounts.values())
        .sort((a, b) => b.issueCount - a.issueCount)
        .slice(0, 10)
    };
  }

  async calculateInsights(issues, startDate, type, organizationId) {
    // Critical assets (high issue frequency)
    const assetIssues = new Map();
    issues.forEach(issue => {
      if (issue.assetId) {
        const key = issue.assetId._id.toString();
        if (!assetIssues.has(key)) {
          assetIssues.set(key, []);
        }
        assetIssues.get(key).push(issue);
      }
    });

    const criticalAssets = Array.from(assetIssues.entries())
      .filter(([_, assetIssueList]) => assetIssueList.length >= 3)
      .map(([assetId, assetIssueList]) => {
        const completedIssues = assetIssueList.filter(i => i.status === 'completed' && i.updatedAt);
        const avgResolution = completedIssues.length > 0
          ? completedIssues.reduce((sum, i) =>
              sum + (new Date(i.updatedAt).getTime() - new Date(i.createdAt).getTime()),
              0) / completedIssues.length / (1000 * 60 * 60) // hours
          : 0;

        return {
          assetId,
          assetName: assetIssueList[0].assetId.name,
          issueCount: assetIssueList.length,
          avgResolutionTime: Math.round(avgResolution * 10) / 10
        };
      })
      .sort((a, b) => b.issueCount - a.issueCount)
      .slice(0, 5);

    // Performance metrics
    const completedIssues = issues.filter(i => i.status === 'completed' && i.updatedAt);
    const avgResolutionTime = completedIssues.length > 0
      ? completedIssues.reduce((sum, i) =>
          sum + (new Date(i.updatedAt).getTime() - new Date(i.createdAt).getTime()),
          0) / completedIssues.length / (1000 * 60 * 60)
      : 0;

    const resolutionRate = issues.length > 0
      ? (completedIssues.length / issues.length) * 100
      : 0;

    // Get previous period for trends
    const previousPeriod = await this.getPreviousPeriodData(startDate, type, organizationId);

    // High risk locations (locations with > 5 issues)
    const locationIssues = new Map();
    issues.forEach(issue => {
      const location = issue.assetId?.locationId;
      if (location && location.name) {
        const key = location.name;
        locationIssues.set(key, (locationIssues.get(key) || 0) + 1);
      }
    });
    const highRiskLocations = Array.from(locationIssues.entries())
      .filter(([_, count]) => count > 5)
      .map(([name, _]) => name);

    return {
      criticalAssets,
      performanceMetrics: {
        avgResolutionTime: Math.round(avgResolutionTime * 10) / 10,
        avgResponseTime: 0,
        resolutionRate: Math.round(resolutionRate * 10) / 10
      },
      trends: {
        issuesVsPreviousPeriod: previousPeriod.issueCount > 0
          ? Math.round(((issues.length - previousPeriod.issueCount) / previousPeriod.issueCount) * 100)
          : issues.length > 0 ? 100 : 0,
        resolutionTimeVsPrevious: 0,
        highRiskLocations
      }
    };
  }

  async getPreviousPeriodData(startDate, type, organizationId) {
    let previousStart;
    let previousEnd = new Date(startDate);

    if (type === 'daily') {
      previousStart = new Date(startDate);
      previousStart.setDate(previousStart.getDate() - 1);
    } else if (type === 'weekly') {
      previousStart = new Date(startDate);
      previousStart.setDate(previousStart.getDate() - 7);
    } else {
      previousStart = new Date(startDate);
      previousStart.setMonth(previousStart.getMonth() - 1);
    }

    const issueCount = await Issue.countDocuments({
      organizationId,
      createdAt: { $gte: previousStart, $lt: previousEnd }
    });

    return { issueCount };
  }

  async getReports(organizationId, type = null, limit = 20) {
    const query = { organizationId };
    if (type) {
      query.reportType = type;
    }

    const reports = await Report.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return reports;
  }

  async getReportById(reportId, organizationId) {
    const report = await Report.findOne({
      _id: reportId,
      organizationId
    }).lean();

    return report;
  }
}

export default new ReportGeneratorService();







