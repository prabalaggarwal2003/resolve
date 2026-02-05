import crypto from 'crypto';

/**
 * Generate a device fingerprint from request headers and IP
 */
export function getDeviceFingerprint(req) {
  const userAgent = req.get('User-Agent') || '';
  const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || '';
  const acceptLanguage = req.get('Accept-Language') || '';
  const acceptEncoding = req.get('Accept-Encoding') || '';
  
  // Create a consistent fingerprint from available device info
  const fingerprint = crypto
    .createHash('sha256')
    .update(`${userAgent}|${ip}|${acceptLanguage}|${acceptEncoding}`)
    .digest('hex');
  
  return fingerprint;
}

/**
 * Check if device can report (10-minute cooldown)
 */
export async function canReport(deviceId, assetId) {
  const { RateLimit } = await import('../models/index.js');
  
  // Clean up old rate limit records (older than 10 minutes)
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  await RateLimit.deleteMany({ lastReportAt: { $lt: tenMinutesAgo } });
  
  // Check if this device has reported this asset recently
  const existingLimit = await RateLimit.findOne({
    deviceId,
    assetId,
    lastReportAt: { $gte: tenMinutesAgo }
  });
  
  if (existingLimit) {
    const timeRemainingMs = existingLimit.lastReportAt.getTime() + 10 * 60 * 1000 - Date.now();
    const timeRemaining = Math.ceil(timeRemainingMs / (60 * 1000)); // Convert milliseconds to minutes
    return { 
      canReport: false, 
      timeRemaining,
      nextReportAt: new Date(existingLimit.lastReportAt.getTime() + 10 * 60 * 1000)
    };
  }
  
  return { canReport: true };
}

/**
 * Record a report attempt for rate limiting
 */
export async function recordReportAttempt(deviceId, assetId, req) {
  const { RateLimit } = await import('../models/index.js');
  
  await RateLimit.create({
    deviceId,
    assetId,
    lastReportAt: new Date(),
    reportCount: 1,
    ipAddress: req.ip || req.connection.remoteAddress || req.socket.remoteAddress || '',
    userAgent: req.get('User-Agent') || '',
  });
}
