/**
 * �û�·��
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const userRepository = require('../repositories/UserRepository');

const router = express.Router();

// ��ȡ��ǰ�û���Ϣ����Ҫ��֤��
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user.toJSON() });
});

// ���µ�ǰ�û���Ϣ
router.put(
  '/me',
  authenticate,
  [
    body('email').optional().isEmail(),
    body('password').optional().isLength({ min: 6 }),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const updates = {};
    if (req.body.email) updates.email = req.body.email;
    if (req.body.password) updates.password_hash = req.body.password; // ע�⣺ʵ��Ӧ����

    // �򻯣�����δ�������룬ʵ��Ӧʹ�÷����
    const success = userRepository.update(req.user.id, updates);
    if (success) {
      const updatedUser = userRepository.findById(req.user.id);
      res.json({ user: updatedUser.toJSON() });
    } else {
      res.status(400).json({ error: '����ʧ��' });
    }
  }
);

module.exports = router;
