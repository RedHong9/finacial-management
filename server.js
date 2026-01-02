/**
 * 财务管理系统 - 后端主服务器
 * 基于 Express 构建 REST API，支持前端网页和后端数据库交互
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// 加载环境变量
dotenv.config();

// 数据库模块
const { initDatabase, saveDatabase } = require('./config/database');

// 认证中间件
const { authenticate } = require('./src/middleware/auth');

// 路由
const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/users');
const categoryRoutes = require('./src/routes/categories');
const transactionRoutes = require('./src/routes/transactions');
const analyticsRoutes = require('./src/routes/analytics');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/analytics', analyticsRoutes);

// 安全关机端点（需要JWT认证）
app.post('/api/shutdown', authenticate, (req, res) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  const userId = req.user?.id || '未知用户';
  const username = req.user?.username || '未知用户名';
  
  console.log(`接收到关机请求，用户ID: ${userId} (${username}), IP: ${clientIP}`);
  console.log('正在保存数据...');
  
  try {
    saveDatabase();
  } catch (err) {
    console.error('保存数据库失败:', err.message);
    return res.status(500).json({ error: '保存数据库失败' });
  }
  
  res.json({
    message: '关机命令已接收',
    userId,
    username,
    timestamp: new Date().toISOString()
  });
  
  // 延迟500毫秒后关闭服务器，确保响应已发送
  setTimeout(() => {
    console.log(`用户 ${username} 已请求关闭服务器，正在关闭...`);
    server.close(() => {
      console.log('服务器已关闭');
      process.exit(0);
    });
  }, 500);
});

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'finance-management-system',
    uptime: process.uptime()
  });
});

// 主页面
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// 全局错误处理
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

/**
 * 获取本地 IPv4 地址
 */
function getLocalIP() {
  const interfaces = require('os').networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const config of iface) {
      if (config.family === 'IPv4' && !config.internal) {
        return config.address;
      }
    }
  }
  return 'localhost';
}

let server;
let autoSaveInterval;

/**
 * 启动自动保存，每30秒执行一次
 */
function startAutoSave() {
  if (autoSaveInterval) clearInterval(autoSaveInterval);
  autoSaveInterval = setInterval(() => {
    try {
      saveDatabase();
    } catch (err) {
      console.error('自动保存失败:', err.message);
    }
  }, 30 * 1000); // 30秒
  console.log('自动保存功能已启动，每30秒保存一次');
}

/**
 * 停止自动保存
 */
function stopAutoSave() {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
    autoSaveInterval = null;
    console.log('自动保存功能已停止');
  }
}

/**
 * 自动打开浏览器（Windows 使用 start 命令，macOS 使用 open，Linux 使用 xdg-open）
 * 支持多平台和可选开关
 */
function openBrowser(url) {
  const { exec } = require('child_process');
  let command;
  
  switch (process.platform) {
    case 'win32':
      command = `start "" "${url}"`; // Windows
      break;
    case 'darwin':
      command = `open "${url}"`; // macOS
      break;
    default:
      command = `xdg-open "${url}"`; // Linux
      break;
  }
  
  console.log(`尝试自动打开浏览器: ${url}`);
  
  exec(command, (err) => {
    if (err) {
      console.warn('无法自动打开浏览器:', err.message);
      console.warn('请手动访问以下地址:');
      console.warn(`  http://localhost:${PORT}`);
      console.warn(`  http://${getLocalIP()}:${PORT}`);
      // 备用方案：使用 npm 包 open（如果已安装）
      tryOpenWithOpn(url);
    } else {
      console.log('浏览器已成功打开');
    }
  });
}

/**
 * 尝试使用 open 包打开浏览器（如果可用）
 */
function tryOpenWithOpn(url) {
  try {
    // 动态加载 open 包，如果未安装则忽略
    const open = require('open');
    open(url).then(() => {
      console.log('使用 open 包成功打开浏览器');
    }).catch((err) => {
      console.warn('open 包也无法打开浏览器:', err.message);
    });
  } catch (err) {
    // open 未安装，忽略
    console.log('提示: 安装 open 包可提供更可靠的浏览器自动打开功能');
    console.log('      npm install open');
  }
}

/**
 * 设置优雅关闭处理程序
 */
function setupGracefulShutdown(server) {
  const shutdown = (signal) => {
    console.log(`接收到 ${signal} 信号，正在执行优雅关闭...`);
    stopAutoSave();
    saveDatabase();
    server.close(() => {
      console.log('服务器已关闭');
      process.exit(0);
    });
    // 如果 5 秒后仍未关闭，强制退出
    setTimeout(() => {
      console.error('强制关闭超时，强制退出');
      process.exit(1);
    }, 5000);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  // Windows 环境下 Ctrl+C 会发送 SIGINT
}

// 启动服务器并初始化数据库
async function startServer() {
  try {
    await initDatabase();
    console.log('数据库初始化完成');

    server = app.listen(PORT, () => {
      console.log(`服务器已启动，可通过以下地址访问: http://localhost:${PORT}`);
      console.log(`使用 IPv4 本地地址访问: http://${getLocalIP()}:${PORT}`);
      // 启动自动保存
      startAutoSave();
      // 自动打开浏览器（默认开启，可通过环境变量 OPEN_BROWSER=false 关闭）
      if (process.env.OPEN_BROWSER !== 'false') {
        openBrowser(`http://localhost:${PORT}`);
      }
    });

    // 设置优雅关闭
    setupGracefulShutdown(server);
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
}

// 启动
startServer();

// 导出用于 nodemon 等工具