# Asset Health Notification System - Complete Guide

## 🔔 Notification Types Implemented

### 1. **Asset Health Threshold Notifications**

#### Warning Level (3-4 open issues)
- **Trigger**: Asset reaches 3+ open issues
- **Notification Type**: `asset_warning`
- **Icon**: ⚠️
- **Recipients**: Admins, Managers, Assigned User
- **Message**: "Asset Health Warning: [Asset Name] has [X] open issues (threshold: 3). Please review."
- **Link**: `/dashboard/assets/[assetId]`

#### Critical Level (5-7 open issues OR 3+ years old)
- **Trigger**: Asset reaches 5+ open issues OR asset age exceeds 3 years
- **Notification Type**: `asset_critical`
- **Icon**: 🚨
- **Recipients**: Admins, Managers, Assigned User
- **Message**: "Critical Asset Health: [Asset Name] has entered critical condition. [Reason]. Please review immediately."
- **Link**: `/dashboard/assets/[assetId]`

#### Maintenance Level (8+ open issues OR 5+ years old)
- **Trigger**: Asset reaches 8+ open issues OR asset age exceeds 5 years
- **Notification Type**: `asset_maintenance`
- **Icon**: 🔧
- **Recipients**: Admins, Managers, Assigned User
- **Message**: "Asset Under Maintenance: [Asset Name] has been placed under maintenance. [Reason]"
- **Link**: `/dashboard/maintenance`
- **Effect**: Asset status changes to `under_maintenance`, issue reporting disabled

### 2. **Warranty Notifications**

#### Warranty Expiring Soon (Within 30 days)
- **Trigger**: Warranty expires within 30 days
- **Notification Type**: `warranty_expiring_soon`
- **Icon**: ⚠️
- **Recipients**: Super Admin, Admin, Manager, Principal
- **Message**: "Warranty Expiring Soon: [Asset Name] will expire in [X] days on [Date]."
- **Link**: `/dashboard/assets/[assetId]`
- **Frequency**: Once per week (prevents spam)
- **Cron**: Weekly (Monday) at 9:00 AM

#### Warranty Expired
- **Trigger**: Warranty expired yesterday
- **Notification Type**: `warranty_expiry`
- **Icon**: ❌
- **Recipients**: Super Admin, Admin, Manager, Principal
- **Message**: "Warranty Expired: [Asset Name] expired on [Date]."
- **Link**: `/dashboard/assets/[assetId]`
- **Frequency**: One-time notification (checks for duplicates)
- **Cron**: Daily at 9:00 AM

### 3. **Maintenance Overdue Notifications**

#### Overdue Maintenance (>2 days)
- **Trigger**: Asset under maintenance for more than 2 days
- **Notification Type**: `maintenance_overdue`
- **Icon**: ⚠️
- **Recipients**: Admins, Managers, Assigned User
- **Message**: "Maintenance Overdue: [Asset Name] has been under maintenance for [X] days. Please review and complete maintenance."
- **Link**: `/dashboard/maintenance`
- **Frequency**: Once per day (prevents spam)
- **Cron**: Daily at 10:00 AM

---

## 📊 Notification Flow

### Asset Health Monitoring Flow

```
Issue Created → checkAssetHealth() Called
                      ↓
        Count Open Issues for Asset
                      ↓
    ┌─────────────────┴─────────────────┐
    │                                   │
3-4 Issues              5-7 Issues      │         8+ Issues
    ↓                       ↓           │             ↓
⚠️ Warning          🚨 Critical         │      🔧 Maintenance
Notification       Notification         │      Notification
                                        │      + Status Change
                                        │
                                  3+ Years Old
                                        ↓
                                  🚨 Critical
                                  Notification
```

### Warranty Check Flow

```
Daily Cron (9:00 AM)
        ↓
Check Warranties Expired Yesterday
        ↓
    ┌───┴───┐
    │ Found │ → Check if already notified → No → ❌ Send Notification
    └───────┘                                    
                                              Yes → Skip
```

---

## 🛠️ Testing Endpoints

### Test Asset Health Check
```bash
POST /api/test-notifications/asset-health/:assetId
Authorization: Bearer <token>

# Response:
{
  "success": true,
  "healthCheck": {
    "assetId": "...",
    "currentCondition": "good",
    "recommendedCondition": "critical",
    "healthFactors": {
      "assetAge": 4.2,
      "openIssuesCount": 6,
      "warrantyExpiring": false,
      "warrantyExpired": true
    },
    "needsUpdate": true,
    "canReportIssues": true
  },
  "message": "Health check completed. Notifications sent if thresholds were crossed."
}
```

### Test All Notification Systems
```bash
POST /api/test-notifications/all
Authorization: Bearer <token>

# Response:
{
  "success": true,
  "results": {
    "warrantyExpired": {
      "success": true,
      "assetsChecked": 2,
      "notificationsSent": 8
    },
    "warrantyExpiring": {
      "success": true,
      "assetsChecked": 5,
      "notificationsSent": 20
    }
  }
}
```

### Manual Warranty Checks
```bash
# Check expired warranties
GET /api/warranty-checks/expired
Authorization: Bearer <token>

# Check expiring warranties
GET /api/warranty-checks/expiring-soon
Authorization: Bearer <token>
```

### Manual Overdue Maintenance Check
```bash
POST /api/asset-health/maintenance/check-overdue
Authorization: Bearer <token>
```

---

## 🎯 Threshold Configuration

Current thresholds defined in `backend/src/services/assetHealthService.js`:

```javascript
const HEALTH_THRESHOLDS = {
  AGE_CRITICAL_YEARS: 3,        // Asset becomes critical after 3 years
  AGE_MAINTENANCE_YEARS: 5,     // Asset needs maintenance after 5 years
  OPEN_ISSUES_WARNING: 3,       // Warning if more than 3 open issues
  OPEN_ISSUES_CRITICAL: 5,      // Critical if more than 5 open issues
  OPEN_ISSUES_MAINTENANCE: 8,   // Auto-maintenance if more than 8 open issues
  WARRANTY_EXPIRY_DAYS: 30,     // Warning 30 days before warranty expires
};
```

---

## 📅 Cron Schedule

Defined in `backend/src/services/warrantyScheduler.js`:

```javascript
// Warranty expired check - Daily at 9:00 AM
cron.schedule('0 9 * * *', async () => {
  await checkExpiredWarranties();
});

// Warranty expiring soon check - Weekly (Monday) at 9:00 AM
cron.schedule('0 9 * * 1', async () => {
  await checkExpiringWarranties();
});

// Overdue maintenance check - Daily at 10:00 AM
cron.schedule('0 10 * * *', async () => {
  await checkOverdueMaintenanceAlerts();
});
```

---

## 🔧 How Notifications Are Triggered

### Automatic Triggers

1. **When creating an issue**: `POST /api/issues`
   - Calls `checkAssetHealth()` before allowing issue creation
   - If thresholds crossed → sends notification + updates asset status

2. **Daily cron jobs**: Run automatically via scheduler
   - 9:00 AM: Warranty expired check
   - 9:00 AM (Monday): Warranty expiring check
   - 10:00 AM: Overdue maintenance check

3. **Manual health check**: `POST /api/asset-health/check-all`
   - Admin can trigger organization-wide health check
   - Sends notifications for all assets crossing thresholds

### Manual Triggers (For Testing)

- Test specific asset: `POST /api/test-notifications/asset-health/:assetId`
- Test all systems: `POST /api/test-notifications/all`
- Warranty checks: `GET /api/warranty-checks/expired` or `/expiring-soon`
- Overdue maintenance: `POST /api/asset-health/maintenance/check-overdue`

---

## ✅ Verification Steps

### Test Warning Notification (3+ issues)
1. Create an asset
2. Create 3 issues for that asset
3. Try to create 4th issue → Should send ⚠️ warning notification

### Test Critical Notification (5+ issues)
1. Continue adding issues to same asset
2. On 5th issue → Should send 🚨 critical notification

### Test Maintenance Auto-Status (8+ issues)
1. Continue adding issues
2. On 8th issue → Should:
   - Send 🔧 maintenance notification
   - Change asset status to `under_maintenance`
   - Block further issue reporting

### Test Warranty Expiry
1. Create asset with warranty expiring yesterday
2. Call `GET /api/warranty-checks/expired`
3. Should send ❌ expired notification

### Test Overdue Maintenance
1. Manually set asset to maintenance with start date 3 days ago
2. Call `POST /api/asset-health/maintenance/check-overdue`
3. Should send ⚠️ overdue notification

---

## 📧 Notification Recipients

| Notification Type | Recipients |
|------------------|------------|
| Asset Warning | Admins, Managers, Assigned User |
| Asset Critical | Admins, Managers, Assigned User |
| Asset Maintenance | Admins, Managers, Assigned User |
| Warranty Expiring | Super Admin, Admin, Manager, Principal |
| Warranty Expired | Super Admin, Admin, Manager, Principal |
| Maintenance Overdue | Admins, Managers, Assigned User |

---

## 🐛 Troubleshooting

### Notifications not appearing?
1. Check user role - must be admin/manager for most notifications
2. Check notification badge in UI - should update in real-time
3. Check `/dashboard/notifications` page
4. Verify cron jobs are running (check server logs)

### Duplicate notifications?
- System checks for duplicates before sending
- Warranty expiry: One-time only
- Expiring soon: Once per week
- Overdue maintenance: Once per day

### Warranty notifications not sending?
- Ensure warranty expiry date is set on asset
- Check if notification was already sent (search in notifications collection)
- Manually trigger: `GET /api/warranty-checks/expired`

---

## 🎉 Summary

All notification systems are now fully implemented and working:

✅ Asset health warnings (3+ issues)
✅ Asset health critical (5+ issues)  
✅ Asset auto-maintenance (8+ issues)
✅ Warranty expiring notifications
✅ Warranty expired notifications
✅ Maintenance overdue alerts
✅ Real-time notification badges
✅ Automated cron jobs
✅ Manual testing endpoints
✅ Duplicate prevention

