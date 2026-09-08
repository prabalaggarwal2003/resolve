import express from 'express';
import { Asset, Issue, Notification, User, Organization } from '../models/index.js';
import { generateTicketId } from '../services/ticketId.js';
import { getDeviceFingerprint, canReport, recordReportAttempt } from '../utils/rateLimiter.js';
import {
  loadAssetTemplate,
  resolveAssetPublicFields,
  pickAssetFieldValues,
} from '../services/assetPublicFieldService.js';

const router = express.Router();

/**
 * Public asset by ID — no auth. Used when someone scans the asset QR code.
 * Field visibility: template → asset fieldConfig overrides.
 */
router.get('/assets/:id', async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id)
      .populate('locationId', 'name path type code')
      .populate('departmentId', 'name')
      .populate('vendorId', 'name')
      .select(
        'name assetId category model serialNumber status condition tags customFields templateId fieldConfig organizationId maintenanceReason maintenanceStartDate maintenanceCompletedDate maintenanceHistory purchaseDate vendorId cost warrantyExpiry amcExpiry nextMaintenanceDate photos documents locationId departmentId assignedToName assignedToEmployeeCode'
      )
      .lean();
    if (!asset) return res.status(404).json({ message: 'Asset not found' });

    const template = await loadAssetTemplate(asset);
    const { qrSections, visibleFields } = resolveAssetPublicFields(asset, template, 'qr');

    const visibleKeySet = new Set(visibleFields.map((f) => f.key));
    // Always keep identity header fields
    ['name', 'assetId', 'category', 'status'].forEach((k) => visibleKeySet.add(k));

    const customFields = {};
    if (asset.customFields && typeof asset.customFields === 'object') {
      for (const [key, value] of Object.entries(asset.customFields)) {
        if (visibleKeySet.has(key)) customFields[key] = value;
      }
    }

    const org = asset.organizationId
      ? await Organization.findById(asset.organizationId).select('currency timezone').lean()
      : null;

    const publicAsset = {
      _id: asset._id,
      name: asset.name,
      assetId: asset.assetId,
      category: asset.category,
      status: asset.status,
      currency: org?.currency || 'INR',
      timezone: org?.timezone || 'Asia/Kolkata',
      model: visibleKeySet.has('model') ? asset.model : undefined,
      serialNumber: visibleKeySet.has('serialNumber') ? asset.serialNumber : undefined,
      condition: visibleKeySet.has('condition') ? asset.condition : undefined,
      tags: visibleKeySet.has('tags') ? asset.tags : undefined,
      assignedToName: visibleKeySet.has('assignedToName') ? asset.assignedToName : undefined,
      assignedToEmployeeCode: visibleKeySet.has('assignedToEmployeeCode')
        ? asset.assignedToEmployeeCode
        : undefined,
      locationId: visibleKeySet.has('locationId') ? asset.locationId : undefined,
      departmentId: visibleKeySet.has('departmentId') ? asset.departmentId : undefined,
      purchaseDate: visibleKeySet.has('purchaseDate') ? asset.purchaseDate : undefined,
      warrantyExpiry: visibleKeySet.has('warrantyExpiry') ? asset.warrantyExpiry : undefined,
      amcExpiry: visibleKeySet.has('amcExpiry') ? asset.amcExpiry : undefined,
      nextMaintenanceDate: visibleKeySet.has('nextMaintenanceDate') ? asset.nextMaintenanceDate : undefined,
      cost: visibleKeySet.has('cost') ? asset.cost : undefined,
      vendorId: visibleKeySet.has('vendorId') ? asset.vendorId : undefined,
      vendor: visibleKeySet.has('vendorId') && asset.vendorId?.name ? asset.vendorId.name : undefined,
      customFields: Object.keys(customFields).length ? customFields : undefined,
      photos: qrSections.photos ? asset.photos : [],
      documents: qrSections.documents ? asset.documents : [],
      maintenanceReason: qrSections.maintenance ? asset.maintenanceReason : undefined,
      maintenanceStartDate: qrSections.maintenance ? asset.maintenanceStartDate : undefined,
      maintenanceCompletedDate: qrSections.maintenance ? asset.maintenanceCompletedDate : undefined,
      maintenanceHistory: qrSections.maintenance ? asset.maintenanceHistory : [],
      qrView: {
        sections: qrSections,
        fields: visibleFields,
      },
    };

    let previousIssues = [];
    if (qrSections.issues) {
      const issues = await Issue.find({ assetId: req.params.id })
        .select('ticketId title status statusId createdAt reports')
        .sort({ createdAt: -1 })
        .lean();

      previousIssues = issues.map((issue) => ({
        ticketId: issue.ticketId,
        title: issue.title,
        status: issue.statusId || issue.status,
        createdAt: issue.createdAt,
        reportCount: (issue.reports || []).length,
      }));
    }

    publicAsset.previousIssues = previousIssues;

    res.json(publicAsset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * Public report page - shows asset and previous issues
 */
router.get('/report', async (req, res) => {
  try {
    const { assetId, assetName } = req.query;
    if (!assetId) {
      return res.status(400).json({ message: 'Asset ID is required' });
    }
    
    const asset = await Asset.findById(assetId)
      .populate('locationId', 'name path type code')
      .populate('departmentId', 'name')
      .select(
        'name assetId category model serialNumber status condition maintenanceReason maintenanceStartDate maintenanceCompletedDate maintenanceHistory purchaseDate vendor cost warrantyExpiry amcExpiry nextMaintenanceDate photos documents locationId departmentId assignedToName assignedToEmployeeCode'
      )
      .lean();
    if (!asset) return res.status(404).json({ message: 'Asset not found' });
    
    // Get previous issues for this asset (public — no reporter PII)
    const previousIssues = await Issue.find({
      assetId: assetId,
    })
      .select('ticketId title status statusId createdAt reports')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      asset,
      previousIssues: previousIssues.map((issue) => ({
        ticketId: issue.ticketId,
        title: issue.title,
        status: issue.statusId || issue.status,
        createdAt: issue.createdAt,
        reportCount: (issue.reports || []).length,
      })),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * Public report config for an asset — issue types + form fields for the org.
 */
router.get('/report-config', async (req, res) => {
  try {
    const { assetId } = req.query;
    if (!assetId) return res.status(400).json({ message: 'Asset ID is required' });

    const asset = await Asset.findById(assetId)
      .populate('locationId', 'name path')
      .populate('departmentId', 'name')
      .populate('vendorId', 'name')
      .select(
        'name assetId category model serialNumber status condition tags customFields templateId fieldConfig organizationId locationId departmentId assignedToName assignedToEmployeeCode purchaseDate warrantyExpiry amcExpiry nextMaintenanceDate cost vendorId'
      )
      .lean();
    if (!asset) return res.status(404).json({ message: 'Asset not found' });

    const { ensureIssueOrgConfig } = await import('../services/issueOrgConfigService.js');
    const { OPEN_STATUS_IDS } = await import('../constants/issueDefaults.js');
    const config = await ensureIssueOrgConfig(asset.organizationId);

    const template = await loadAssetTemplate(asset);
    const { visibleFields: assetFields } = resolveAssetPublicFields(asset, template, 'report');
    const assetFieldValues = pickAssetFieldValues(
      asset,
      assetFields.map((f) => f.key)
    );
    // Flatten populated refs for display
    if (assetFieldValues.locationId?.name) {
      assetFieldValues.locationId = {
        _id: assetFieldValues.locationId._id,
        name: assetFieldValues.locationId.name,
        path: assetFieldValues.locationId.path,
      };
    }
    if (assetFieldValues.departmentId?.name) {
      assetFieldValues.departmentId = {
        _id: assetFieldValues.departmentId._id,
        name: assetFieldValues.departmentId.name,
      };
    }
    if (assetFieldValues.vendorId?.name) {
      assetFieldValues.vendorId = {
        _id: assetFieldValues.vendorId._id,
        name: assetFieldValues.vendorId.name,
      };
      assetFieldValues.vendor = assetFieldValues.vendorId.name;
    }

    const issueTypeFilter = req.query.issueTypeId || req.query.issueType;
    const openFilter = {
      assetId,
      organizationId: asset.organizationId,
      $and: [
        {
          $or: [
            { status: { $in: OPEN_STATUS_IDS } },
            { statusId: { $in: OPEN_STATUS_IDS } },
          ],
        },
      ],
    };
    if (issueTypeFilter) {
      openFilter.$and.push({
        $or: [{ issueTypeId: issueTypeFilter }, { category: issueTypeFilter }],
      });
    }

    const openTickets = await Issue.find(openFilter)
      .select(
        'ticketId title status statusId issueTypeId priorityId createdAt updatedAt assigneeUserId assignedTo assigneeGroupId reports'
      )
      .populate('assignedTo', 'name')
      .populate('assigneeUserId', 'name')
      .populate('assigneeGroupId', 'name')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    // Prefer public-facing types; exclude pure legacy aliases if org has primary types
    const issueTypes = (config.issueTypes || []).map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      color: t.color,
      isDefault: t.isDefault,
      formFields: t.formFields || [],
    }));

    res.json({
      asset: {
        _id: asset._id,
        name: asset.name,
        assetId: asset.assetId,
        category: asset.category,
        status: asset.status,
        locationId: asset.locationId,
        templateName: template?.name || asset.category,
      },
      /** Resolved asset fields for the report page (template + asset overrides), separate from issue formFields */
      assetFields: assetFields.map((f) => ({
        key: f.key,
        label: f.label,
        type: f.type,
        required: Boolean(f.required) && f.readonly === false,
        order: f.order,
        section: f.section,
        builtIn: Boolean(f.builtIn),
        readonly: f.readonly !== false,
        options: f.options || [],
        source: f.source,
      })),
      assetFieldValues,
      issueTypes,
      priorities: config.priorities || [],
      severities: config.severities || [],
      openTickets: openTickets.map((t) => ({
        _id: t._id,
        ticketId: t.ticketId,
        title: t.title,
        status: t.statusId || t.status,
        statusId: t.statusId || t.status,
        issueTypeId: t.issueTypeId,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        reportCount: (t.reports || []).length,
        assigneeName:
          t.assigneeUserId?.name || t.assignedTo?.name || t.assigneeGroupId?.name || null,
      })),
      settings: {
        defaultIssueTypeId: config.settings?.defaultIssueTypeId,
        defaultPriorityId: config.settings?.defaultPriorityId,
      },
      hasEmployeeRoster: await (
        await import('../services/reportVerificationService.js')
      ).orgHasEmployeeRoster(asset.organizationId),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * Lookup employee by ID for roster-gated reporting (masked email).
 */
router.post('/report/lookup-employee', async (req, res) => {
  try {
    const { assetId, employeeId } = req.body;
    if (!assetId || !employeeId?.trim()) {
      return res.status(400).json({ message: 'Asset and employee ID are required' });
    }
    const asset = await Asset.findById(assetId).select('organizationId').lean();
    if (!asset) return res.status(404).json({ message: 'Asset not found' });

    const {
      orgHasEmployeeRoster,
      findActiveEmployee,
      maskEmail,
    } = await import('../services/reportVerificationService.js');

    const hasRoster = await orgHasEmployeeRoster(asset.organizationId);
    if (!hasRoster) {
      return res.status(400).json({ message: 'This organization does not use an employee roster' });
    }

    const emp = await findActiveEmployee(asset.organizationId, employeeId);
    if (!emp || !emp.email) {
      return res.status(404).json({ message: 'Employee ID not found' });
    }

    res.json({
      employeeId: emp.employeeId,
      name: emp.name,
      emailMasked: maskEmail(emp.email),
      phone: emp.phone || '',
      department: emp.department || '',
      team: emp.team || '',
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

/**
 * Send OTP for public report verification.
 * Roster mode: { assetId, employeeId }
 * Guest mode: { assetId, email, name } — rejected if roster exists
 */
router.post('/report/send-otp', async (req, res) => {
  try {
    const { assetId, employeeId, email, name } = req.body;
    if (!assetId) return res.status(400).json({ message: 'Asset is required' });

    const asset = await Asset.findById(assetId).select('organizationId name assetId').lean();
    if (!asset) return res.status(404).json({ message: 'Asset not found' });

    const { Otp } = await import('../models/index.js');
    const {
      generateOtp,
      hashOtp,
      getOtpExpiry,
      sendPublicReportOtpEmail,
    } = await import('../services/otpService.js');
    const {
      orgHasEmployeeRoster,
      findActiveEmployee,
      maskEmail,
    } = await import('../services/reportVerificationService.js');
    const { validateEmail } = await import('../utils/validation.js');

    const hasRoster = await orgHasEmployeeRoster(asset.organizationId);

    let resolvedEmail = '';
    let resolvedName = '';
    let resolvedEmployeeId = '';
    let contactId = null;
    let phone = '';

    if (hasRoster) {
      if (!employeeId?.trim()) {
        return res.status(400).json({ message: 'Employee ID is required' });
      }
      const emp = await findActiveEmployee(asset.organizationId, employeeId);
      if (!emp?.email) {
        return res.status(404).json({ message: 'Employee ID not found' });
      }
      resolvedEmail = emp.email.toLowerCase();
      resolvedName = emp.name;
      resolvedEmployeeId = emp.employeeId;
      contactId = emp._id;
      phone = emp.phone || '';
    } else {
      resolvedEmail = String(email || '')
        .trim()
        .toLowerCase();
      resolvedName = String(name || '').trim();
      resolvedEmployeeId = '';
      if (!resolvedName) return res.status(400).json({ message: 'Name is required' });
      if (!resolvedEmail) return res.status(400).json({ message: 'Email is required' });
      const emailErr = validateEmail(resolvedEmail);
      if (emailErr) {
        return res.status(400).json({ message: emailErr });
      }
    }

    await Otp.deleteMany({ email: resolvedEmail, purpose: 'public_report' });

    const code = generateOtp();
    const codeHash = await hashOtp(code);
    const otpRecord = await Otp.create({
      email: resolvedEmail,
      purpose: 'public_report',
      codeHash,
      expiresAt: getOtpExpiry(),
      tempData: {
        organizationId: asset.organizationId,
        assetId: asset._id,
        name: resolvedName,
        email: resolvedEmail,
        employeeId: resolvedEmployeeId,
        contactId,
        phone,
      },
    });

    try {
      const sendResult = await sendPublicReportOtpEmail(resolvedEmail, code);
      res.json({
        message: sendResult?.devFallback
          ? 'Verification code ready (email delivery unavailable — use the code shown)'
          : 'Verification code sent',
        emailMasked: maskEmail(resolvedEmail),
        name: resolvedName,
        expiresInMinutes: 10,
        // Non-production only: when Brevo is missing/fails, return code for testing
        ...(sendResult?.devFallback ? { devOtp: code } : {}),
      });
    } catch (sendErr) {
      await Otp.deleteOne({ _id: otpRecord._id });
      throw sendErr;
    }
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

/**
 * Verify OTP and return short-lived reportVerificationToken.
 */
router.post('/report/verify-otp', async (req, res) => {
  try {
    const { assetId, email, code, employeeId } = req.body;
    if (!assetId || !code) {
      return res.status(400).json({ message: 'Asset and verification code are required' });
    }

    const asset = await Asset.findById(assetId).select('organizationId').lean();
    if (!asset) return res.status(404).json({ message: 'Asset not found' });

    const { Otp } = await import('../models/index.js');
    const { verifyOtpHash } = await import('../services/otpService.js');
    const {
      orgHasEmployeeRoster,
      findActiveEmployee,
      signReportVerificationToken,
      maskEmail,
    } = await import('../services/reportVerificationService.js');

    const hasRoster = await orgHasEmployeeRoster(asset.organizationId);
    let lookupEmail = String(email || '')
      .trim()
      .toLowerCase();

    if (hasRoster) {
      const emp = await findActiveEmployee(asset.organizationId, employeeId || '');
      if (!emp?.email) {
        return res.status(404).json({ message: 'Employee ID not found' });
      }
      lookupEmail = emp.email.toLowerCase();
    }
    if (!lookupEmail) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const otp = await Otp.findOne({ email: lookupEmail, purpose: 'public_report' }).sort({
      createdAt: -1,
    });
    if (!otp) {
      return res.status(400).json({ message: 'No verification code found. Request a new one.' });
    }
    if (otp.expiresAt && otp.expiresAt.getTime() < Date.now()) {
      await Otp.deleteOne({ _id: otp._id });
      return res.status(400).json({ message: 'Verification code expired. Request a new one.' });
    }
    if (String(otp.tempData?.assetId) !== String(asset._id)) {
      return res.status(400).json({ message: 'Verification does not match this asset' });
    }

    const codeValid = await verifyOtpHash(String(code).trim(), otp.codeHash);
    if (!codeValid) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    const token = signReportVerificationToken({
      organizationId: asset.organizationId,
      assetId: asset._id,
      email: otp.tempData?.email || lookupEmail,
      name: otp.tempData?.name || '',
      employeeId: otp.tempData?.employeeId || '',
      contactId: otp.tempData?.contactId || '',
      phone: otp.tempData?.phone || '',
    });

    await Otp.deleteOne({ _id: otp._id });

    res.json({
      reportVerificationToken: token,
      reporterName: otp.tempData?.name || '',
      reporterEmail: otp.tempData?.email || lookupEmail,
      reporterEmailMasked: maskEmail(otp.tempData?.email || lookupEmail),
      reporterPhone: otp.tempData?.phone || '',
      employeeId: otp.tempData?.employeeId || '',
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

/**
 * Public report submission (no auth).
 * Pass existingTicketId to add a report to an open ticket; otherwise create a new ticket.
 * Does NOT auto-merge by asset+type+date.
 * Requires reportVerificationToken from OTP verify.
 */
router.post('/report', async (req, res) => {
  try {
    const {
      assetId,
      reporterName,
      reporterEmail,
      reporterPhone,
      issueType,
      title,
      description,
      photos,
      customFields,
      priorityId,
      severityId,
      formValues,
      existingTicketId,
      assetFieldValues: assetFieldInput,
      reportVerificationToken,
      employeeId: bodyEmployeeId,
    } = req.body;

    const asset = await Asset.findById(assetId).lean();
    if (!asset) return res.status(404).json({ message: 'Asset not found' });

    const { verifyReportVerificationToken } = await import(
      '../services/reportVerificationService.js'
    );
    let verified;
    try {
      verified = verifyReportVerificationToken(reportVerificationToken, {
        assetId: asset._id,
        organizationId: asset.organizationId,
      });
    } catch (verr) {
      return res.status(verr.status || 401).json({ message: verr.message });
    }

    const finalName = verified.name || reporterName;
    const finalEmail = verified.email;
    const finalPhone = verified.phone || reporterPhone || '';
    const finalEmployeeId = verified.employeeId || bodyEmployeeId || '';

    if (!assetId || !finalName || !finalEmail) {
      return res.status(400).json({
        message: 'Asset, your name, and email are required',
      });
    }

    const deviceId = getDeviceFingerprint(req);
    const rateLimitCheck = await canReport(deviceId, assetId);

    if (!rateLimitCheck.canReport) {
      return res.status(429).json({
        message: `You can report again after ${rateLimitCheck.timeRemaining} minutes`,
        nextReportAt: rateLimitCheck.nextReportAt,
        timeRemaining: rateLimitCheck.timeRemaining,
      });
    }

    const { ensureIssueOrgConfig } = await import('../services/issueOrgConfigService.js');
    const { ensureDefaultWorkflow } = await import('../services/issueWorkflowService.js');
    const { mapLegacyCategoryToTypeId, OPEN_STATUS_IDS } = await import('../constants/issueDefaults.js');
    const { recordIssueActivity } = await import('../services/issueActivityService.js');
    const { buildReportEntry, publicReportProgress } = await import('../services/issueReportService.js');

    const config = await ensureIssueOrgConfig(asset.organizationId);
    const typeId = mapLegacyCategoryToTypeId(issueType || config.settings?.defaultIssueTypeId || 'other');
    const typeDef = (config.issueTypes || []).find((t) => t.id === typeId);
    const values = { ...(formValues || {}), ...(customFields || {}) };

    const desc =
      (description && String(description).trim()) ||
      (values.description && String(values.description).trim()) ||
      '';

    const template = await loadAssetTemplate(asset);
    const { visibleFields: reportAssetFields } = resolveAssetPublicFields(asset, template, 'report');
    const submittedAssetFields =
      assetFieldInput && typeof assetFieldInput === 'object' ? assetFieldInput : {};

    const fieldErrors = [];
    for (const field of typeDef?.formFields || []) {
      const visible = isFieldVisible(field, values);
      if (!visible) continue;
      if (!field.required) continue;
      if (field.key === 'description' && desc) continue;
      if (field.key === 'priority') continue;
      const val = values[field.key];
      if (val == null || val === '' || (Array.isArray(val) && !val.length)) {
        fieldErrors.push(field.label || field.key);
      }
    }
    // Required editable asset-context fields (do not mutate the asset)
    const assetContext = {};
    for (const field of reportAssetFields) {
      if (field.readonly !== false) continue;
      const val = submittedAssetFields[field.key];
      if (field.required && (val == null || val === '' || (Array.isArray(val) && !val.length))) {
        fieldErrors.push(field.label || field.key);
        continue;
      }
      if (val !== undefined && val !== null && val !== '') {
        assetContext[field.key] = val;
      }
    }
    if (!desc) fieldErrors.push('Description');
    if (fieldErrors.length) {
      return res.status(400).json({
        message: `Missing required fields: ${fieldErrors.join(', ')}`,
      });
    }

    const category = typeId;
    const storedCustom = { ...values };
    delete storedCustom.description;
    delete storedCustom.priority;
    if (Object.keys(assetContext).length) {
      storedCustom._assetContext = assetContext;
    }
    if (finalEmployeeId) {
      storedCustom._employeeId = finalEmployeeId;
    }

    const reportEntry = await buildReportEntry({
      organizationId: asset.organizationId,
      reporterName: finalName,
      reporterEmail: finalEmail,
      reporterPhone: finalPhone,
      description: desc,
      photos,
      customFields: storedCustom,
    });

    // Explicit add to existing open ticket
    if (existingTicketId) {
      const existing = await Issue.findOne({
        ticketId: String(existingTicketId).trim(),
        organizationId: asset.organizationId,
        assetId,
      })
        .populate('assignedTo', 'name')
        .populate('assigneeUserId', 'name')
        .lean();

      if (!existing) {
        return res.status(404).json({ message: 'Ticket not found for this asset' });
      }
      const statusId = existing.statusId || existing.status;
      if (!OPEN_STATUS_IDS.includes(statusId)) {
        return res.status(400).json({
          message: 'That ticket is no longer open. Please create a new ticket.',
        });
      }

      await Issue.updateOne({ _id: existing._id }, { $push: { reports: reportEntry } });
      try {
        await recordIssueActivity({
          issueId: existing._id,
          organizationId: asset.organizationId,
          type: 'report_merged',
          actorName: reportEntry.reporterName,
          actorKind: 'public',
          reason: `New report added by ${reportEntry.reporterName}`,
          meta: {
            reportId: reportEntry.reportId,
            reporterEmail: reportEntry.reporterEmail,
            action: 'report_added',
          },
        });
      } catch {
        /* best-effort */
      }

      const notifyIds = [
        existing.assigneeUserId?._id || existing.assigneeUserId,
        existing.assignedTo?._id || existing.assignedTo,
        asset.assignedTo,
      ].filter(Boolean);
      if (notifyIds.length) {
        await Notification.insertMany(
          [...new Set(notifyIds.map((id) => id.toString()))].map((userId) => ({
            userId,
            type: 'report_submitted',
            title: 'New report on ticket',
            body: `${existing.ticketId} — new report from ${reportEntry.reporterName}`,
            link: `/dashboard/issues/${existing._id}`,
            metadata: { issueId: existing._id, reportId: reportEntry.reportId },
          }))
        );
      }

      await recordReportAttempt(deviceId, assetId, req);
      const progress = publicReportProgress(statusId);

      return res.status(201).json({
        merged: true,
        message: 'Your report was added to the existing ticket.',
        ticketId: existing.ticketId,
        issueId: existing._id,
        reportId: reportEntry.reportId,
        trackingToken: reportEntry.trackingToken,
        trackUrl: `/track/${reportEntry.trackingToken}`,
        status: statusId,
        assigneeName: existing.assigneeUserId?.name || existing.assignedTo?.name || null,
        progress,
        yourReport: reportEntry.description,
      });
    }

    const workflow = await ensureDefaultWorkflow(asset.organizationId);
    const initialStatus =
      config.statuses?.find((s) => s.isDefault)?.id || workflow.stages?.[0] || 'new';
    const prio =
      priorityId || values.priority || config.settings?.defaultPriorityId || 'medium';
    const sev = severityId || config.settings?.defaultSeverityId || 'medium';

    const ticketId = await generateTicketId(asset.organizationId);
    const typeName = typeDef?.name || category.replace(/_/g, ' ');
    const displayTitle = title?.trim() || `${typeName} — ${asset.name}`;
    const issue = await Issue.create({
      ticketId,
      assetId,
      organizationId: asset.organizationId,
      title: displayTitle,
      description: reportEntry.description,
      category,
      issueTypeId: typeId,
      status: initialStatus,
      statusId: initialStatus,
      priority: prio,
      priorityId: prio,
      severityId: sev,
      workflowId: workflow._id,
      workflowKey: workflow.key,
      customFields: storedCustom,
      reporterName: reportEntry.reporterName,
      reporterEmail: reportEntry.reporterEmail,
      reporterPhone: reportEntry.reporterPhone,
      photos: reportEntry.photos,
      reports: [reportEntry],
      locationId: asset.locationId,
    });

    await recordIssueActivity({
      issueId: issue._id,
      organizationId: asset.organizationId,
      type: 'created',
      actorName: reportEntry.reporterName,
      actorKind: 'public',
      to: initialStatus,
      meta: {
        ticketId,
        issueTypeId: typeId,
        source: 'public_report',
        reportId: reportEntry.reportId,
      },
    });

    try {
      const { applyAutoAssignOnCreate } = await import('../services/issueAutomationService.js');
      await applyAutoAssignOnCreate(issue, asset);
    } catch (err) {
      console.error('Auto-assign failed:', err.message);
    }

    const admins = await User.find({
      role: { $in: ['super_admin', 'admin', 'manager', 'principal'] },
      isActive: true,
      organizationId: asset.organizationId,
    })
      .limit(50)
      .select('_id')
      .lean();
    const notifyUserIds = [
      ...new Set([...admins.map((u) => u._id.toString()), asset.assignedTo?.toString()].filter(Boolean)),
    ];
    const assignedUserIdStr = asset.assignedTo?.toString();
    await Notification.insertMany(
      notifyUserIds.map((userId) => ({
        userId,
        type: 'report_submitted',
        title: userId === assignedUserIdStr ? 'New report on your asset' : 'New report submitted',
        body: `${ticketId} — ${asset.name}`,
        link: `/dashboard/issues/${issue._id}`,
        metadata: { issueId: issue._id, reportId: reportEntry.reportId },
      }))
    );

    await recordReportAttempt(deviceId, assetId, req);
    const progress = publicReportProgress(initialStatus);

    return res.status(201).json({
      merged: false,
      message: 'Thank you. Your report has been logged.',
      ticketId: issue.ticketId,
      issueId: issue._id,
      reportId: reportEntry.reportId,
      trackingToken: reportEntry.trackingToken,
      trackUrl: `/track/${reportEntry.trackingToken}`,
      status: initialStatus,
      assigneeName: null,
      progress,
      yourReport: reportEntry.description,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * Public track report by secure token (no login).
 */
router.get('/track/:token', async (req, res) => {
  try {
    const token = String(req.params.token || '').trim();
    if (!token || token.length < 16) {
      return res.status(400).json({ message: 'Invalid tracking token' });
    }

    const issue = await Issue.findOne({ 'reports.trackingToken': token })
      .populate('assetId', 'name assetId')
      .populate('assignedTo', 'name')
      .populate('assigneeUserId', 'name')
      .populate('assigneeGroupId', 'name')
      .populate('assigneeDepartmentId', 'name')
      .lean();

    if (!issue) return res.status(404).json({ message: 'Report not found' });

    const report = (issue.reports || []).find((r) => r.trackingToken === token);
    if (!report) return res.status(404).json({ message: 'Report not found' });

    const { publicReportProgress } = await import('../services/issueReportService.js');
    const { ensureIssueOrgConfig } = await import('../services/issueOrgConfigService.js');
    const config = await ensureIssueOrgConfig(issue.organizationId);
    const statusId = issue.statusId || issue.status;
    const statusOpt = (config.statuses || []).find((s) => s.id === statusId);
    const progress = publicReportProgress(statusId);

    // Never expose other reporters, internal notes, or private fields
    res.json({
      reportId: report.reportId,
      ticketId: issue.ticketId,
      title: issue.title,
      status: statusId,
      statusName: statusOpt?.name || progress.statusLabel,
      assigneeName:
        issue.assigneeUserId?.name ||
        issue.assignedTo?.name ||
        issue.assigneeGroupId?.name ||
        issue.assigneeDepartmentId?.name ||
        null,
      lastUpdated: issue.updatedAt,
      asset: issue.assetId
        ? { name: issue.assetId.name, assetId: issue.assetId.assetId }
        : null,
      yourReport: {
        description: report.description,
        createdAt: report.createdAt,
        status: report.status || 'new',
        acknowledgedAt: report.acknowledgedAt || null,
        photos: (report.photos || []).map((p) => ({ url: p.url })),
        followUps: (report.followUps || []).map((f) => ({
          note: f.note,
          createdAt: f.createdAt,
        })),
      },
      progress,
      trackingToken: token,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * Reporter requests attention / reopen after resolution (token-gated).
 */
router.post('/track/:token/attention', async (req, res) => {
  try {
    const token = String(req.params.token || '').trim();
    const note = String(req.body.note || req.body.reason || '').trim();
    if (!token) return res.status(400).json({ message: 'Invalid tracking token' });
    if (!note) {
      return res.status(400).json({ message: 'Please describe the problem that is still there' });
    }

    const issue = await Issue.findOne({ 'reports.trackingToken': token }).lean();
    if (!issue) return res.status(404).json({ message: 'Report not found' });
    const report = (issue.reports || []).find((r) => r.trackingToken === token);
    if (!report) return res.status(404).json({ message: 'Report not found' });

    const followUp = { note, createdAt: new Date() };

    // Append follow-up on the report and mark it new again for the assignee
    await Issue.updateOne(
      { _id: issue._id, 'reports.trackingToken': token },
      {
        $push: { 'reports.$.followUps': followUp },
        $set: {
          'reports.$.status': 'new',
          'reports.$.acknowledgedAt': null,
          'reports.$.acknowledgedBy': null,
        },
      }
    );

    const { recordIssueActivity } = await import('../services/issueActivityService.js');
    await recordIssueActivity({
      issueId: issue._id,
      organizationId: issue.organizationId,
      type: 'field_updated',
      actorName: report.reporterName,
      actorKind: 'public',
      reason: note,
      meta: {
        fields: ['reporter_attention'],
        reportId: report.reportId,
        ticketStatus: issue.statusId || issue.status,
        followUpAt: followUp.createdAt,
      },
    });

    res.json({
      message: 'Your note was added. The team will review this ticket.',
      ticketId: issue.ticketId,
      reportId: report.reportId,
      followUp,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

function isFieldVisible(field, values) {
  if (!field.showWhen?.field) return true;
  const current = values[field.showWhen.field];
  if (field.showWhen.equals !== undefined) {
    return current === field.showWhen.equals || String(current) === String(field.showWhen.equals);
  }
  if (field.showWhen.notEquals !== undefined) {
    return current !== field.showWhen.notEquals && String(current) !== String(field.showWhen.notEquals);
  }
  return Boolean(current);
}

// Import public issues routes
import publicIssuesRouter from './public/issues.js';
router.use('/issues', publicIssuesRouter);

export default router;
