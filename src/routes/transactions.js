/**
 * ????��??
 */

const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const transactionRepository = require('../repositories/TransactionRepository');
const categoryRepository = require('../repositories/CategoryRepository');

const router = express.Router();

// ?????????????
router.get('/:id', authenticate, (req, res) => {
  const transactionId = parseInt(req.params.id);
  const transaction = transactionRepository.findById(transactionId);
  if (!transaction) {
    return res.status(404).json({ error: '?????????' });
  }
  if (transaction.user_id !== req.user.id) {
    return res.status(403).json({ error: '?????????????' });
  }
  res.json({ transaction });
});

// ????????��?????????????
router.get('/', authenticate, [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('startDate').optional().isDate(),
  query('endDate').optional().isDate(),
  query('categoryId').optional().isInt(),
  query('type').optional().isIn(['income', 'expense']),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const page = req.query.page || 1;
  const limit = req.query.limit || 20;
  const offset = (page - 1) * limit;

  const filters = {};
  if (req.query.startDate) filters.startDate = req.query.startDate;
  if (req.query.endDate) filters.endDate = req.query.endDate;
  if (req.query.categoryId) filters.categoryId = req.query.categoryId;
  if (req.query.type) filters.type = req.query.type;

  const transactions = transactionRepository.findByUser(req.user.id, filters, limit, offset);
  const total = transactionRepository.countByUser(req.user.id, filters);
  const totalPages = Math.ceil(total / limit);

  res.json({
    transactions,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  });
});

// ????????
router.post(
  '/',
  authenticate,
  [
    body('category_id').optional().isInt(),
    body('amount').isFloat(),
    body('description').optional().trim(),
    body('date').isDate(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // ??????????????????
    if (req.body.category_id) {
      const category = categoryRepository.findById(req.body.category_id);
      if (!category || category.user_id !== req.user.id) {
        return res.status(400).json({ error: '??????��' });
      }
    }

    const transaction = transactionRepository.create({
      user_id: req.user.id,
      category_id: req.body.category_id || null,
      amount: req.body.amount,
      description: req.body.description,
      date: req.body.date,
    });
    res.status(201).json({ transaction });
  }
);

// ???????
router.put(
  '/:id',
  authenticate,
  [
    body('category_id').optional().isInt(),
    body('amount').optional().isFloat(),
    body('description').optional().trim(),
    body('date').optional().isDate(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const transactionId = parseInt(req.params.id);
    const transaction = transactionRepository.findById(transactionId);
    if (!transaction) {
      return res.status(404).json({ error: '?????????' });
    }
    if (transaction.user_id !== req.user.id) {
      return res.status(403).json({ error: '????????????' });
    }

    // ???????
    if (req.body.category_id !== undefined) {
      if (req.body.category_id) {
        const category = categoryRepository.findById(req.body.category_id);
        if (!category || category.user_id !== req.user.id) {
          return res.status(400).json({ error: '??????��' });
        }
      }
    }

    const updates = {};
    if (req.body.category_id !== undefined) updates.category_id = req.body.category_id;
    if (req.body.amount !== undefined) updates.amount = req.body.amount;
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.date !== undefined) updates.date = req.body.date;

    const success = transactionRepository.update(transactionId, updates);
    if (success) {
      const updated = transactionRepository.findById(transactionId);
      res.json({ transaction: updated });
    } else {
      res.status(400).json({ error: '???????' });
    }
  }
);

// ???????
router.delete('/:id', authenticate, (req, res) => {
  const transactionId = parseInt(req.params.id);
  const transaction = transactionRepository.findById(transactionId);
  if (!transaction) {
    return res.status(404).json({ error: '?????????' });
  }
  if (transaction.user_id !== req.user.id) {
    return res.status(403).json({ error: '????????????' });
  }

  const success = transactionRepository.delete(transactionId);
  if (success) {
    res.json({ message: '?????????' });
  } else {
    res.status(400).json({ error: '??????' });
  }
});

// ?????????????CSV/Excel??
router.get('/export', authenticate, (req, res) => {
  // ??????? JSON?????????????
  const transactions = transactionRepository.findByUser(req.user.id, {}, 1000, 0);
  res.json({ transactions });
});

module.exports = router;
