import express from 'express';
import { Issue } from '../../models/index.js';

const router = express.Router();

// Public endpoint to search issue by ticket ID
router.get('/:ticketId', async (req, res) => {
  try {
    const { ticketId } = req.params;
    
    if (!ticketId) {
      return res.status(400).json({ message: 'Ticket ID is required' });
    }
    
    // Find issue by ticket ID and populate related fields
    const issue = await Issue.findOne({ ticketId: ticketId.trim() })
      .populate('assetId', 'name assetId')
      .populate('assignedTo', 'name email')
      .populate('reportedBy', 'name email')
      .lean();
    
    if (!issue) {
      return res.status(404).json({ message: 'Issue not found' });
    }
    
    // Return only the necessary public information
    const publicIssueData = {
      ticketId: issue.ticketId,
      title: issue.title,
      description: issue.description,
      status: issue.status,
      priority: issue.priority,
      category: issue.category,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      assignedTo: issue.assignedTo ? {
        name: issue.assignedTo.name,
        email: issue.assignedTo.email
      } : null,
      asset: issue.assetId ? {
        name: issue.assetId.name,
        assetId: issue.assetId.assetId
      } : null,
      resolutionNotes: issue.resolutionNotes,
      resolvedAt: issue.resolvedAt
    };
    
    res.json(publicIssueData);
  } catch (error) {
    console.error('Public issue search error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
