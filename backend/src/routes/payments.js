import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { Organization, User } from '../models/index.js';
import { protect } from '../middleware/auth.js';
import { logAudit, getRequestMetadata, AUDIT_RESOURCES } from '../services/auditService.js';

const router = express.Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Plans mapping
const PLANS = {
  pro_monthly: 'plan_SQ03KXEZw2U4ae',
  pro_annual: 'plan_SQ05esYjFQuA4r',
  premium_monthly: 'plan_SR1qwCEd2OJy5I',
  premium_annual: 'plan_SR1s1eiQLsDUMx',
};

const PRICES = {
  pro_monthly: 49900, // ₹499
  pro_annual: 499900, // ₹4,999
  premium_monthly: 89900, // ₹899
  premium_annual: 899900, // ₹8,999
};

// Tier limits
const TIER_LIMITS = {
  free: { assets: 50, users: 5 },
  pro: { assets: 200, users: 10 },
  premium: { assets: 1000, users: 20 },
};

/**
 * POST /api/payments/create-order
 * Create a Razorpay order for subscription upgrade
 */
router.post('/create-order', protect, async (req, res) => {
  try {
    const { tier, planType } = req.body;

    console.log('[PAYMENT] Create order request:', { tier, planType, orgId: req.user.organizationId });

    if (!['pro', 'premium'].includes(tier)) {
      return res.status(400).json({ message: 'Invalid tier' });
    }
    if (!['monthly', 'annual'].includes(planType)) {
      return res.status(400).json({ message: 'Invalid plan type' });
    }

    const org = await Organization.findById(req.user.organizationId);
    if (!org) {
      console.log('[PAYMENT] Organization not found');
      return res.status(404).json({ message: 'Organization not found' });
    }

    // Get amount in paise (1 rupee = 100 paise)
    const amount = PRICES[`${tier}_${planType}`];
    if (!amount) {
      console.log('[PAYMENT] Plan not found:', `${tier}_${planType}`);
      return res.status(400).json({ message: 'Plan not found' });
    }

    console.log('[PAYMENT] Creating Razorpay order:', { amount, tier, planType });

    let order;
    try {
      // Receipt must be max 40 chars - use org ID last 8 chars + timestamp last 8 digits
      const receiptId = `${org._id.toString().slice(-8)}-${Date.now().toString().slice(-8)}`;

      order = await razorpay.orders.create({
        amount: amount,
        currency: 'INR',
        receipt: receiptId,
        notes: {
          tier,
          planType,
          organizationId: org._id.toString(),
        },
      });
    } catch (razorpayErr) {
      console.error('[PAYMENT] Razorpay API error:', razorpayErr);
      return res.status(500).json({
        message: `Razorpay error: ${razorpayErr.message || 'Failed to create order'}`,
        details: razorpayErr.description || razorpayErr.error?.description
      });
    }

    console.log('[PAYMENT] Order created:', { orderId: order.id });
    res.json({ orderId: order.id });
  } catch (err) {
    console.error('[PAYMENT] Order creation error:', err);
    res.status(500).json({ message: err.message || 'Failed to create order' });
  }
});

/**
 * POST /api/payments/verify-payment
 * Verify Razorpay payment and activate subscription
 */
router.post('/verify-payment', protect, async (req, res) => {
  try {
    const { orderId, paymentId, signature, tier, planType } = req.body;

    if (!orderId || !paymentId || !signature || !tier || !planType) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Verify signature
    const body = orderId + '|' + paymentId;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'QMBuza0e9o4PdxcbEfyJd8pZ')
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      return res.status(400).json({ message: 'Invalid payment signature' });
    }

    // Fetch payment details from Razorpay
    const payment = await razorpay.payments.fetch(paymentId);
    if (payment.status !== 'captured') {
      return res.status(400).json({ message: 'Payment not captured' });
    }

    const org = await Organization.findById(req.user.organizationId);
    if (!org) return res.status(404).json({ message: 'Organization not found' });

    // Update organization subscription
    org.subscriptionTier = tier;
    org.subscriptionPlan = planType;
    org.razorpaySubscriptionId = paymentId; // Store payment ID for reference
    org.subscriptionStartDate = new Date();
    // Set expiry based on plan type
    const expiry = new Date();
    if (planType === 'monthly') {
      expiry.setMonth(expiry.getMonth() + 1);
    } else {
      expiry.setFullYear(expiry.getFullYear() + 1);
    }
    org.subscriptionEndDate = expiry;
    await org.save();

    // Log audit
    await logAudit(req.user._id, 'subscription_upgraded', AUDIT_RESOURCES.ORGANIZATION, org._id, {
      resourceName: org.name,
      description: `Upgraded to ${tier} plan (${planType}) - Payment ID: ${paymentId}`,
      severity: 'medium',
      ...getRequestMetadata(req),
    });

    res.json({
      message: `Successfully upgraded to ${tier} plan`,
      tier: org.subscriptionTier,
      plan: org.subscriptionPlan,
    });
  } catch (err) {
    console.error('Payment verification error:', err);
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /api/payments/subscription-status
 * Get current subscription status (returns free if expired)
 */
router.get('/subscription-status', protect, async (req, res) => {
  try {
    const org = await Organization.findById(req.user.organizationId);
    if (!org) return res.status(404).json({ message: 'Organization not found' });

    const now = new Date();
    const isExpired = org.subscriptionEndDate && org.subscriptionEndDate < now;

    // Calculate days remaining
    let daysRemaining = null;
    if (org.subscriptionEndDate && !isExpired) {
      const diff = org.subscriptionEndDate.getTime() - now.getTime();
      daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24));
    }

    // Treat expired subscriptions as free
    const tier = isExpired ? 'free' : (org.subscriptionTier || 'free');
    const limits = TIER_LIMITS[tier];

    res.json({
      tier,
      plan: org.subscriptionPlan || 'monthly',
      razorpaySubscriptionId: org.razorpaySubscriptionId,
      subscriptionStartDate: org.subscriptionStartDate,
      subscriptionEndDate: org.subscriptionEndDate,
      isExpired,
      daysRemaining,
      limits,
      canUpgrade: tier !== 'premium',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * POST /api/payments/cancel-subscription
 * Cancel current subscription (downgrade to free)
 */
router.post('/cancel-subscription', protect, async (req, res) => {
  try {
    const org = await Organization.findById(req.user.organizationId);
    if (!org) return res.status(404).json({ message: 'Organization not found' });

    org.subscriptionTier = 'free';
    org.subscriptionPlan = 'monthly';
    org.razorpaySubscriptionId = null;
    org.subscriptionEndDate = new Date();
    await org.save();

    await logAudit(req.user._id, 'subscription_cancelled', AUDIT_RESOURCES.ORGANIZATION, org._id, {
      resourceName: org.name,
      description: `Downgraded to free plan`,
      severity: 'medium',
      ...getRequestMetadata(req),
    });

    res.json({ message: 'Downgraded to free plan' });
  } catch (err) {
    console.error('Subscription cancellation error:', err);
    res.status(500).json({ message: err.message });
  }
});

export default router;





