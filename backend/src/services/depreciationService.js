import { Asset, Issue } from '../models/index.js';

/**
 * Depreciation calculation configuration
 */
const DEPRECIATION_CONFIG = {
  // Annual depreciation rate (straight-line method)
  ANNUAL_DEPRECIATION_RATE: 0.20, // 20% per year

  // Maximum depreciation (asset won't go below this % of original cost)
  MIN_VALUE_PERCENTAGE: 0.10, // 10% minimum residual value

  // Deduction multipliers
  WARRANTY_EXPIRED_DEDUCTION: 0.05, // 5% deduction
  MAINTENANCE_PER_OCCURRENCE: 0.03, // 3% per maintenance occurrence
  ISSUE_PER_REPORT: 0.02, // 2% per issue report

  // Status-based deductions
  STATUS_DEDUCTIONS: {
    'available': 0,
    'in_use': 0,
    'working': 0,
    'under_maintenance': 0.10, // 10% deduction
    'needs_repair': 0.15, // 15% deduction
    'out_of_service': 0.30, // 30% deduction
    'retired': 0.50 // 50% deduction
  },

  // Condition-based deductions
  CONDITION_DEDUCTIONS: {
    'excellent': 0,
    'good': 0.05,
    'fair': 0.10,
    'poor': 0.20,
    'critical': 0.30,
    'under_maintenance': 0.15
  }
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
  return diffYears;
}

/**
 * Check if warranty is expired
 */
function isWarrantyExpired(warrantyExpiry) {
  if (!warrantyExpiry) return true;
  return new Date(warrantyExpiry) < new Date();
}

/**
 * Calculate depreciation for a single asset
 */
export async function calculateAssetDepreciation(assetId) {
  try {
    const asset = await Asset.findById(assetId)
      .populate('locationId', 'name')
      .populate('departmentId', 'name')
      .lean();

    if (!asset) {
      throw new Error('Asset not found');
    }

    const originalCost = asset.cost || 0;

    // If no cost, return zero depreciation
    if (originalCost === 0) {
      return {
        assetId: asset._id,
        assetIdString: asset.assetId,
        name: asset.name,
        originalCost: 0,
        currentValue: 0,
        depreciation: 0,
        depreciationPercentage: 0,
        breakdown: {
          ageDeduction: 0,
          warrantyDeduction: 0,
          maintenanceDeduction: 0,
          issuesDeduction: 0,
          statusDeduction: 0,
          conditionDeduction: 0
        },
        factors: {
          age: 0,
          warrantyExpired: false,
          maintenanceCount: 0,
          issueCount: 0,
          status: asset.status,
          condition: asset.condition || 'good'
        }
      };
    }

    // Calculate factors
    const assetAge = calculateAssetAge(asset.purchaseDate);
    const warrantyExpired = isWarrantyExpired(asset.warrantyExpiry);

    // Count maintenance occurrences (times asset went to maintenance)
    const maintenanceCount = asset.maintenanceStartDate ? 1 : 0; // Simplified for now

    // Count total issues
    const issueCount = await Issue.countDocuments({ assetId: asset._id });

    // Calculate deductions

    // 1. Age-based depreciation (straight-line)
    const ageDepreciationRate = DEPRECIATION_CONFIG.ANNUAL_DEPRECIATION_RATE;
    const ageDeduction = originalCost * ageDepreciationRate * assetAge;

    // 2. Warranty expiration deduction
    const warrantyDeduction = warrantyExpired
      ? originalCost * DEPRECIATION_CONFIG.WARRANTY_EXPIRED_DEDUCTION
      : 0;

    // 3. Maintenance deduction
    const maintenanceDeduction = originalCost * DEPRECIATION_CONFIG.MAINTENANCE_PER_OCCURRENCE * maintenanceCount;

    // 4. Issues deduction
    const issuesDeduction = originalCost * DEPRECIATION_CONFIG.ISSUE_PER_REPORT * issueCount;

    // 5. Status deduction
    const statusDeductionRate = DEPRECIATION_CONFIG.STATUS_DEDUCTIONS[asset.status] || 0;
    const statusDeduction = originalCost * statusDeductionRate;

    // 6. Condition deduction
    const conditionDeductionRate = DEPRECIATION_CONFIG.CONDITION_DEDUCTIONS[asset.condition || 'good'] || 0;
    const conditionDeduction = originalCost * conditionDeductionRate;

    // Total depreciation
    const totalDepreciation = ageDeduction + warrantyDeduction + maintenanceDeduction +
                             issuesDeduction + statusDeduction + conditionDeduction;

    // Current value (cannot go below minimum)
    const minValue = originalCost * DEPRECIATION_CONFIG.MIN_VALUE_PERCENTAGE;
    const currentValue = Math.max(originalCost - totalDepreciation, minValue);

    const actualDepreciation = originalCost - currentValue;
    const depreciationPercentage = (actualDepreciation / originalCost) * 100;

    return {
      assetId: asset._id,
      assetIdString: asset.assetId,
      name: asset.name,
      category: asset.category,
      location: asset.locationId?.name,
      department: asset.departmentId?.name,
      purchaseDate: asset.purchaseDate,
      originalCost,
      currentValue: Math.round(currentValue * 100) / 100,
      depreciation: Math.round(actualDepreciation * 100) / 100,
      depreciationPercentage: Math.round(depreciationPercentage * 100) / 100,
      breakdown: {
        ageDeduction: Math.round(ageDeduction * 100) / 100,
        warrantyDeduction: Math.round(warrantyDeduction * 100) / 100,
        maintenanceDeduction: Math.round(maintenanceDeduction * 100) / 100,
        issuesDeduction: Math.round(issuesDeduction * 100) / 100,
        statusDeduction: Math.round(statusDeduction * 100) / 100,
        conditionDeduction: Math.round(conditionDeduction * 100) / 100
      },
      factors: {
        age: Math.round(assetAge * 10) / 10,
        warrantyExpired,
        warrantyExpiry: asset.warrantyExpiry,
        maintenanceCount,
        issueCount,
        status: asset.status,
        condition: asset.condition || 'good'
      }
    };
  } catch (error) {
    console.error('Error calculating asset depreciation:', error);
    throw error;
  }
}

/**
 * Calculate depreciation for all assets in an organization
 */
export async function calculateOrganizationDepreciation(organizationId) {
  try {
    const assets = await Asset.find({ organizationId })
      .sort({ cost: -1 }) // Sort by cost descending
      .lean();

    const depreciationResults = [];
    let totalOriginalValue = 0;
    let totalCurrentValue = 0;

    for (const asset of assets) {
      try {
        const depreciation = await calculateAssetDepreciation(asset._id);
        depreciationResults.push(depreciation);
        totalOriginalValue += depreciation.originalCost;
        totalCurrentValue += depreciation.currentValue;
      } catch (err) {
        console.error(`Error calculating depreciation for asset ${asset.assetId}:`, err);
      }
    }

    const totalDepreciation = totalOriginalValue - totalCurrentValue;
    const averageDepreciationPercentage = totalOriginalValue > 0
      ? (totalDepreciation / totalOriginalValue) * 100
      : 0;

    return {
      assets: depreciationResults,
      summary: {
        totalAssets: assets.length,
        totalOriginalValue: Math.round(totalOriginalValue * 100) / 100,
        totalCurrentValue: Math.round(totalCurrentValue * 100) / 100,
        totalDepreciation: Math.round(totalDepreciation * 100) / 100,
        averageDepreciationPercentage: Math.round(averageDepreciationPercentage * 100) / 100
      }
    };
  } catch (error) {
    console.error('Error calculating organization depreciation:', error);
    throw error;
  }
}

/**
 * Get depreciation summary by category
 */
export async function getDepreciationByCategory(organizationId) {
  try {
    const result = await calculateOrganizationDepreciation(organizationId);

    const categoryMap = {};

    result.assets.forEach(asset => {
      const category = asset.category || 'Uncategorized';
      if (!categoryMap[category]) {
        categoryMap[category] = {
          category,
          count: 0,
          originalValue: 0,
          currentValue: 0,
          depreciation: 0
        };
      }

      categoryMap[category].count++;
      categoryMap[category].originalValue += asset.originalCost;
      categoryMap[category].currentValue += asset.currentValue;
      categoryMap[category].depreciation += asset.depreciation;
    });

    const categories = Object.values(categoryMap).map(cat => ({
      ...cat,
      depreciationPercentage: cat.originalValue > 0
        ? Math.round((cat.depreciation / cat.originalValue) * 100 * 100) / 100
        : 0
    }));

    return {
      categories,
      summary: result.summary
    };
  } catch (error) {
    console.error('Error getting depreciation by category:', error);
    throw error;
  }
}

export { DEPRECIATION_CONFIG };

