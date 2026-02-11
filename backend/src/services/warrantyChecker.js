import { Asset, Notification, User } from '../models/index.js';

/**
 * Check for expired warranties and send notifications
 * This should be run daily via cron job
 */
export async function checkExpiredWarranties() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find assets with warranty expiring today
    const expiredAssets = await Asset.find({
      warrantyExpiry: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      }
    })
      .populate('organizationId', 'name')
      .lean();

    console.log(`Found ${expiredAssets.length} assets with warranty expiring today`);

    for (const asset of expiredAssets) {
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
        title: `Warranty Expired: ${asset.name}`,
        body: `The warranty for ${asset.name} (${asset.assetId}) has expired today.`,
        link: `/dashboard/assets/${asset._id}`,
        read: false,
        metadata: {
          assetId: asset._id,
          assetName: asset.name,
          warrantyExpiry: asset.warrantyExpiry
        }
      }));

      // Bulk insert notifications
      await Notification.insertMany(notifications);
      console.log(`Created ${notifications.length} warranty expiry notifications for asset ${asset.assetId}`);
    }

    return {
      success: true,
      assetsChecked: expiredAssets.length,
      notificationsSent: expiredAssets.reduce((sum, asset) =>
        sum + (usersToNotify?.length || 0), 0
      )
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
        title: `Warranty Expiring Soon: ${asset.name}`,
        body: `The warranty for ${asset.name} (${asset.assetId}) will expire in ${daysRemaining} days.`,
        link: `/dashboard/assets/${asset._id}`,
        read: false,
        metadata: {
          assetId: asset._id,
          assetName: asset.name,
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

