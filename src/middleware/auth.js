/**
 * 认证中间件
 * 验证 JWT token 并将用户信息附加到请求
 */

const authService = require('../services/AuthService');
const userRepository = require('../repositories/UserRepository');

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  const token = authHeader.substring(7); // 去掉 "Bearer "
  const payload = authService.verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: '令牌无效或已过期' });
  }

  const user = await userRepository.findById(payload.id);
  if (!user) {
    return res.status(401).json({ error: '用户不存在' });
  }

  // 将用户信息附加到请求
  req.user = user;
  next();
}

/**
 * 授权中间件，检查用户角色
 * @param {string[]} allowedRoles 允许的角色列表
 */
function authorize(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: '权限不足' });
    }
    next();
  };
}

module.exports = {
  authenticate,
  authorize,
};