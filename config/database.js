/**
 * 数据库连接模块（使用 sql.js）
 * 提供类 sqlite3 数据的接口，基于 sql.js（WebAssembly SQLite）
 */

const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

// 数据库文件路径
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../database/finance.db');

let db = null;
let SQL = null;

/**
 * 初始化数据库（异步）
 */
async function initDatabase() {
  if (SQL) return;

  // 加载 sql.js
  SQL = await initSqlJs({
    // 如果需要，可以指定 wasm 文件路径
    // locateFile: file => `./node_modules/sql.js/dist/${file}`
  });

  // 如果数据库文件存在，则加载
  let dbData = null;
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    dbData = new Uint8Array(buffer);
  }

  db = new SQL.Database(dbData);

  // 启用外键和 WAL 模式
  db.run('PRAGMA foreign_keys = ON');
  db.run('PRAGMA journal_mode = WAL');

  // 创建必要的表（如果不存在）
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email TEXT,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const createCategoriesTable = `
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      color TEXT DEFAULT '#007bff',
      UNIQUE(user_id, name)
    )
  `;

  const createTransactionsTable = `
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      amount DECIMAL(10,2) NOT NULL,
      description TEXT,
      date DATE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const createBudgetsTable = `
    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
      amount DECIMAL(10,2) NOT NULL,
      month DATE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;

  db.run(createUsersTable);
  db.run(createCategoriesTable);
  db.run(createTransactionsTable);
  db.run(createBudgetsTable);

  console.log('已连接到 SQLite 数据库（sql.js），表已就绪');
}

/**
 * 将数据库保存到文件实现持久化
 */
function saveDatabase() {
  if (!db) {
    console.warn('数据库未初始化，跳过保存');
    return false;
  }
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
    console.log('数据库已保存到文件');
    return true;
  } catch (err) {
    console.error('保存数据库失败:', err.message);
    return false;
  }
}

/**
 * 封装 db.run 以支持参数化查询，返回 changes 和 lastID
 */
function run(sql, params = []) {
  if (!db) throw new Error('数据库未初始化');
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    stmt.step(); // 执行
    const changes = db.getRowsModified();
    // 获取插入的 ID（仅 INSERT 时）
    let lastID = null;
    if (sql.trim().toUpperCase().startsWith('INSERT')) {
      const result = db.exec('SELECT last_insert_rowid() as id');
      lastID = result[0]?.values[0]?.[0] || null;
    }
    return { changes, lastID };
  } finally {
    stmt.free();
  }
}

/**
 * 封装 db.exec 以返回单行
 */
function get(sql, params = []) {
  if (!db) throw new Error('数据库未初始化');
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    if (stmt.step()) {
      return stmt.getAsObject();
    }
    return null;
  } finally {
    stmt.free();
  }
}

/**
 * 封装 db.exec 以返回多行
 */
function all(sql, params = []) {
  if (!db) throw new Error('数据库未初始化');
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    return rows;
  } finally {
    stmt.free();
  }
}

/**
 * 准备语句（返回一个可以多次 run/get/all 的对象）
 */
function prepare(sql) {
  if (!db) throw new Error('数据库未初始化');
  const stmt = db.prepare(sql);
  return {
    bind(params) {
      stmt.bind(params);
    },
    run(params) {
      if (params) this.bind(params);
      stmt.step();
      const changes = db.getRowsModified();
      let lastID = null;
      if (sql.trim().toUpperCase().startsWith('INSERT')) {
        const result = db.exec('SELECT last_insert_rowid() as id');
        lastID = result[0]?.values[0]?.[0] || null;
      }
      return { changes, lastID };
    },
    get(params) {
      if (params) this.bind(params);
      if (stmt.step()) {
        return stmt.getAsObject();
      }
      return null;
    },
    all(params) {
      if (params) this.bind(params);
      const rows = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      return rows;
    },
    finalize() {
      stmt.free();
    }
  };
}

// 导出
module.exports = {
  db: {
    run,
    get,
    all,
    prepare,
    // 直接返回原始数据库（如需要）
    getRawDb: () => db
  },
  initDatabase,
  saveDatabase
};