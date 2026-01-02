/**
 * 认证服务
 * 处理用户注册、登录以及生成和验证 JWT token
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/UserRepository');
const { saveDatabase } = require('../../config/database');

class AuthService {
  /**
   * 用户注册
   * @param {string} username
   * @param {string} password
   * @param {string} email
   * @returns {Object} 包含用户信息和 token
   * @throws {Error} 如果用户名已存在或其他错误
   */
  async register(username, password, email) {
    console.log('注册尝试:', username);
    const existing = await userRepository.findByUsername(username);
    console.log('已存在用户:', existing);
    if (existing) {
      throw new Error('用户名已存在');
    }

    try {
      const password_hash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 10);
      console.log('密码已哈希');
      const user = await userRepository.create({ username, password_hash, email, role: 'user' });
      console.log('创建的用户:', user);

      // 立即保存数据库以确保持久化
      try {
        saveDatabase();
        console.log('数据库已保存');
      } catch (saveErr) {
        console.error('保存数据库失败（但用户已创建）:', saveErr.message);
      }

      const token = this.generateToken(user);
      return { user: user.toJSON(), token };
    } catch (err) {
      console.error('注册过程中出错:', err.message, err.stack);
      throw err;
    }
  }

  /**
   * 用户登录
   * @param {string} username
   * @param {string} password
   * @returns {Object} 包含用户信息和 token
   * @throws {Error} 如果用户名不存在或密码错误
   */
  async login(username, password) {
    const user = await userRepository.findByUsername(username);
    if (!user) {
      throw new Error('用户名或密码错误');
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw new Error('用户名或密码错误');
    }

    const token = this.generateToken(user);
    return { user: user.toJSON(), token };
  }

  /**
   * 生成 JWT token
   * @param {User} user
   * @returns {string}
   */
  generateToken(user) {
    const payload = {
      id: user.id,
      username: user.username,
      role: user.role,
    };
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
  }

  /**
   * 验证 JWT token
   * @param {string} token
   * @returns {Object|null} 解码后的 payload 或 null
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return null;
    }
  }
}

module.exports = new AuthService();
