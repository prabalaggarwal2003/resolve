import { Asset, Issue, User } from '../models/index.js';
import mongoose from 'mongoose';

/**
 * Get comprehensive KPIs and metrics for an organization
 */
export async function getOrganizationKPIs(organizationId) {
  try {
    const orgId = new mongoose.Types.ObjectId(organizationId);

    // 1. Asset Status Distribution
    const statusDistribution = await Asset.aggregate([
      { $match: { organizationId: orgId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalValue: { $sum: '$cost' }
        }
      }
    ]);

    // 2. Asset Condition Distribution
    const conditionDistribution = await Asset.aggregate([
      { $match: { organizationId: orgId } },
      {
        $group: {
          _id: '$condition',
          count: { $sum: 1 }
        }
      }
    ]);

    // 3. Category Distribution
    const categoryDistribution = await Asset.aggregate([
      { $match: { organizationId: orgId } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalValue: { $sum: '$cost' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // 4. Total Assets and Financial Metrics
    const financialMetrics = await Asset.aggregate([
      { $match: { organizationId: orgId } },
      {
        $group: {
          _id: null,
          totalAssets: { $sum: 1 },
          totalValue: { $sum: '$cost' },
          averageValue: { $avg: '$cost' },
          maxValue: { $max: '$cost' },
          minValue: { $min: '$cost' }
        }
      }
    ]);

    // 5. Warranty Status
    const now = new Date();
    const [warrantyActive, warrantyExpired, noWarranty] = await Promise.all([
      Asset.countDocuments({
        organizationId: orgId,
        warrantyExpiry: { $gte: now }
      }),
      Asset.countDocuments({
        organizationId: orgId,
        warrantyExpiry: { $lt: now }
      }),
      Asset.countDocuments({
        organizationId: orgId,
        warrantyExpiry: { $exists: false }
      })
    ]);

    // 6. Assignment Status
    const [assignedAssets, unassignedAssets] = await Promise.all([
      Asset.countDocuments({
        organizationId: orgId,
        assignedTo: { $exists: true, $ne: null }
      }),
      Asset.countDocuments({
        organizationId: orgId,
        $or: [
          { assignedTo: { $exists: false } },
          { assignedTo: null }
        ]
      })
    ]);

    // 7. Issue Metrics
    const issueMetrics = await Issue.aggregate([
      {
        $lookup: {
          from: 'assets',
          localField: 'assetId',
          foreignField: '_id',
          as: 'asset'
        }
      },
      { $unwind: '$asset' },
      { $match: { 'asset.organizationId': orgId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // 8. Asset Age Distribution
    const assetAgeDistribution = await Asset.aggregate([
      { $match: { organizationId: orgId, purchaseDate: { $exists: true } } },
      {
        $project: {
          age: {
            $divide: [
              { $subtract: [now, '$purchaseDate'] },
              1000 * 60 * 60 * 24 * 365.25
            ]
          }
        }
      },
      {
        $bucket: {
          groupBy: '$age',
          boundaries: [0, 1, 2, 3, 5, 100],
          default: 'Unknown',
          output: {
            count: { $sum: 1 }
          }
        }
      }
    ]);

    // 9. Location Distribution (Top 10)
    const locationDistribution = await Asset.aggregate([
      { $match: { organizationId: orgId, locationId: { $exists: true } } },
      {
        $group: {
          _id: '$locationId',
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'locations',
          localField: '_id',
          foreignField: '_id',
          as: 'location'
        }
      },
      { $unwind: '$location' },
      {
        $project: {
          name: '$location.name',
          path: '$location.path',
          count: 1
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // 10. Department Distribution
    const departmentDistribution = await Asset.aggregate([
      { $match: { organizationId: orgId, departmentId: { $exists: true } } },
      {
        $group: {
          _id: '$departmentId',
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'departments',
          localField: '_id',
          foreignField: '_id',
          as: 'department'
        }
      },
      { $unwind: '$department' },
      {
        $project: {
          name: '$department.name',
          count: 1
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Calculate percentages and format data
    const totalAssets = financialMetrics[0]?.totalAssets || 0;
    const totalValue = financialMetrics[0]?.totalValue || 0;

    // Format status distribution
    const statusMap = {
      available: { count: 0, value: 0 },
      in_use: { count: 0, value: 0 },
      under_maintenance: { count: 0, value: 0 },
      retired: { count: 0, value: 0 },
      working: { count: 0, value: 0 },
      needs_repair: { count: 0, value: 0 },
      out_of_service: { count: 0, value: 0 }
    };

    statusDistribution.forEach(item => {
      const status = item._id || 'available';
      statusMap[status] = {
        count: item.count,
        value: item.totalValue || 0,
        percentage: totalAssets > 0 ? (item.count / totalAssets) * 100 : 0
      };
    });

    // Format condition distribution
    const conditionMap = {
      excellent: 0,
      good: 0,
      fair: 0,
      poor: 0,
      critical: 0,
      under_maintenance: 0
    };

    conditionDistribution.forEach(item => {
      const condition = item._id || 'good';
      conditionMap[condition] = item.count;
    });

    // Format issue metrics
    const issueMap = {
      open: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0
    };

    issueMetrics.forEach(item => {
      issueMap[item._id] = item.count;
    });

    const totalIssues = Object.values(issueMap).reduce((a, b) => a + b, 0);

    return {
      // Overall Metrics
      overview: {
        totalAssets,
        totalValue: Math.round(totalValue * 100) / 100,
        averageValue: Math.round((financialMetrics[0]?.averageValue || 0) * 100) / 100,
        maxValue: financialMetrics[0]?.maxValue || 0,
        minValue: financialMetrics[0]?.minValue || 0
      },

      // Status Distribution
      status: {
        available: statusMap.available,
        in_use: statusMap.in_use,
        under_maintenance: statusMap.under_maintenance,
        retired: statusMap.retired,
        working: statusMap.working,
        needs_repair: statusMap.needs_repair,
        out_of_service: statusMap.out_of_service
      },

      // Utilization Metrics
      utilization: {
        assigned: {
          count: assignedAssets,
          percentage: totalAssets > 0 ? (assignedAssets / totalAssets) * 100 : 0
        },
        unassigned: {
          count: unassignedAssets,
          percentage: totalAssets > 0 ? (unassignedAssets / totalAssets) * 100 : 0
        },
        utilizationRate: totalAssets > 0 ? (assignedAssets / totalAssets) * 100 : 0
      },

      // Warranty Status
      warranty: {
        active: {
          count: warrantyActive,
          percentage: totalAssets > 0 ? (warrantyActive / totalAssets) * 100 : 0
        },
        expired: {
          count: warrantyExpired,
          percentage: totalAssets > 0 ? (warrantyExpired / totalAssets) * 100 : 0
        },
        none: {
          count: noWarranty,
          percentage: totalAssets > 0 ? (noWarranty / totalAssets) * 100 : 0
        }
      },

      // Condition Distribution
      condition: conditionMap,

      // Issue Metrics
      issues: {
        ...issueMap,
        total: totalIssues,
        openPercentage: totalIssues > 0 ? (issueMap.open / totalIssues) * 100 : 0,
        resolutionRate: totalIssues > 0 ? (issueMap.completed / totalIssues) * 100 : 0
      },

      // Category Distribution
      categories: categoryDistribution.map(cat => ({
        name: cat._id || 'Uncategorized',
        count: cat.count,
        value: cat.totalValue || 0,
        percentage: totalAssets > 0 ? (cat.count / totalAssets) * 100 : 0
      })),

      // Age Distribution
      ageDistribution: assetAgeDistribution.map(bucket => ({
        range: bucket._id === 'Unknown' ? 'Unknown' : `${bucket._id}-${bucket._id + 1} years`,
        count: bucket.count,
        percentage: totalAssets > 0 ? (bucket.count / totalAssets) * 100 : 0
      })),

      // Location Distribution
      locations: locationDistribution.map(loc => ({
        name: loc.name || loc.path || 'Unknown',
        count: loc.count,
        percentage: totalAssets > 0 ? (loc.count / totalAssets) * 100 : 0
      })),

      // Department Distribution
      departments: departmentDistribution.map(dept => ({
        name: dept.name,
        count: dept.count,
        percentage: totalAssets > 0 ? (dept.count / totalAssets) * 100 : 0
      }))
    };
  } catch (error) {
    console.error('Error calculating KPIs:', error);
    throw error;
  }
}

