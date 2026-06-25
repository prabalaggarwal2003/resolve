import { apiUrl, authHeaders } from './api';

export async function trackDownload(
  fileName: string,
  resource: string,
  resourceName?: string
): Promise<void> {
  try {
    await fetch(apiUrl('/audit-logs/track-download'), {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        fileName,
        resource,
        resourceName: resourceName || fileName,
      }),
    });
  } catch {
    // Non-blocking: download already succeeded for the user
  }
}
