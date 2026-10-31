import Issue from '../models/Issue.js';
import { LEGACY_STATUS_MAP, mapLegacyCategoryToTypeId } from '../constants/issueDefaults.js';
import { ensureIssueOrgConfig } from './issueOrgConfigService.js';
import { ensureDefaultWorkflow } from './issueWorkflowService.js';

/**
 * One-time / lazy migration: map legacy statuses onto new statusIds and attach workflow.
 * Does not rewrite ticketId values.
 */
export async function migrateOrganizationIssues(organizationId) {
  await ensureIssueOrgConfig(organizationId);
  const workflow = await ensureDefaultWorkflow(organizationId);

  const issues = await Issue.find({
    organizationId,
    $or: [
      { status: { $in: ['open', 'completed'] } },
      { statusId: { $exists: false } },
      { statusId: null },
      { statusId: '' },
      { workflowId: { $exists: false } },
      { workflowId: null },
    ],
  })
    .select('_id status statusId category issueTypeId workflowId priority priorityId')
    .lean();

  let updated = 0;
  for (const issue of issues) {
    const statusId = LEGACY_STATUS_MAP[issue.status] || issue.statusId || issue.status || 'new';
    const needsStatusRewrite = issue.status !== statusId || issue.statusId !== statusId;
    const needsWorkflow = !issue.workflowId;
    const needsType = !issue.issueTypeId;
    if (!needsStatusRewrite && !needsWorkflow && !needsType) continue;

    const patch = {
      status: statusId,
      statusId,
      workflowId: issue.workflowId || workflow._id,
      workflowKey: 'default',
      issueTypeId: issue.issueTypeId || mapLegacyCategoryToTypeId(issue.category),
      priorityId: issue.priorityId || issue.priority || 'medium',
      priority: issue.priority || issue.priorityId || 'medium',
    };
    await Issue.updateOne({ _id: issue._id }, { $set: patch });
    updated += 1;
  }

  return { scanned: issues.length, updated };
}
