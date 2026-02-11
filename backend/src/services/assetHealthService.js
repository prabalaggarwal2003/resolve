import { Asset, Issue, Notification, User } from '../models/index.js';
import { logAudit, getRequestMetadata, AUDIT_ACTIONS, AUDIT_RESOURCES } from './auditService.js';

// Asset health thresholds configuration
export const HEALTH_THRESHOLDS = {
  AGE_CRITICAL_YEARS: 3,        // Asset becomes critical after 3 years
  AGE_MAINTENANCE_YEARS: 5,     // Asset needs maintenance after 5 years
  OPEN_ISSUES_WARNING: 3,       // Warning if more than 3 open issues
  OPEN_ISSUES_CRITICAL: 5,      // Critical if more than 5 open issues
  OPEN_ISSUES_MAINTENANCE: 8,   // Auto-maintenance if more than 8 open issues
  WARRANTY_EXPIRY_DAYS: 30,     // Warning 30 days before warranty expires
};

export const ASSET_CONDITIONS = {
  EXCELLENT: 'excellent',    // New, no issues, under warranty
  GOOD: 'good',             // Working well, minor issues
  FAIR: 'fair',             // Some issues but functional
  POOR: 'poor',             // Multiple issues, aging
  CRITICAL: 'critical',     // Many issues, very old
  MAINTENANCE: 'under_maintenance' // Under maintenance, no reporting allowed
};

export const MAINTENANCE_REASONS = {
  AGE: 'Automatic maintenance due to asset age',
  ISSUES: 'Automatic maintenance due to multiple open issues',
  MANUAL: 'Manual maintenance request',
  WARRANTY: 'Maintenance due to warranty expiration'
};

/**
 * Calculate asset age in years
 */
function calculateAssetAge(purchaseDate) {
  if (!purchaseDate) return 0;
  const now = new Date();
  const purchase = new Date(purchaseDate);
  const diffTime = Math.abs(now - purchase);
  const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);
  return Math.floor(diffYears * 10) / 10; // Round to 1 decimal place
}

/**
 * Check if warranty is expiring soon
 */
function isWarrantyExpiring(warrantyExpiry) {
  if (!warrantyExpiry) return false;
  const now = new Date();
  const warranty = new Date(warrantyExpiry);
  const diffDays = (warranty - now) / (1000 * 60 * 60 * 24);
  return diffDays > 0 && diffDays <= HEALTH_THRESHOLDS.WARRANTY_EXPIRY_DAYS;
}

/**
 * Check if warranty has expired
 */
function isWarrantyExpired(warrantyExpiry) {
  if (!warrantyExpiry) return false;
  const now = new Date();
  const warranty = new Date(warrantyExpiry);
  return warranty < now;
}

/**
 * Analyze asset health based on multiple factors
 */
async function analyzeAssetHealth(assetId) {
  try {
    // Get asset details
    const asset = await Asset.findById(assetId).lean();
    if (!asset) return null;

    // Count open issues for this asset
    const openIssuesCount = await Issue.countDocuments({
      assetId,
      status: { $in: ['open', 'in_progress'] }
    });

    // Calculate asset age
    const assetAge = calculateAssetAge(asset.purchaseDate);

    // Check warranty status
    const warrantyExpiring = isWarrantyExpiring(asset.warrantyExpiry);
    const warrantyExpired = isWarrantyExpired(asset.warrantyExpiry);

    // Determine health factors
    const healthFactors = {
      assetAge,
      openIssuesCount,
      warrantyExpiring,
      warrantyExpired,
      currentCondition: asset.condition || 'good'
    };

    // Calculate recommended condition
    let recommendedCondition = ASSET_CONDITIONS.EXCELLENT;
    let maintenanceReason = null;
    let riskLevel = 'low';

    // Age-based assessment
    if (assetAge >= HEALTH_THRESHOLDS.AGE_MAINTENANCE_YEARS) {
      recommendedCondition = ASSET_CONDITIONS.MAINTENANCE;
      maintenanceReason = MAINTENANCE_REASONS.AGE;
      riskLevel = 'critical';
    } else if (assetAge >= HEALTH_THRESHOLDS.AGE_CRITICAL_YEARS) {
      recommendedCondition = ASSET_CONDITIONS.CRITICAL;
      riskLevel = 'high';
    }

    // Issues-based assessment (overrides age if more severe)
    if (openIssuesCount >= HEALTH_THRESHOLDS.OPEN_ISSUES_MAINTENANCE) {
      recommendedCondition = ASSET_CONDITIONS.MAINTENANCE;
      maintenanceReason = MAINTENANCE_REASONS.ISSUES;
      riskLevel = 'critical';
    } else if (openIssuesCount >= HEALTH_THRESHOLDS.OPEN_ISSUES_CRITICAL) {
      if (recommendedCondition !== ASSET_CONDITIONS.MAINTENANCE) {
        recommendedCondition = ASSET_CONDITIONS.CRITICAL;
        riskLevel = 'high';
      }
    } else if (openIssuesCount >= HEALTH_THRESHOLDS.OPEN_ISSUES_WARNING) {
      if (!['under_maintenance', 'critical'].includes(recommendedCondition)) {
        recommendedCondition = ASSET_CONDITIONS.POOR;
        riskLevel = 'medium';
      }
    }

    // Warranty-based adjustments
    if (warrantyExpired && recommendedCondition === ASSET_CONDITIONS.EXCELLENT) {
      recommendedCondition = ASSET_CONDITIONS.GOOD;
    }

    // If currently under maintenance, don't downgrade
    if (asset.status === 'under_maintenance' && recommendedCondition !== ASSET_CONDITIONS.MAINTENANCE) {
      recommendedCondition = ASSET_CONDITIONS.MAINTENANCE;
      maintenanceReason = 'Asset currently under maintenance';
    }

    return {
      assetId,
      currentCondition: asset.condition || 'good',
      currentStatus: asset.status,
      recommendedCondition,
      recommendedStatus: recommendedCondition === ASSET_CONDITIONS.MAINTENANCE ? 'under_maintenance' : asset.status,
      healthFactors,
      maintenanceReason,
      riskLevel,
      needsUpdate: asset.status !== (recommendedCondition === ASSET_CONDITIONS.MAINTENANCE ? 'under_maintenance' : asset.status),
      canReportIssues: recommendedCondition !== ASSET_CONDITIONS.MAINTENANCE
    };
  } catch (error) {
    console.error('Error analyzing asset health:', error);
    return null;
  }
}

/**
 * Update asset condition and status based on health analysis
 */
async function updateAssetCondition(assetId, healthAnalysis, systemUserId = null) {
  try {
    if (!healthAnalysis.needsUpdate) return false;

    const updateData = {
      condition: healthAnalysis.recommendedCondition,
      status: healthAnalysis.recommendedStatus,
      lastHealthCheck: new Date()
    };

    // Track if we're entering maintenance mode
    const enteringMaintenance = healthAnalysis.recommendedCondition === ASSET_CONDITIONS.MAINTENANCE;

    // Add maintenance details if going into maintenance
    if (enteringMaintenance) {
      updateData.maintenanceReason = healthAnalysis.maintenanceReason;
      updateData.maintenanceStartDate = new Date();
    }

    const updatedAsset = await Asset.findByIdAndUpdate(
      assetId,
      updateData,
      { new: true }
    ).lean();

    if (!updatedAsset) return false;

    // Send notification if asset enters maintenance
    if (enteringMaintenance) {
      await sendMaintenanceNotification(updatedAsset, healthAnalysis.maintenanceReason);
    }

    // Log audit entry for automatic condition change
    await logAudit(
      systemUserId || 'system',
      AUDIT_ACTIONS.ASSET_UPDATED,
      AUDIT_RESOURCES.ASSET,
      assetId,
      {
        resourceName: `${updatedAsset.assetId} - ${updatedAsset.name}`,
        description: `Automatic status update from "${healthAnalysis.currentStatus}" to "${healthAnalysis.recommendedStatus}"`,
        details: {
          oldStatus: healthAnalysis.currentStatus,
          newStatus: healthAnalysis.recommendedStatus,
          oldCondition: healthAnalysis.currentCondition,
          newCondition: healthAnalysis.recommendedCondition,
          reason: healthAnalysis.maintenanceReason,
          healthFactors: healthAnalysis.healthFactors,
          automated: true
        },
        severity: healthAnalysis.riskLevel === 'critical' ? 'high' : 'medium',
        organizationId: updatedAsset.organizationId,
        ipAddress: 'system',
        userAgent: 'automated-health-check'
      }
    );

    return true;
  } catch (error) {
    console.error('Error updating asset condition:', error);
    return false;
  }
}

/**
 * Check and update health for a single asset
 */
export async function checkAssetHealth(assetId, systemUserId = null) {
  try {
    const healthAnalysis = await analyzeAssetHealth(assetId);
    if (!healthAnalysis) return null;

    if (healthAnalysis.needsUpdate) {
      await updateAssetCondition(assetId, healthAnalysis, systemUserId);
    }

    return healthAnalysis;
  } catch (error) {
    console.error('Error checking asset health:', error);
    return null;
  }
}

/**
 * Run health checks for all assets in an organization
 */
export async function runOrganizationHealthCheck(organizationId, systemUserId = null) {
  try {
    const assets = await Asset.find({ organizationId }).select('_id').lean();
    const results = {
      total: assets.length,
      updated: 0,
      maintenance: 0,
      critical: 0,
      errors: []
    };

    for (const asset of assets) {
      try {
        const healthAnalysis = await checkAssetHealth(asset._id, systemUserId);
        if (healthAnalysis) {
          if (healthAnalysis.needsUpdate) results.updated++;
          if (healthAnalysis.recommendedCondition === ASSET_CONDITIONS.MAINTENANCE) results.maintenance++;
          if (healthAnalysis.recommendedCondition === ASSET_CONDITIONS.CRITICAL) results.critical++;
        }
      } catch (error) {
        results.errors.push({ assetId: asset._id, error: error.message });
      }
    }

    return results;
  } catch (error) {
    console.error('Error running organization health check:', error);
    throw error;
  }
}

/**
 * Get asset health summary for dashboard
 */
export async function getAssetHealthSummary(organizationId) {
  try {
    const pipeline = [
      { $match: { organizationId: organizationId } },
      {
        $group: {
          _id: '$condition',
          count: { $sum: 1 }
        }
      }
    ];

    const conditionCounts = await Asset.aggregate(pipeline);
    const summary = {
      total: 0,
      excellent: 0,
      good: 0,
      fair: 0,
      poor: 0,
      critical: 0,
      under_maintenance: 0
    };

    conditionCounts.forEach(item => {
      const condition = item._id || 'good';
      summary[condition] = item.count;
      summary.total += item.count;
    });

    return summary;
  } catch (error) {
    console.error('Error getting asset health summary:', error);
    return null;
  }
}

/**
 * Send notification when asset enters maintenance
 */
async function sendMaintenanceNotification(asset, reason) {
  try {
    // Find users to notify (admins, managers, assigned user)
    const usersToNotify = await User.find({
      organizationId: asset.organizationId,
      role: { $in: ['super_admin', 'admin', 'manager'] },
      isActive: true
    }).select('_id').lean();

    const userIds = usersToNotify.map(u => u._id.toString());

    // Also notify assigned user if exists
    if (asset.assignedTo) {
      userIds.push(asset.assignedTo.toString());
    }

    const uniqueUserIds = [...new Set(userIds)];

    const notifications = uniqueUserIds.map(userId => ({
      userId,
      type: 'asset_maintenance',
      title: `Asset Under Maintenance: ${asset.name}`,
      body: `${asset.assetId} has been placed under maintenance. ${reason || ''}`,
      link: `/dashboard/maintenance`,
      read: false,
      metadata: {
        assetId: asset._id,
        assetName: asset.name,
        maintenanceReason: reason
      }
    }));

    await Notification.insertMany(notifications);
    console.log(`Sent maintenance notifications for asset ${asset.assetId} to ${uniqueUserIds.length} users`);
  } catch (error) {
    console.error('Error sending maintenance notification:', error);
  }
}

/**
 * Get assets under maintenance for an organization
 */
export async function getAssetsUnderMaintenance(organizationId) {
  try {
    const assets = await Asset.find({
      organizationId,
      status: 'under_maintenance'
    })
      .populate('locationId', 'name path')
      .populate('departmentId', 'name')
      .populate('assignedTo', 'name email')
      .sort({ maintenanceStartDate: -1 })
      .lean();

    // Calculate days under maintenance for each asset
    const now = new Date();
    return assets.map(asset => {
      const daysUnderMaintenance = asset.maintenanceStartDate
        ? Math.floor((now - new Date(asset.maintenanceStartDate)) / (1000 * 60 * 60 * 24))
        : 0;

      return {
        ...asset,
        daysUnderMaintenance,
        isOverdue: daysUnderMaintenance > 2
      };
    });
  } catch (error) {
    console.error('Error getting assets under maintenance:', error);
    return [];
  }
}

/**
 * Check for assets under maintenance for more than 2 days and send alerts
 */
export async function checkOverdueMaintenanceAlerts() {
  try {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    // Find assets under maintenance for more than 2 days
    const overdueAssets = await Asset.find({
      status: 'under_maintenance',
      maintenanceStartDate: { $lte: twoDaysAgo }
    }).lean();

    console.log(`Found ${overdueAssets.length} assets under maintenance for more than 2 days`);

    for (const asset of overdueAssets) {
      const daysUnderMaintenance = Math.floor(
        (Date.now() - new Date(asset.maintenanceStartDate)) / (1000 * 60 * 60 * 24)
      );

      // Check if we already sent a notification today for this asset
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const existingNotification = await Notification.findOne({
        'metadata.assetId': asset._id,
        type: 'maintenance_overdue',
        createdAt: { $gte: todayStart }
      });

      if (existingNotification) {
        console.log(`Already sent overdue notification for ${asset.assetId} today, skipping`);
        continue;
      }

      // Find users to notify
      const usersToNotify = await User.find({
        organizationId: asset.organizationId,
        role: { $in: ['super_admin', 'admin', 'manager'] },
        isActive: true
      }).select('_id').lean();

      const userIds = usersToNotify.map(u => u._id.toString());
      if (asset.assignedTo) {
        userIds.push(asset.assignedTo.toString());
      }

      const uniqueUserIds = [...new Set(userIds)];

      const notifications = uniqueUserIds.map(userId => ({
        userId,
        type: 'maintenance_overdue',
        title: `⚠️ Maintenance Overdue: ${asset.name}`,
        body: `${asset.assetId} has been under maintenance for ${daysUnderMaintenance} days. Please review and complete maintenance.`,
        link: `/dashboard/maintenance`,
        read: false,
        metadata: {
          assetId: asset._id,
          assetName: asset.name,
          daysUnderMaintenance,
          maintenanceStartDate: asset.maintenanceStartDate
        }
      }));

      await Notification.insertMany(notifications);
      console.log(`Sent overdue maintenance alert for ${asset.assetId} (${daysUnderMaintenance} days)`);
    }

    return { checked: overdueAssets.length };
  } catch (error) {
    console.error('Error checking overdue maintenance:', error);
    return { error: error.message };
  }
}

export {
  analyzeAssetHealth,
  sendMaintenanceNotification
};
