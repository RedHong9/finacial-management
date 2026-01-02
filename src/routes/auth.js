/**
 * ��֤·��
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const authService = require('../services/AuthService');

const router = express.Router();

// ע��
router.post(
  '/register',
  [
    body('username').notEmpty().trim().isLength({ min: 3, max: 30 }),
    body('password').notEmpty().isLength({ min: 6 }),
    body('email').optional({ checkFalsy: true }).isEmail(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // �򻯣�ֻ���ص�һ������
      const errorArray = errors.array();
      return res.status(400).json({
        error: errorArray[0]?.msg || '��������',
        errors: errorArray
      });
    }

    try {
      const { username, password, email } = req.body;
      const result = await authService.register(username, password, email);
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// ��¼
router.post(
  '/login',
  [
    body('username').notEmpty(),
    body('password').notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorArray = errors.array();
      return res.status(400).json({
        error: errorArray[0]?.msg || '��������',
        errors: errorArray
      });
    }

    try {
      const { username, password } = req.body;
      const result = await authService.login(username, password);
      res.json(result);
    } catch (err) {
      res.status(401).json({ error: err.message });
    }
  }
);

// ע����ǰ�˿�ѡ�Ķ˵㣬ʵ����ǰ����� token��
router.post('/logout', (req, res) => {
  res.json({ message: 'ע���ɹ�' });
});

module.exports = router;
