import express from 'express';
import crypto from 'crypto';
import { Organization } from '../models/index.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

/**
 * Test Endpoints for Payment Scenarios
 * These are for development/testing only
 */

/**
 * POST /api/test-payments/simulate-payment
 * Simulate different payment outcomes for testing
 */
router.post('/simulate-payment', protect, async (req, res) => {
  try {
    const { scenario, tier, planType } = req.body;
    // scenario: 'success' | 'failure' | 'expire' | 'renew'

    if (!['success', 'failure', 'expire', 'renew'].includes(scenario)) {
      return res.status(400).json({ message: 'Invalid scenario' });
    }

    const org = await Organization.findById(req.user.organizationId);
    if (!org) return res.status(404).json({ message: 'Organization not found' });

    const PRICES = {
      pro_monthly: 49900,
      pro_annual: 499900,
      premium_monthly: 89900,
      premium_annual: 899900,
    };

    const amount = PRICES[`${tier}_${planType}`];

    switch (scenario) {
      case 'success':
        // Simulate successful payment
        org.subscriptionTier = tier;
        org.subscriptionPlan = planType;
        org.razorpaySubscriptionId = `test_success_${Date.now()}`;
        org.subscriptionStartDate = new Date();

        const expiry = new Date();
        if (planType === 'monthly') {
          expiry.setMonth(expiry.getMonth() + 1);
        } else {
          expiry.setFullYear(expiry.getFullYear() + 1);
        }
        org.subscriptionEndDate = expiry;
        await org.save();

        return res.json({
          message: 'Payment successful (simulated)',
          tier: org.subscriptionTier,
          plan: org.subscriptionPlan,
          expiresAt: org.subscriptionEndDate,
        });

      case 'failure':
        // Simulate failed payment (no changes to org)
        return res.status(400).json({
          message: 'Payment failed (simulated)',
          reason: 'Card declined',
          code: 'CARD_DECLINED',
        });

      case 'expire':
        // Simulate subscription expiration
        if (org.subscriptionTier === 'free') {
          return res.status(400).json({ message: 'Already on free tier' });
        }

        // Set expiry to 1 day ago
        const expiredDate = new Date();
        expiredDate.setDate(expiredDate.getDate() - 1);
        org.subscriptionEndDate = expiredDate;
        await org.save();

        return res.json({
          message: 'Subscription expired (simulated)',
          tier: org.subscriptionTier,
          expiresAt: org.subscriptionEndDate,
          isExpired: true,
        });

      case 'renew':
        // Simulate subscription renewal
        if (org.subscriptionTier === 'free') {
          return res.status(400).json({ message: 'Cannot renew free tier' });
        }

        const renewalDate = new Date();
        if (org.subscriptionPlan === 'monthly') {
          renewalDate.setMonth(renewalDate.getMonth() + 1);
        } else {
          renewalDate.setFullYear(renewalDate.getFullYear() + 1);
        }
        org.subscriptionEndDate = renewalDate;
        org.subscriptionStartDate = new Date();
        await org.save();

        return res.json({
          message: 'Subscription renewed (simulated)',
          tier: org.subscriptionTier,
          plan: org.subscriptionPlan,
          expiresAt: org.subscriptionEndDate,
        });

      default:
        return res.status(400).json({ message: 'Unknown scenario' });
    }
  } catch (err) {
    console.error('[TEST-PAYMENT] Error:', err);
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /api/test-payments/current-subscription
 * Get current subscription for testing
 */
router.get('/current-subscription', protect, async (req, res) => {
  try {
    const org = await Organization.findById(req.user.organizationId);
    if (!org) return res.status(404).json({ message: 'Organization not found' });

    const now = new Date();
    const isExpired = org.subscriptionEndDate && org.subscriptionEndDate < now;

    res.json({
      tier: org.subscriptionTier || 'free',
      plan: org.subscriptionPlan || 'monthly',
      startDate: org.subscriptionStartDate,
      endDate: org.subscriptionEndDate,
      isExpired,
      daysRemaining: org.subscriptionEndDate
        ? Math.max(0, Math.ceil((org.subscriptionEndDate - now) / (1000 * 60 * 60 * 24)))
        : null,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * POST /api/test-payments/reset
 * Reset subscription to free tier for testing
 */
router.post('/reset', protect, async (req, res) => {
  try {
    const org = await Organization.findById(req.user.organizationId);
    if (!org) return res.status(404).json({ message: 'Organization not found' });

    org.subscriptionTier = 'free';
    org.subscriptionPlan = 'monthly';
    org.razorpaySubscriptionId = null;
    org.subscriptionStartDate = null;
    org.subscriptionEndDate = null;
    await org.save();

    res.json({ message: 'Subscription reset to free' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;

