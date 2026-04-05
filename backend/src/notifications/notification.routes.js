/**
 * Notification Routes
 * 
 * REST API for managing user notifications. Provides endpoints to
 * fetch notifications, mark as read, and bulk mark all as read.
 */

const { Router } = require('express');
const { authMiddleware } = require('../middleware/auth');
const Notification = require('../models/Notification');
const { AppError, asyncHandler } = require('../middleware/errors');

const router = Router();

/**
 * GET /notifications
 * Fetch recent notifications for the authenticated user.
 */
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ userId: req.user.id })
    .sort({ createdAt: -1 })
    .limit(50);
  res.json(notifications);
}));

/**
 * PATCH /notifications/:id/read
 * Mark a specific notification as read.
 */
router.patch('/:id/read', authMiddleware, asyncHandler(async (req, res) => {
  const notif = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { read: true },
    { new: true }
  );
  if (!notif) throw new AppError('Notification not found', 404, 'NOTIFICATION_NOT_FOUND');
  res.json(notif);
}));

/**
 * PATCH /notifications/read-all
 * Mark all notifications as read for the current user.
 */
router.patch('/read-all', authMiddleware, asyncHandler(async (req, res) => {
  await Notification.updateMany({ userId: req.user.id, read: false }, { read: true });
  res.json({ success: true });
}));

module.exports = router;
