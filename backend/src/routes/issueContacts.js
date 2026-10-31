import express from 'express';
import { Contact, ContactGroup } from '../models/index.js';
import { protect } from '../middleware/auth.js';
import { requireTabRead, requireTabWrite } from '../middleware/tabPermissions.js';
import { listAssignablePeople } from '../services/issueAssignmentService.js';

const router = express.Router();

router.use(protect);

/** GET /api/issues/assignees — org users + contacts + teams for assignment */
router.get('/assignees', requireTabRead('issues'), async (req, res) => {
  try {
    const data = await listAssignablePeople(req.user.organizationId);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.get('/contacts', requireTabRead('issues'), async (req, res) => {
  try {
    const { active, q, kind } = req.query;
    const filter = { organizationId: req.user.organizationId };
    // Default contacts list excludes employee roster
    if (kind === 'employee') filter.kind = 'employee';
    else if (kind === 'all') {
      /* no kind filter */
    } else filter.kind = { $ne: 'employee' };
    if (active === 'true') filter.isActive = true;
    if (active === 'false') filter.isActive = false;
    if (q) {
      const re = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { name: re },
        { email: re },
        { company: re },
        { role: re },
        { employeeId: re },
        { department: re },
        { team: re },
      ];
    }
    const contacts = await Contact.find(filter).sort({ name: 1 }).limit(500).lean();
    res.json({ contacts });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** GET /api/issues/employees — employee roster only */
router.get('/employees', requireTabRead('issues'), async (req, res) => {
  try {
    const { active, q } = req.query;
    const filter = {
      organizationId: req.user.organizationId,
      kind: 'employee',
    };
    if (active === 'true') filter.isActive = true;
    if (active === 'false') filter.isActive = false;
    if (q) {
      const re = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { name: re },
        { email: re },
        { employeeId: re },
        { department: re },
        { team: re },
        { phone: re },
      ];
    }
    const employees = await Contact.find(filter).sort({ name: 1 }).limit(1000).lean();
    res.json({ employees });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** POST /api/issues/employees — manual add to roster */
router.post('/employees', requireTabWrite('issues'), async (req, res) => {
  try {
    const { employeeId, name, email, phone, department, team, isActive, notes } = req.body;
    if (!employeeId?.trim()) return res.status(400).json({ message: 'Employee ID is required' });
    if (!name?.trim()) return res.status(400).json({ message: 'Name is required' });
    if (!email?.trim()) return res.status(400).json({ message: 'Email is required' });

    const existing = await Contact.findOne({
      organizationId: req.user.organizationId,
      employeeId: String(employeeId).trim(),
    });
    if (existing) {
      return res.status(409).json({ message: 'An employee with this ID already exists' });
    }

    const employee = await Contact.create({
      organizationId: req.user.organizationId,
      kind: 'employee',
      source: 'manual',
      employeeId: String(employeeId).trim(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim?.() || '',
      department: department?.trim?.() || '',
      team: team?.trim?.() || '',
      isActive: isActive !== false,
      notes: notes || '',
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });
    res.status(201).json({ employee });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'An employee with this ID already exists' });
    }
    res.status(500).json({ message: err.message });
  }
});

/** PATCH /api/issues/employees/:id */
router.patch('/employees/:id', requireTabWrite('issues'), async (req, res) => {
  try {
    const employee = await Contact.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      kind: 'employee',
    });
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const fields = ['name', 'email', 'phone', 'department', 'team', 'notes', 'employeeId'];
    for (const key of fields) {
      if (req.body[key] !== undefined) employee[key] = String(req.body[key]).trim();
    }
    if (employee.email) employee.email = employee.email.toLowerCase();
    if (req.body.isActive !== undefined) employee.isActive = Boolean(req.body.isActive);
    employee.kind = 'employee';
    employee.updatedBy = req.user._id;
    await employee.save();
    res.json({ employee });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'An employee with this ID already exists' });
    }
    res.status(500).json({ message: err.message });
  }
});

/** DELETE /api/issues/employees/:id — soft deactivate */
router.delete('/employees/:id', requireTabWrite('issues'), async (req, res) => {
  try {
    const employee = await Contact.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.user.organizationId, kind: 'employee' },
      { $set: { isActive: false, updatedBy: req.user._id } },
      { new: true }
    );
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    res.json({ employee });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** POST /api/issues/contacts */
router.post('/contacts', requireTabWrite('issues'), async (req, res) => {
  try {
    const { name, email, phone, company, role, isActive, notes } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Name is required' });
    const contact = await Contact.create({
      organizationId: req.user.organizationId,
      kind: 'contact',
      name: name.trim(),
      email: email?.trim?.() || '',
      phone: phone?.trim?.() || '',
      company: company?.trim?.() || '',
      role: role?.trim?.() || '',
      isActive: isActive !== false,
      notes: notes || '',
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });
    res.status(201).json({ contact });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** PATCH /api/issues/contacts/:id */
router.patch('/contacts/:id', requireTabWrite('issues'), async (req, res) => {
  try {
    const contact = await Contact.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });
    if (!contact) return res.status(404).json({ message: 'Contact not found' });

    const fields = ['name', 'email', 'phone', 'company', 'role', 'notes'];
    for (const key of fields) {
      if (req.body[key] !== undefined) contact[key] = String(req.body[key]).trim();
    }
    if (req.body.isActive !== undefined) contact.isActive = Boolean(req.body.isActive);
    contact.updatedBy = req.user._id;
    await contact.save();
    res.json({ contact });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** DELETE /api/issues/contacts/:id — soft deactivate */
router.delete('/contacts/:id', requireTabWrite('issues'), async (req, res) => {
  try {
    const contact = await Contact.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.user.organizationId },
      { $set: { isActive: false, updatedBy: req.user._id } },
      { new: true }
    );
    if (!contact) return res.status(404).json({ message: 'Contact not found' });
    res.json({ contact });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** GET /api/issues/groups */
router.get('/groups', requireTabRead('issues'), async (req, res) => {
  try {
    const filter = { organizationId: req.user.organizationId };
    if (req.query.active === 'true') filter.isActive = true;
    const groups = await ContactGroup.find(filter)
      .populate('contactIds', 'name email phone role isActive')
      .sort({ name: 1 })
      .lean();
    res.json({ groups });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** POST /api/issues/groups */
router.post('/groups', requireTabWrite('issues'), async (req, res) => {
  try {
    const { name, description, contactIds, isActive } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Name is required' });
    const group = await ContactGroup.create({
      organizationId: req.user.organizationId,
      name: name.trim(),
      description: description || '',
      contactIds: Array.isArray(contactIds) ? contactIds : [],
      isActive: isActive !== false,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });
    const populated = await ContactGroup.findById(group._id)
      .populate('contactIds', 'name email phone role isActive')
      .lean();
    res.status(201).json({ group: populated });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'A group with that name already exists' });
    }
    res.status(500).json({ message: err.message });
  }
});

/** PATCH /api/issues/groups/:id */
router.patch('/groups/:id', requireTabWrite('issues'), async (req, res) => {
  try {
    const group = await ContactGroup.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });
    if (!group) return res.status(404).json({ message: 'Group not found' });

    if (req.body.name !== undefined) group.name = String(req.body.name).trim();
    if (req.body.description !== undefined) group.description = String(req.body.description);
    if (req.body.contactIds !== undefined) {
      group.contactIds = Array.isArray(req.body.contactIds) ? req.body.contactIds : [];
    }
    if (req.body.isActive !== undefined) group.isActive = Boolean(req.body.isActive);
    group.updatedBy = req.user._id;
    await group.save();

    const populated = await ContactGroup.findById(group._id)
      .populate('contactIds', 'name email phone role isActive')
      .lean();
    res.json({ group: populated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
