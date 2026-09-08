import cron from 'node-cron';
import { evaluateEscalations } from './issueEscalationService.js';

let started = false;

/**
 * Run escalation checks every 10 minutes.
 */
export function initIssueEscalationCronJobs() {
  if (started) return;
  started = true;

  cron.schedule(
    '*/10 * * * *',
    async () => {
      try {
        const result = await evaluateEscalations({ limit: 300 });
        if (result.fired > 0) {
          console.log(
            `[escalation] checked=${result.checked} fired=${result.fired}`
          );
        }
      } catch (err) {
        console.error('[escalation] evaluator failed:', err.message);
      }
    },
    { timezone: 'Asia/Kolkata' }
  );

  console.log('Issue escalation cron scheduled (every 10 minutes)');
}
