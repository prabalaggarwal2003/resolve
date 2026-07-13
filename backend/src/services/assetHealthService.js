import { Asset, Issue, Notification, User } from '../models/index.js';
import { logAudit, getRequestMetadata, AUDIT_ACTIONS, AUDIT_RESOURCES } from './auditService.js';
import { ensureAssetHealthOrgConfig, resolveProfileForAsset } from './assetHealthOrgConfigService.js';
import { scoreAsset } from './assetHealthSummaryService.js';
import { scoreToCondition } from './assetHealthScoreService.js';

/** @deprecated Use org config automation rules instead — kept for API compatibility */
export const HEALTH_THRESHOLDS = {
  AGE_CRITICAL_YEARS: 3,
  AGE_MAINTENANCE_YEARS: 5,
  OPEN_ISSUES_WARNING: 3,
  OPEN_ISSUES_CRITICAL: 5,
  OPEN_ISSUES_MAINTENANCE: 8,
  WARRANTY_EXPIRY_DAYS: 30,
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

function compareRuleMetric(actual, operator, expected) {
  switch (operator) {
    case 'eq': return String(actual) === String(expected);
    case 'ne': return String(actual) !== String(expected);
    case 'gt': return Number(actual) > Number(expected);
    case 'gte': return Number(actual) >= Number(expected);
    case 'lt': return Number(actual) < Number(expected);
    case 'lte': return Number(actual) <= Number(expected);
    default: return false;
  }
}

function evaluateAutomationRules(rules, context, orgConfig) {
  let recommendedCondition = context.recommendedCondition;
  let recommendedStatus = context.currentStatus;
  let maintenanceReason = null;

  const sorted = [...(rules || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (const rule of sorted) {
    if (!rule.enabled) continue;

    if (rule.action?.type === 'sync_condition_from_score') {
      recommendedCondition = scoreToCondition(context.healthScore, orgConfig.healthLevels);
      continue;
    }

    if (rule.conditions?.length) {
      const matches = rule.conditions.every((c) =>
        compareRuleMetric(context[c.metric], c.operator, c.value)
      );
      if (!matches) continue;
    } else if (rule.action?.type !== 'sync_condition_from_score') {
      continue;
    }

    if (rule.action?.type === 'set_condition') {
      recommendedCondition = rule.action.condition || recommendedCondition;
      if (rule.action.status) recommendedStatus = rule.action.status;
      if (rule.action.maintenanceReason) maintenanceReason = rule.action.maintenanceReason;
    }
  }

  if (context.currentStatus === 'under_maintenance' && recommendedCondition !== ASSET_CONDITIONS.MAINTENANCE) {
    recommendedCondition = ASSET_CONDITIONS.MAINTENANCE;
    maintenanceReason = maintenanceReason || 'Asset currently under maintenance';
    recommendedStatus = 'under_maintenance';
  }

  return { recommendedCondition, recommendedStatus, maintenanceReason };
}

function riskFromScore(score) {
  if (score < 30) return 'critical';
  if (score < 50) return 'high';
  if (score < 75) return 'medium';
  return 'low';
}

/**
 * Analyze asset health using configurable weighted scoring and automation rules
 */
async function analyzeAssetHealth(assetId) {
  try {
    const asset = await Asset.findById(assetId).lean();
    if (!asset) return null;

    const orgConfig = await ensureAssetHealthOrgConfig(asset.organizationId);
    const groupId = asset.groupId?._id || asset.groupId;
    const profile = groupId ? await resolveProfileForAsset(asset.organizationId, groupId) : null;

    const openIssuesCount = await Issue.countDocuments({
      assetId,
      status: { $in: ['open', 'in_progress'] },
    });

    const issueMap = { [String(assetId)]: { total: openIssuesCount, open: openIssuesCount } };
    const auditDaysMap = {};
    const scoreResult = await scoreAsset(asset, orgConfig, profile, auditDaysMap, issueMap);

    const assetAge = calculateAssetAge(asset.purchaseDate);
    const warrantyExpiring = isWarrantyExpiring(asset.warrantyExpiry);
    const warrantyExpired = isWarrantyExpired(asset.warrantyExpiry);

    const ruleContext = {
      healthScore: scoreResult.healthScore,
      ageYears: assetAge,
      openIssuesCount,
      currentStatus: asset.status,
      recommendedCondition: scoreResult.recommendedCondition,
    };

    let { recommendedCondition, recommendedStatus, maintenanceReason } = evaluateAutomationRules(
      orgConfig.automationRules,
      ruleContext,
      orgConfig
    );

    if (!orgConfig.autoUpdateCondition) {
      recommendedCondition = asset.condition || 'good';
      recommendedStatus = asset.status;
      maintenanceReason = null;
    }

    const healthFactors = {
      assetAge,
      openIssuesCount,
      warrantyExpiring,
      warrantyExpired,
      currentCondition: asset.condition || 'good',
      healthScore: scoreResult.healthScore,
      healthLabel: scoreResult.healthLabel,
      factorScores: scoreResult.factorScores,
      breakdown: scoreResult.breakdown,
    };

    const riskLevel = riskFromScore(scoreResult.healthScore);
    const targetStatus =
      recommendedCondition === ASSET_CONDITIONS.MAINTENANCE ? 'under_maintenance' : recommendedStatus;

    return {
      assetId,
      currentCondition: asset.condition || 'good',
      currentStatus: asset.status,
      recommendedCondition,
      recommendedStatus: targetStatus,
      healthScore: scoreResult.healthScore,
      healthLabel: scoreResult.healthLabel,
      healthFactors,
      maintenanceReason,
      riskLevel,
      needsUpdate:
        orgConfig.autoUpdateCondition &&
        (asset.condition !== recommendedCondition || asset.status !== targetStatus),
      canReportIssues: recommendedCondition !== ASSET_CONDITIONS.MAINTENANCE,
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

    // Track if crossing critical threshold (not maintenance)
    const enteringCritical = healthAnalysis.recommendedCondition === ASSET_CONDITIONS.CRITICAL &&
                            healthAnalysis.currentCondition !== ASSET_CONDITIONS.CRITICAL;

    // Track if crossing poor/warning threshold
    const enteringPoor = healthAnalysis.recommendedCondition === ASSET_CONDITIONS.POOR &&
                        healthAnalysis.currentCondition !== ASSET_CONDITIONS.POOR &&
                        healthAnalysis.currentCondition !== ASSET_CONDITIONS.CRITICAL;

    // Add maintenance details if going into maintenance
    if (enteringMaintenance) {
      updateData.maintenanceReason = healthAnalysis.maintenanceReason;
      updateData.maintenanceStartDate = new Date();
    }

    // Use proper $set/$push structure for maintenance history
    let mongoUpdate;
    if (enteringMaintenance) {
      mongoUpdate = {
        $set: updateData,
        $push: {
          maintenanceHistory: {
            startDate: new Date(),
            reason: healthAnalysis.maintenanceReason || 'Automatic maintenance (health threshold exceeded)'
          }
        }
      };
    } else {
      mongoUpdate = { $set: updateData };
    }

    const updatedAsset = await Asset.findByIdAndUpdate(
      assetId,
      mongoUpdate,
      { new: true }
    ).lean();

    if (!updatedAsset) return false;

    // Send notifications based on condition changes
    if (enteringMaintenance) {
      await sendMaintenanceNotification(updatedAsset, healthAnalysis.maintenanceReason);
    } else if (enteringCritical) {
      await sendCriticalConditionNotification(updatedAsset, healthAnalysis);
    } else if (enteringPoor) {
      await sendWarningConditionNotification(updatedAsset, healthAnalysis);
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
 * Send notification when asset enters critical condition (5+ open issues or 3+ years old)
 */
async function sendCriticalConditionNotification(asset, healthAnalysis) {
  try {
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

    const { openIssuesCount, assetAge } = healthAnalysis.healthFactors;
    let reason = '';
    if (openIssuesCount >= HEALTH_THRESHOLDS.OPEN_ISSUES_CRITICAL) {
      reason = `${openIssuesCount} open issues (threshold: ${HEALTH_THRESHOLDS.OPEN_ISSUES_CRITICAL})`;
    } else if (assetAge >= HEALTH_THRESHOLDS.AGE_CRITICAL_YEARS) {
      reason = `Asset age: ${assetAge} years (threshold: ${HEALTH_THRESHOLDS.AGE_CRITICAL_YEARS} years)`;
    }

    const notifications = uniqueUserIds.map(userId => ({
      userId,
      type: 'asset_critical',
      title: `🚨 Critical Asset Health: ${asset.name}`,
      body: `${asset.assetId} has entered critical condition. ${reason}. Please review immediately.`,
      link: `/dashboard/assets/${asset._id}`,
      read: false,
      metadata: {
        assetId: asset._id,
        assetName: asset.name,
        openIssues: openIssuesCount,
        assetAge: assetAge,
        condition: 'critical'
      }
    }));

    await Notification.insertMany(notifications);
    console.log(`Sent critical condition notifications for asset ${asset.assetId} to ${uniqueUserIds.length} users`);
  } catch (error) {
    console.error('Error sending critical condition notification:', error);
  }
}

/**
 * Send notification when asset enters poor/warning condition (3+ open issues)
 */
async function sendWarningConditionNotification(asset, healthAnalysis) {
  try {
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

    const { openIssuesCount } = healthAnalysis.healthFactors;

    const notifications = uniqueUserIds.map(userId => ({
      userId,
      type: 'asset_warning',
      title: `⚠️ Asset Health Warning: ${asset.name}`,
      body: `${asset.assetId} has ${openIssuesCount} open issues (threshold: ${HEALTH_THRESHOLDS.OPEN_ISSUES_WARNING}). Please review.`,
      link: `/dashboard/assets/${asset._id}`,
      read: false,
      metadata: {
        assetId: asset._id,
        assetName: asset.name,
        openIssues: openIssuesCount,
        condition: 'poor'
      }
    }));

    await Notification.insertMany(notifications);
    console.log(`Sent warning condition notifications for asset ${asset.assetId} to ${uniqueUserIds.length} users`);
  } catch (error) {
    console.error('Error sending warning condition notification:', error);
  }
}

/**
 * Get assets under maintenance for an organization
 */
export async function getAssetsUnderMaintenance(organizationId, departmentId) {
  try {
    const filter = { organizationId, status: 'under_maintenance' };
    if (departmentId) filter.departmentId = departmentId;

    const assets = await Asset.find(filter)
      .populate('locationId', 'name path')
      .populate('departmentId', 'name')
      .populate('assignedTo', 'name email')
      .sort({ maintenanceStartDate: -1 })
      .lean();

    // Calculate days under maintenance for each asset
    const now = new Date();
    const OVERDUE_MS = 2 * 24 * 60 * 60 * 1000;
    return assets.map(asset => {
      const elapsedMs = asset.maintenanceStartDate
        ? now - new Date(asset.maintenanceStartDate)
        : 0;
      const daysUnderMaintenance = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));

      return {
        ...asset,
        daysUnderMaintenance,
        isOverdue: elapsedMs > OVERDUE_MS,
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
