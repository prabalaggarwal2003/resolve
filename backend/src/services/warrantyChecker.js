import { Asset, Notification, User } from '../models/index.js';

/**
 * Check for expired warranties and send notifications
 * This should be run daily via cron job
 */
export async function checkExpiredWarranties() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Find assets with warranty that expired yesterday (to send one-time notification)
    // This prevents sending multiple notifications for the same expired warranty
    const expiredAssets = await Asset.find({
      warrantyExpiry: {
        $gte: yesterday,
        $lt: today
      }
    })
      .populate('organizationId', 'name')
      .lean();

    console.log(`Found ${expiredAssets.length} assets with warranty that expired yesterday`);

    let totalNotificationsSent = 0;

    for (const asset of expiredAssets) {
      // Check if we already sent a notification for this asset's warranty expiry
      const existingNotification = await Notification.findOne({
        'metadata.assetId': asset._id,
        type: 'warranty_expiry'
      });

      if (existingNotification) {
        console.log(`Already sent warranty expiry notification for ${asset.assetId}, skipping`);
        continue;
      }

      // Find users in the same organization who should be notified
      // Notify: super_admin, admin, manager, and principal
      const usersToNotify = await User.find({
        organizationId: asset.organizationId,
        role: { $in: ['super_admin', 'admin', 'manager', 'principal'] },
        isActive: true
      }).select('_id').lean();

      if (usersToNotify.length === 0) continue;

      // Create notifications for each user
      const notifications = usersToNotify.map(user => ({
        userId: user._id,
        type: 'warranty_expiry',
        title: `❌ Warranty Expired: ${asset.name}`,
        body: `The warranty for ${asset.name} (${asset.assetId}) expired on ${new Date(asset.warrantyExpiry).toLocaleDateString()}.`,
        link: `/dashboard/assets/${asset._id}`,
        read: false,
        metadata: {
          assetId: asset._id,
          assetName: asset.name,
          assetIdString: asset.assetId,
          warrantyExpiry: asset.warrantyExpiry
        }
      }));

      // Bulk insert notifications
      await Notification.insertMany(notifications);
      totalNotificationsSent += notifications.length;
      console.log(`Created ${notifications.length} warranty expiry notifications for asset ${asset.assetId}`);
    }

    return {
      success: true,
      assetsChecked: expiredAssets.length,
      notificationsSent: totalNotificationsSent
    };
  } catch (err) {
    console.error('Error checking expired warranties:', err);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Check for warranties expiring soon (within 30 days)
 * Optional: can be run weekly
 */
export async function checkExpiringWarranties() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const in30Days = new Date(today);
    in30Days.setDate(in30Days.getDate() + 30);

    // Find assets with warranty expiring in the next 30 days
    const expiringAssets = await Asset.find({
      warrantyExpiry: {
        $gte: today,
        $lte: in30Days
      }
    })
      .populate('organizationId', 'name')
      .lean();

    console.log(`Found ${expiringAssets.length} assets with warranty expiring in next 30 days`);

    for (const asset of expiringAssets) {
      const daysRemaining = Math.ceil((new Date(asset.warrantyExpiry) - today) / (1000 * 60 * 60 * 24));

      // Find users to notify
      const usersToNotify = await User.find({
        organizationId: asset.organizationId,
        role: { $in: ['super_admin', 'admin', 'manager', 'principal'] },
        isActive: true
      }).select('_id').lean();

      if (usersToNotify.length === 0) continue;

      // Check if notification already sent in last 7 days
      const recentNotification = await Notification.findOne({
        userId: { $in: usersToNotify.map(u => u._id) },
        'metadata.assetId': asset._id,
        type: 'warranty_expiring_soon',
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      });

      if (recentNotification) {
        console.log(`Skipping notification for asset ${asset.assetId} - already notified recently`);
        continue;
      }

      // Create notifications
      const notifications = usersToNotify.map(user => ({
        userId: user._id,
        type: 'warranty_expiring_soon',
        title: `⚠️ Warranty Expiring Soon: ${asset.name}`,
        body: `The warranty for ${asset.name} (${asset.assetId}) will expire in ${daysRemaining} days on ${new Date(asset.warrantyExpiry).toLocaleDateString()}.`,
        link: `/dashboard/assets/${asset._id}`,
        read: false,
        metadata: {
          assetId: asset._id,
          assetName: asset.name,
          assetIdString: asset.assetId,
          warrantyExpiry: asset.warrantyExpiry,
          daysRemaining
        }
      }));

      await Notification.insertMany(notifications);
      console.log(`Created ${notifications.length} expiring soon notifications for asset ${asset.assetId}`);
    }

    return { success: true, assetsChecked: expiringAssets.length };
  } catch (err) {
    console.error('Error checking expiring warranties:', err);
    return { success: false, error: err.message };
  }
}

