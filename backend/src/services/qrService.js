import QRCode from 'qrcode';

/**
 * Generate a QR code as a data URL (PNG base64) for the given URL.
 * Used for asset labels — scanning opens the asset page on the frontend.
 */
export async function generateQrDataUrl(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    return await QRCode.toDataURL(url, {
      type: 'image/png',
      width: 256,
      margin: 2,
      errorCorrectionLevel: 'M',
    });
  } catch (err) {
    console.error('QR generation failed:', err.message);
    return null;
  }
}

/**
 * Build the public URL for an asset (used in QR code).
 * Set FRONTEND_URL in .env — for phone scanning use your LAN IP or ngrok, e.g. http://192.168.1.5:3000
 */
export function getAssetPublicUrl(assetId, baseUrl) {
  const base = (baseUrl || process.env.FRONTEND_URL || 'https://resolve-ten.vercel.app').replace(/\/$/, '');
  return `${base}/a/${assetId}`;
}
