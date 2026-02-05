import express from 'express';
import { Organization, User } from '../models/index.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Get organization details (superadmin only)
router.get('/', protect, async (req, res) => {
  try {
    // Only superadmin can view organization details
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (!req.user.organizationId) {
      return res.status(400).json({ message: 'No organization found' });
    }

    const organization = await Organization.findById(req.user.organizationId).lean();
    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    // Get organization statistics
    const userCount = await User.countDocuments({ organizationId: req.user.organizationId });
    
    res.json({
      organization,
      statistics: {
        totalUsers: userCount,
        createdAt: organization.createdAt
      }
    });
  } catch (err) {
    console.error('Get organization error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Update organization details (superadmin only)
router.put('/', protect, async (req, res) => {
  try {
    // Only superadmin can update organization details
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (!req.user.organizationId) {
      return res.status(400).json({ message: 'No organization found' });
    }

    const { name, industry, companySize, country, region, primaryGoal, estimatedAssets } = req.body;
    
    // Build update object with only provided fields
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (industry !== undefined) updateData.industry = industry;
    if (companySize !== undefined) updateData.companySize = companySize;
    if (country !== undefined) updateData.country = country?.trim() || undefined;
    if (region !== undefined) updateData.region = region?.trim() || undefined;
    if (primaryGoal !== undefined) updateData.primaryGoal = primaryGoal;
    if (estimatedAssets !== undefined) updateData.estimatedAssets = estimatedAssets;

    const organization = await Organization.findByIdAndUpdate(
      req.user.organizationId,
      updateData,
      { new: true, runValidators: true }
    ).lean();

    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    res.json({
      message: 'Organization updated successfully',
      organization
    });
  } catch (err) {
    console.error('Update organization error:', err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
