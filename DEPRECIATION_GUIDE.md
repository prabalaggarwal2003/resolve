# Asset Depreciation Calculator - Complete Guide

## 📊 Overview

The Asset Depreciation Calculator provides comprehensive insights into how your assets lose value over time. It uses multiple factors including age, warranty status, maintenance history, condition, and issue reports to calculate the current value of each asset.

## 🎯 Depreciation Methodology

### Calculation Formula

```
Current Value = Original Cost - Total Depreciation

Total Depreciation = 
  Age Depreciation +
  Warranty Deduction +
  Maintenance Deduction +
  Issues Deduction +
  Status Deduction +
  Condition Deduction
```

### Depreciation Factors

#### 1. **Age-Based Depreciation** (Straight-Line Method)
- **Rate**: 20% per year
- **Calculation**: `Original Cost × 0.20 × Age in Years`
- **Example**: $1,000 asset, 2 years old = $400 depreciation

#### 2. **Warranty Expiration**
- **Deduction**: 5% of original cost
- **Trigger**: Warranty expiry date passed
- **Example**: $1,000 asset, expired warranty = $50 deduction

#### 3. **Maintenance History**
- **Deduction**: 3% per maintenance occurrence
- **Trigger**: Each time asset enters maintenance
- **Example**: $1,000 asset, 2 maintenance cycles = $60 deduction

#### 4. **Issue Reports**
- **Deduction**: 2% per issue report
- **Trigger**: Each issue reported against the asset
- **Example**: $1,000 asset, 5 issues = $100 deduction

#### 5. **Current Status**
- **Available/In Use/Working**: 0% deduction
- **Under Maintenance**: 10% deduction
- **Needs Repair**: 15% deduction
- **Out of Service**: 30% deduction
- **Retired**: 50% deduction

#### 6. **Asset Condition**
- **Excellent**: 0% deduction
- **Good**: 5% deduction
- **Fair**: 10% deduction
- **Poor**: 20% deduction
- **Critical**: 30% deduction
- **Under Maintenance**: 15% deduction

### Residual Value Protection

Assets cannot depreciate below **10% of original cost** (minimum residual value).

## 📈 Example Calculation

### Scenario: Office Desktop Computer

**Asset Details:**
- Original Cost: $1,200
- Purchase Date: 3 years ago
- Warranty: Expired (1 year ago)
- Maintenance: 1 time
- Issues Reported: 4
- Status: Working
- Condition: Fair

**Depreciation Breakdown:**

1. **Age Depreciation**: $1,200 × 0.20 × 3 = **$720**
2. **Warranty Deduction**: $1,200 × 0.05 = **$60**
3. **Maintenance Deduction**: $1,200 × 0.03 × 1 = **$36**
4. **Issues Deduction**: $1,200 × 0.02 × 4 = **$96**
5. **Status Deduction**: $1,200 × 0 = **$0** (working)
6. **Condition Deduction**: $1,200 × 0.10 = **$120** (fair)

**Total Depreciation**: $720 + $60 + $36 + $96 + $0 + $120 = **$1,032**

**Current Value**: $1,200 - $1,032 = **$168**

**Depreciation Percentage**: 86%

## 🎨 User Interface

### Dashboard Overview

```
┌─────────────────────────────────────────────────────┐
│ 💰 Asset Depreciation                               │
├─────────────────────────────────────────────────────┤
│ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────┐│
│ │ Original  │ │ Current   │ │   Total   │ │  Avg  ││
│ │  $45,000  │ │  $28,500  │ │ Deprec.   │ │ 36.7% ││
│ │           │ │           │ │  $16,500  │ │       ││
│ └───────────┘ └───────────┘ └───────────┘ └───────┘│
├─────────────────────────────────────────────────────┤
│ [By Assets] [By Category]                           │
│                                                     │
│ Filter: [All Categories ▼] Sort: [Depreciation ▼]  │
│                                                     │
│ ┌─────────────────────────────────────────────────┐│
│ │ Asset     │ Category │ Original │ Current │ %  ││
│ ├─────────────────────────────────────────────────┤│
│ │ Desktop-1 │ Desktop  │ $1,200   │ $168    │86% ││
│ │ Projec-1  │ Projector│ $2,500   │ $1,750  │30% ││
│ └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

### Features

#### 1. **Summary Cards**
- Total Original Value
- Total Current Value
- Total Depreciation Amount
- Average Depreciation Percentage

#### 2. **View Modes**
- **By Assets**: Detailed list of all assets with depreciation
- **By Category**: Aggregated depreciation by asset category

#### 3. **Filtering & Sorting**
- Filter by category
- Sort by:
  - Depreciation amount (highest first)
  - Depreciation percentage
  - Current value

#### 4. **Asset Details Modal**
Opens when you click "View" on any asset:
- Original cost, current value, depreciation %
- Complete breakdown of all deductions
- Factors affecting depreciation
- Link to full asset details

#### 5. **Category Summary View**
Shows aggregated data per category:
- Number of assets
- Total original value
- Total current value
- Total depreciation
- Average depreciation percentage

## 🔧 API Endpoints

### Get Organization Depreciation Summary
```http
GET /api/depreciation/summary
Authorization: Bearer <token>

Response:
{
  "assets": [...],
  "summary": {
    "totalAssets": 45,
    "totalOriginalValue": 45000,
    "totalCurrentValue": 28500,
    "totalDepreciation": 16500,
    "averageDepreciationPercentage": 36.7
  }
}
```

### Get Depreciation by Category
```http
GET /api/depreciation/by-category
Authorization: Bearer <token>

Response:
{
  "categories": [
    {
      "category": "Desktop",
      "count": 12,
      "originalValue": 14400,
      "currentValue": 5200,
      "depreciation": 9200,
      "depreciationPercentage": 63.9
    },
    ...
  ],
  "summary": {...}
}
```

### Get Single Asset Depreciation
```http
GET /api/depreciation/asset/:assetId
Authorization: Bearer <token>

Response:
{
  "assetId": "...",
  "assetIdString": "ABC-DSK-001",
  "name": "Desktop Computer 1",
  "originalCost": 1200,
  "currentValue": 168,
  "depreciation": 1032,
  "depreciationPercentage": 86,
  "breakdown": {
    "ageDeduction": 720,
    "warrantyDeduction": 60,
    "maintenanceDeduction": 36,
    "issuesDeduction": 96,
    "statusDeduction": 0,
    "conditionDeduction": 120
  },
  "factors": {
    "age": 3,
    "warrantyExpired": true,
    "maintenanceCount": 1,
    "issueCount": 4,
    "status": "working",
    "condition": "fair"
  }
}
```

### Get Depreciation Configuration
```http
GET /api/depreciation/config
Authorization: Bearer <token>

Response:
{
  "config": {
    "ANNUAL_DEPRECIATION_RATE": 0.20,
    "MIN_VALUE_PERCENTAGE": 0.10,
    "WARRANTY_EXPIRED_DEDUCTION": 0.05,
    "MAINTENANCE_PER_OCCURRENCE": 0.03,
    "ISSUE_PER_REPORT": 0.02,
    "STATUS_DEDUCTIONS": {...},
    "CONDITION_DEDUCTIONS": {...}
  }
}
```

## 💡 Use Cases

### 1. **Financial Reporting**
- Accurate asset valuation for balance sheets
- Track asset portfolio performance
- Calculate total asset depreciation for tax purposes

### 2. **Budget Planning**
- Identify assets nearing end of life
- Plan replacement budgets based on depreciation
- Forecast future asset investments

### 3. **Asset Lifecycle Management**
- Monitor which assets are depreciating rapidly
- Identify problematic assets (high maintenance, many issues)
- Make informed decisions about repairs vs. replacement

### 4. **Insurance & Audits**
- Provide accurate current values for insurance
- Support audit requirements with detailed depreciation tracking
- Maintain compliance with accounting standards

### 5. **Performance Analysis**
- Compare depreciation across categories
- Identify which asset types hold value better
- Optimize future purchasing decisions

## 📊 Insights & Reports

### High Depreciation Assets
Assets with >70% depreciation should be:
- Evaluated for replacement
- Removed from active use
- Considered for disposal/donation

### Low Depreciation Assets
Assets with <20% depreciation indicate:
- Recent purchases
- Good maintenance practices
- Low usage/excellent condition
- Valid warranties

### Category Comparison
Compare depreciation rates across categories to:
- Identify best-value asset categories
- Spot categories needing more maintenance
- Plan future procurement strategies

## ⚙️ Configuration

Current depreciation rates can be adjusted in:
`backend/src/services/depreciationService.js`

```javascript
const DEPRECIATION_CONFIG = {
  ANNUAL_DEPRECIATION_RATE: 0.20,        // 20% per year
  MIN_VALUE_PERCENTAGE: 0.10,            // 10% minimum
  WARRANTY_EXPIRED_DEDUCTION: 0.05,      // 5%
  MAINTENANCE_PER_OCCURRENCE: 0.03,      // 3%
  ISSUE_PER_REPORT: 0.02,                // 2%
  // ... status and condition deductions
};
```

## 🎯 Access Control

**Who can view depreciation data:**
- ✅ Super Admin
- ✅ Admin
- ✅ Manager
- ✅ Principal
- ❌ Teachers, Students, Reporters

## 🔍 Color Coding

Depreciation percentage is color-coded for quick insights:
- **< 20%**: 🟢 Green (Excellent)
- **20-40%**: 🔵 Blue (Good)
- **40-60%**: 🟡 Yellow (Moderate)
- **60-80%**: 🟠 Orange (High)
- **> 80%**: 🔴 Red (Critical - consider replacement)

## ✅ Summary

The Asset Depreciation Calculator provides:

✅ Accurate asset valuation based on 6 factors
✅ Detailed breakdown of depreciation sources
✅ Category-wise and asset-wise views
✅ Filtering and sorting capabilities
✅ Interactive details modal
✅ Professional financial reporting
✅ Easy-to-understand visualizations
✅ Export-ready data via API

**Access it at**: `/dashboard/depreciation`

Perfect for financial planning, budgeting, asset lifecycle management, and compliance reporting!

