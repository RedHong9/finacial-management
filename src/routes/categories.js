/**
 * ����·��
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const categoryRepository = require('../repositories/CategoryRepository');

const router = express.Router();

// ��ȡ�û������б����ɹ������ͣ�
router.get('/', authenticate, (req, res) => {
  const { type } = req.query; // 'income' �� 'expense'
  const categories = categoryRepository.findByUser(req.user.id, type);
  res.json({ categories });
});

// ��ȡ��������
router.get('/:id', authenticate, (req, res) => {
  const categoryId = parseInt(req.params.id);
  const category = categoryRepository.findById(categoryId);
  if (!category) {
    return res.status(404).json({ error: '���಻����' });
  }
  if (category.user_id !== req.user.id) {
    return res.status(403).json({ error: 'û��Ȩ�޷��ʴ˷���' });
  }
  res.json({ category });
});

// ��������
router.post(
  '/',
  authenticate,
  [
    body('name').notEmpty().trim(),
    body('type').isIn(['income', 'expense']),
    body('color').optional().isHexColor(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, type, color } = req.body;
    try {
      const category = categoryRepository.create({
        name,
        type,
        user_id: req.user.id,
        color,
      });
      res.status(201).json({ category });
    } catch (err) {
      console.error('Error creating category:', err);
      res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
  }
);

// ���·���
router.put(
  '/:id',
  authenticate,
  [
    body('name').optional().trim(),
    body('type').optional().isIn(['income', 'expense']),
    body('color').optional().isHexColor(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const categoryId = parseInt(req.params.id);
    const category = categoryRepository.findById(categoryId);
    if (!category) {
      return res.status(404).json({ error: '���಻����' });
    }
    if (category.user_id !== req.user.id) {
      return res.status(403).json({ error: 'û��Ȩ���޸Ĵ˷���' });
    }

    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.type !== undefined) updates.type = req.body.type;
    if (req.body.color !== undefined) updates.color = req.body.color;

    const success = categoryRepository.update(categoryId, updates);
    if (success) {
      const updated = categoryRepository.findById(categoryId);
      res.json({ category: updated });
    } else {
      res.status(400).json({ error: '����ʧ��' });
    }
  }
);

// ɾ������
router.delete('/:id', authenticate, (req, res) => {
  const categoryId = parseInt(req.params.id);
  const category = categoryRepository.findById(categoryId);
  if (!category) {
    return res.status(404).json({ error: '���಻����' });
  }
  if (category.user_id !== req.user.id) {
    return res.status(403).json({ error: 'û��Ȩ��ɾ���˷���' });
  }

  const success = categoryRepository.delete(categoryId);
  if (success) {
    res.json({ message: '������ɾ��' });
  } else {
    res.status(400).json({ error: 'ɾ��ʧ��' });
  }
});

module.exports = router;
