import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, Organization, Otp } from '../models/index.js';
import { protect } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { sendOtpEmail, isDevBypass } from '../services/otpService.js';
import { validateEmail, validatePassword, validateName, validateOtp, sanitizeInput } from '../utils/validation.js';

const router = express.Router();
const generateToken = (id) => jwt.sign({ id }, env.jwtSecret, { expiresIn: env.jwtExpire });

function randomOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Generate unique organization ID
function generateOrgId() {
  return `ORG-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
}

// Step 1: Create organization first
router.post('/create-organization', async (req, res) => {
  try {
    const { orgName, industry, companySize, country, region } = req.body;
    
    if (!orgName) {
      return res.status(400).json({ message: 'Organization name required' });
    }
    
    // Generate unique organization ID
    const orgId = generateOrgId();
    
    // Create new organization
    const org = await Organization.create({
      orgId,
      name: orgName.trim(),
      industry: industry || undefined,
      companySize: companySize || undefined,
      country: country?.trim() || undefined,
      region: region?.trim() || undefined,
    });
    
    res.status(201).json({
      message: 'Organization created successfully',
      organization: {
        id: org._id,
        orgId: org.orgId,
        name: org.name,
        industry: org.industry,
        companySize: org.companySize,
        country: org.country
      },
      nextStep: 'create-admin'
    });
  } catch (err) {
    console.error('Organization creation error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Step 2: Send OTP for admin account creation
router.post('/send-admin-otp', async (req, res) => {
  try {
    const { organizationId, name, email } = req.body;
    
    // Validate inputs
    const nameError = validateName(name);
    if (nameError) return res.status(400).json({ message: nameError });
    
    const emailError = validateEmail(email);
    if (emailError) return res.status(400).json({ message: emailError });
    
    // Sanitize inputs
    const sanitizedName = sanitizeInput(name);
    const sanitizedEmail = email.toLowerCase().trim();
    
    // Verify organization exists
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(400).json({ message: 'Invalid organization' });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ email: sanitizedEmail });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }
    
    // Clean up old OTPs for this email
    await Otp.deleteMany({ 
      email: sanitizedEmail,
      expiresAt: { $lt: new Date() }
    });
    
    // Create OTP record with admin data
    const code = randomOtp();
    const tempData = { 
      name: sanitizedName, 
      organizationId: organization._id 
    };
    
    await Otp.create({
      email: sanitizedEmail,
      code,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      tempData
    });
    
    await sendOtpEmail(sanitizedEmail, code);
    res.status(201).json({
      message: 'Verification code sent to your email',
      email: sanitizedEmail,
      organization: {
        id: organization._id,
        orgId: organization.orgId,
        name: organization.name
      },
      nextStep: 'verify-admin-otp'
    });
  } catch (err) {
    console.error('Admin OTP error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Step 3: Verify OTP and create admin
router.post('/verify-admin-otp', async (req, res) => {
  try {
    const { email, code, password } = req.body;
    
    // Validate inputs
    const emailError = validateEmail(email);
    if (emailError) return res.status(400).json({ message: emailError });
    
    const otpError = validateOtp(code);
    if (otpError) return res.status(400).json({ message: otpError });
    
    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ message: passwordError });
    
    const sanitizedEmail = email.toLowerCase().trim();
    
    if (isDevBypass(code)) {
      // For development bypass, check if we have the required data
      // If no OTP exists, we need to get the organization from the request
      if (!req.body.organizationId) {
        return res.status(400).json({ message: 'Organization ID required for development bypass' });
      }
      
      const organization = await Organization.findById(req.body.organizationId);
      if (!organization) return res.status(400).json({ message: 'Invalid organization' });
      
      // For dev bypass, we need the admin name - either from OTP or request
      let adminName = req.body.name;
      if (!adminName) {
        // Try to get from existing OTP
        const tempUser = await Otp.findOne({ email: sanitizedEmail }).sort({ createdAt: -1 });
        if (tempUser?.tempData?.name) {
          adminName = tempUser.tempData.name;
        } else {
          return res.status(400).json({ message: 'Admin name required' });
        }
      }
      
      const user = await User.create({
        email: sanitizedEmail,
        passwordHash: await bcrypt.hash(password, 12),
        name: adminName,
        role: 'super_admin',
        emailVerified: true,
        organizationId: organization._id,
        onboardingComplete: true
      });
      
      // Clean up any existing OTPs
      await Otp.deleteMany({ email: sanitizedEmail });
      const token = generateToken(user._id);
      
      const userWithOrg = await User.findById(user._id)
        .select('-passwordHash')
        .populate('organizationId', 'name orgId industry companySize country')
        .lean();
      
      return res.json({
        message: 'Administrator created successfully',
        token,
        user: userWithOrg,
        redirectTo: '/dashboard'
      });
    }
    
    const otp = await Otp.findOne({
      email: sanitizedEmail,
      code: String(code).trim(),
    });
    
    if (!otp) return res.status(400).json({ message: 'Invalid or expired code' });
    if (new Date() > otp.expiresAt) {
      await Otp.deleteOne({ _id: otp._id });
      return res.status(400).json({ message: 'Code expired' });
    }
    
    if (!otp.tempData) {
      return res.status(400).json({ message: 'Invalid OTP data - missing organization information' });
    }
    
    // Verify organization still exists
    const organization = await Organization.findById(otp.tempData.organizationId);
    if (!organization) {
      return res.status(400).json({ message: 'Organization not found' });
    }
    
    // Create superadmin user
    const user = await User.create({
      email: sanitizedEmail,
      passwordHash: await bcrypt.hash(password, 12),
      name: otp.tempData.name,
      role: 'super_admin',
      emailVerified: true,
      organizationId: organization._id,
      onboardingComplete: true
    });
    
    await Otp.deleteOne({ _id: otp._id });
    const token = generateToken(user._id);
    
    // Get user with organization populated
    const userWithOrg = await User.findById(user._id)
      .select('-passwordHash')
      .populate('organizationId', 'name orgId industry companySize country')
      .lean();
    
    res.json({
      message: 'Administrator created successfully',
      token,
      user: userWithOrg,
      organization: {
        id: organization._id,
        orgId: organization.orgId,
        name: organization.name
      },
      redirectTo: '/dashboard'
    });
  } catch (err) {
    console.error('Admin OTP verification error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Legacy routes - keep for compatibility but redirect to new flow
router.post('/account', async (req, res) => {
  return res.status(301).json({ 
    message: 'Please use the new signup flow',
    newFlow: 'create-organization'
  });
});

router.post('/verify-otp', async (req, res) => {
  return res.status(301).json({ 
    message: 'Please use the new signup flow',
    newFlow: 'create-organization'
  });
});

router.post('/organization', protect, async (req, res) => {
  return res.status(301).json({ 
    message: 'Please use the new signup flow',
    newFlow: 'create-organization'
  });
});

router.post('/preferences', protect, async (req, res) => {
  return res.status(301).json({ 
    message: 'Please use the new signup flow',
    newFlow: 'create-organization'
  });
});

// Resend OTP endpoint (keep for now)
router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;
    
    // Validate email
    const emailError = validateEmail(email);
    if (emailError) return res.status(400).json({ message: emailError });
    
    const sanitizedEmail = email.toLowerCase().trim();
    
    // Check if user is already fully registered
    const existingVerifiedUser = await User.findOne({ 
      email: sanitizedEmail, 
      emailVerified: true 
    });
    if (existingVerifiedUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }
    
    // Clean up old OTPs
    await Otp.deleteMany({ 
      email: sanitizedEmail,
      expiresAt: { $lt: new Date() }
    });
    
    // Create new OTP
    const code = randomOtp();
    await Otp.create({
      email: sanitizedEmail,
      code,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });
    
    await sendOtpEmail(sanitizedEmail, code);
    res.json({
      message: 'New verification code sent to your email',
    });
  } catch (err) {
    console.error('Resend OTP error:', err);
    res.status(500).json({ message: 'Failed to resend code. Please try again.' });
  }
});

export default router;
