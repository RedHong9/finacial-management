/**
 * 分析路由 - 提供财务数据分析API
 * 包括月度统计、类别占比、趋势分析、对比分析等功能
 */

const express = require('express');
const { query, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const transactionRepository = require('../repositories/TransactionRepository');
const categoryRepository = require('../repositories/CategoryRepository');
const { db } = require('../../config/database');

const router = express.Router();

// 月度统计
router.get('/monthly', authenticate, [
  query('year').optional().isInt({ min: 2000, max: 2100 }).toInt(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const year = req.query.year || new Date().getFullYear();
    const monthly = [];

    for (let month = 1; month <= 12; month++) {
      const monthStart = `${year}-${month.toString().padStart(2, '0')}-01`;
      // 计算当月最后一天
      const lastDay = new Date(year, month, 0).getDate();
      const monthEnd = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
      
      const income = transactionRepository.sumAmountByUserAndType(req.user.id, monthStart, monthEnd, 'income');
      const expense = transactionRepository.sumAmountByUserAndType(req.user.id, monthStart, monthEnd, 'expense');
      
      monthly.push({
        month: `${year}-${month.toString().padStart(2, '0')}`,
        income: parseFloat(income) || 0,
        expense: parseFloat(expense) || 0,
        balance: (parseFloat(income) || 0) - (parseFloat(expense) || 0),
      });
    }

    res.json({ year, monthly });
  } catch (error) {
    console.error('月度统计查询失败:', error);
    res.status(500).json({ error: '内部服务器错误', details: error.message });
  }
});

// 类别占比
router.get('/category', authenticate, [
  query('type').isIn(['income', 'expense']),
  query('year').optional().isInt(),
  query('month').optional().isInt({ min: 1, max: 12 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { type, year, month } = req.query;
    
    // 初始化类别数据数组
    let categories = [];
    
    // 获取用户指定类型的类别
    const userCategories = categoryRepository.findByUser(req.user.id, type);
    
    if (userCategories.length > 0) {
      // 设定时间范围
      const today = new Date();
      const targetYear = year || today.getFullYear();
      const targetMonth = month || today.getMonth() + 1;
      
      const monthStart = `${targetYear}-${targetMonth.toString().padStart(2, '0')}-01`;
      const lastDay = new Date(targetYear, targetMonth, 0).getDate();
      const monthEnd = `${targetYear}-${targetMonth.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
      
      let totalAmount = 0;
      const categoryData = [];
      
      for (const cat of userCategories) {
        // 查询该类别在当前时间范围内的总金额
        const sql = `
          SELECT COALESCE(SUM(amount), 0) as total
          FROM transactions 
          WHERE user_id = ? AND (category_id = ? OR ? IS NULL) AND date BETWEEN ? AND ?
        `;
        const row = db.get(sql, [req.user.id, cat.id, cat.id, monthStart, monthEnd]);
        const amount = parseFloat(row?.total || 0);
        
        if (amount > 0) {
          categoryData.push({
            id: cat.id,
            name: cat.name,
            amount: amount,
            color: cat.color || '#007bff'
          });
          totalAmount += amount;
        }
      }
      
      // 计算百分比
      if (totalAmount > 0) {
        categories = categoryData.map(cat => ({
          name: cat.name,
          amount: cat.amount,
          percentage: Math.round((cat.amount / totalAmount) * 100),
          color: cat.color
        }));
      }
    }
    
    // 如果用户没有任何类别的数据，返回空数组并显示提示信息
    
    res.json({ 
      type, 
      categories,
      message: categories.length === 0 ? '暂时没有找到符合条件的类别数据' : null
    });
  } catch (error) {
    console.error('类别占比查询失败:', error);
    res.status(500).json({ error: '内部服务器错误', details: error.message });
  }
});

// 趋势分析 - 最近 N 个月
router.get('/trend', authenticate, [
  query('months').optional().isInt({ min: 1, max: 24 }).toInt(),
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const months = req.query.months || 6;
    const trend = [];
    const today = new Date();
    
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const monthStart = `${year}-${month.toString().padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const monthEnd = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
      
      const income = transactionRepository.sumAmountByUserAndType(req.user.id, monthStart, monthEnd, 'income');
      const expense = transactionRepository.sumAmountByUserAndType(req.user.id, monthStart, monthEnd, 'expense');
      
      trend.push({
        label: `${year}-${month.toString().padStart(2, '0')}`,
        income: parseFloat(income) || 0,
        expense: parseFloat(expense) || 0,
        balance: (parseFloat(income) || 0) - (parseFloat(expense) || 0)
      });
    }
    
    res.json({ months, trend });
  } catch (error) {
    console.error('趋势分析查询失败:', error);
    res.status(500).json({ error: '内部服务器错误', details: error.message });
  }
});

// 对比分析 - 收入 vs 支出
router.get('/comparison', authenticate, [
  query('year').optional().isInt({ min: 2000, max: 2100 }).toInt(),
  query('month').optional().isInt({ min: 1, max: 12 }),
  query('quarter').optional().isIn(['Q1', 'Q2', 'Q3', 'Q4']),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.id;
    const today = new Date();
    const targetYear = req.query.year || today.getFullYear();
    const targetMonth = req.query.month || null;
    const quarter = req.query.quarter || null;
    
    // 设定时间范围
    let startDate, endDate;
    
    if (targetMonth) {
      // 月度
      startDate = `${targetYear}-${targetMonth.toString().padStart(2, '0')}-01`;
      const lastDay = new Date(targetYear, targetMonth, 0).getDate();
      endDate = `${targetYear}-${targetMonth.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
    } else if (quarter) {
      // 季度
      const quarterMonths = {
        'Q1': [1, 2, 3],
        'Q2': [4, 5, 6],
        'Q3': [7, 8, 9],
        'Q4': [10, 11, 12]
      };
      const months = quarterMonths[quarter];
      const startMonth = months[0];
      const endMonth = months[2];
      startDate = `${targetYear}-${startMonth.toString().padStart(2, '0')}-01`;
      const lastDay = new Date(targetYear, endMonth, 0).getDate();
      endDate = `${targetYear}-${endMonth.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
    } else {
      // 年度
      startDate = `${targetYear}-01-01`;
      endDate = `${targetYear}-12-31`;
    }
    
    // 获取类别列表
    const incomeCategories = categoryRepository.findByUser(userId, 'income');
    const expenseCategories = categoryRepository.findByUser(userId, 'expense');
    
    // 计算类别金额
    const calculateCategoryAmounts = (categories) => {
      const result = [];
      let total = 0;
      
      for (const cat of categories) {
        const sql = `
          SELECT COALESCE(SUM(amount), 0) as total
          FROM transactions 
          WHERE user_id = ? AND (category_id = ? OR ? IS NULL) AND date BETWEEN ? AND ?
        `;
        const row = db.get(sql, [userId, cat.id, cat.id, startDate, endDate]);
        const amount = parseFloat(row?.total || 0);
        
        if (amount > 0) {
          result.push({
            id: cat.id,
            name: cat.name,
            amount: amount,
            color: cat.color || (cat.type === 'income' ? '#36A2EB' : '#FF6384')
          });
          total += amount;
        }
      }
      
      // 计算百分比
      if (total > 0) {
        result.forEach(cat => {
          cat.percentage = Math.round((cat.amount / total) * 100);
        });
      }
      
      return { categories: result, total };
    };
    
    const incomeData = calculateCategoryAmounts(incomeCategories);
    const expenseData = calculateCategoryAmounts(expenseCategories);
    
    // 汇总
    const incomeTotal = incomeData.total;
    const expenseTotal = expenseData.total;
    const balance = incomeTotal - expenseTotal;
    
    res.json({
      period: {
        startDate,
        endDate,
        year: targetYear,
        month: targetMonth,
        quarter,
        label: quarter ? `${targetYear} ${quarter}` : 
               targetMonth ? `${targetYear}-${targetMonth.toString().padStart(2, '0')}` : 
               `${targetYear}年`
      },
      income: {
        categories: incomeData.categories,
        total: incomeTotal,
        color: '#36A2EB'
      },
      expense: {
        categories: expenseData.categories,
        total: expenseTotal,
        color: '#FF6384'
      },
      comparison: {
        incomeTotal,
        expenseTotal,
        balance,
        incomePercentage: incomeTotal + expenseTotal > 0 ? 
          Math.round((incomeTotal / (incomeTotal + expenseTotal)) * 100) : 0,
        expensePercentage: incomeTotal + expenseTotal > 0 ? 
          Math.round((expenseTotal / (incomeTotal + expenseTotal)) * 100) : 0
      }
    });
    
  } catch (error) {
    console.error('对比分析查询失败:', error);
    res.status(500).json({ error: '内部服务器错误', details: error.message });
  }
});

// 季度统计
router.get('/quarterly', authenticate, [
  query('year').optional().isInt({ min: 2000, max: 2100 }).toInt(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.id;
    const year = req.query.year || new Date().getFullYear();
    
    const quarters = [
      { quarter: 'Q1', startMonth: 1, endMonth: 3 },
      { quarter: 'Q2', startMonth: 4, endMonth: 6 },
      { quarter: 'Q3', startMonth: 7, endMonth: 9 },
      { quarter: 'Q4', startMonth: 10, endMonth: 12 }
    ];
    
    const quarterlyData = [];
    
    for (const q of quarters) {
      const startDate = `${year}-${q.startMonth.toString().padStart(2, '0')}-01`;
      const lastDay = new Date(year, q.endMonth, 0).getDate();
      const endDate = `${year}-${q.endMonth.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
      
      const income = transactionRepository.sumAmountByUserAndType(userId, startDate, endDate, 'income');
      const expense = transactionRepository.sumAmountByUserAndType(userId, startDate, endDate, 'expense');
      
      quarterlyData.push({
        quarter: q.quarter,
        startDate,
        endDate,
        income: parseFloat(income) || 0,
        expense: parseFloat(expense) || 0,
        balance: (parseFloat(income) || 0) - (parseFloat(expense) || 0)
      });
    }
    
    res.json({
      year,
      quarterly: quarterlyData
    });
    
  } catch (error) {
    console.error('季度统计查询失败:', error);
    res.status(500).json({ error: '内部服务器错误', details: error.message });
  }
});

// 类别明细 - 按类别显示详细统计
router.get('/category-detail', authenticate, [
  query('year').optional().isInt({ min: 2000, max: 2100 }).toInt(),
  query('month').optional().isInt({ min: 1, max: 12 }),
  query('quarter').optional().isIn(['Q1', 'Q2', 'Q3', 'Q4']),
  query('type').optional().isIn(['income', 'expense', 'all']).default('all'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.id;
    const { year, month, quarter, type } = req.query;
    const today = new Date();
    const targetYear = year || today.getFullYear();
    
    // 设定时间范围
    let startDate, endDate, periodLabel;
    
    if (month) {
      startDate = `${targetYear}-${month.toString().padStart(2, '0')}-01`;
      const lastDay = new Date(targetYear, month, 0).getDate();
      endDate = `${targetYear}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
      periodLabel = `${targetYear}-${month.toString().padStart(2, '0')}`;
    } else if (quarter) {
      const quarterMonths = {
        'Q1': [1, 2, 3],
        'Q2': [4, 5, 6],
        'Q3': [7, 8, 9],
        'Q4': [10, 11, 12]
      };
      const months = quarterMonths[quarter];
      const startMonth = months[0];
      const endMonth = months[2];
      startDate = `${targetYear}-${startMonth.toString().padStart(2, '0')}-01`;
      const lastDay = new Date(targetYear, endMonth, 0).getDate();
      endDate = `${targetYear}-${endMonth.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
      periodLabel = `${targetYear} ${quarter}`;
    } else {
      startDate = `${targetYear}-01-01`;
      endDate = `${targetYear}-12-31`;
      periodLabel = `${targetYear}年`;
    }
    
    // 获取类别列表
    let categories = [];
    if (type === 'all' || type === 'income') {
      const incomeCats = categoryRepository.findByUser(userId, 'income');
      categories = categories.concat(incomeCats.map(cat => ({ ...cat, type: 'income' })));
    }
    if (type === 'all' || type === 'expense') {
      const expenseCats = categoryRepository.findByUser(userId, 'expense');
      categories = categories.concat(expenseCats.map(cat => ({ ...cat, type: 'expense' })));
    }
    
    const categoryDetails = [];
    let totalIncome = 0;
    let totalExpense = 0;
    
    for (const cat of categories) {
      const sql = `
        SELECT COALESCE(SUM(amount), 0) as total
        FROM transactions
        WHERE user_id = ? AND (category_id = ? OR ? IS NULL) AND date BETWEEN ? AND ?
      `;
      const row = db.get(sql, [userId, cat.id, cat.id, startDate, endDate]);
      const amount = parseFloat(row?.total || 0);
      
      if (amount > 0) {
        const detail = {
          id: cat.id,
          name: cat.name,
          type: cat.type,
          amount: amount,
          color: cat.color || (cat.type === 'income' ? '#36A2EB' : '#FF6384')
        };
        
        categoryDetails.push(detail);
        
        if (cat.type === 'income') {
          totalIncome += amount;
        } else {
          totalExpense += amount;
        }
      }
    }
    
    // 按金额排序
    categoryDetails.sort((a, b) => b.amount - a.amount);
    
    res.json({
      period: {
        startDate,
        endDate,
        year: targetYear,
        month: month || null,
        quarter: quarter || null,
        label: periodLabel
      },
      type,
      categories: categoryDetails,
      totals: {
        income: totalIncome,
        expense: totalExpense,
        balance: totalIncome - totalExpense
      }
    });
    
  } catch (error) {
    console.error('类别明细查询失败:', error);
    res.status(500).json({ error: '内部服务器错误', details: error.message });
  }
});

// 交易明细查询 - 支持多维筛选的交易详细列表
router.get('/transaction-detail', authenticate, [
  query('year').optional().isInt({ min: 2000, max: 2100 }).toInt(),
  query('month').optional().isInt({ min: 1, max: 12 }),
  query('quarter').optional().isIn(['Q1', 'Q2', 'Q3', 'Q4']),
  query('categoryId').optional().isInt().toInt(),
  query('type').optional().isIn(['income', 'expense', 'all']).default('all'),
  query('minAmount').optional().isFloat().toFloat(),
  query('maxAmount').optional().isFloat().toFloat(),
  query('keyword').optional().trim().escape(),
  query('limit').optional().isInt({ min: 1, max: 100 }).default(50).toInt(),
  query('page').optional().isInt({ min: 1 }).default(1).toInt(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.id;
    const {
      year, month, quarter, categoryId, type,
      minAmount, maxAmount, keyword, limit, page
    } = req.query;
    const offset = (page - 1) * limit;
    const today = new Date();
    const targetYear = year || today.getFullYear();
    
    // 设定时间范围
    let startDate, endDate, periodLabel;
    
    if (month) {
      startDate = `${targetYear}-${month.toString().padStart(2, '0')}-01`;
      const lastDay = new Date(targetYear, month, 0).getDate();
      endDate = `${targetYear}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
      periodLabel = `${targetYear}-${month.toString().padStart(2, '0')}`;
    } else if (quarter) {
      const quarterMonths = {
        'Q1': [1, 2, 3],
        'Q2': [4, 5, 6],
        'Q3': [7, 8, 9],
        'Q4': [10, 11, 12]
      };
      const months = quarterMonths[quarter];
      const startMonth = months[0];
      const endMonth = months[2];
      startDate = `${targetYear}-${startMonth.toString().padStart(2, '0')}-01`;
      const lastDay = new Date(targetYear, endMonth, 0).getDate();
      endDate = `${targetYear}-${endMonth.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
      periodLabel = `${targetYear} ${quarter}`;
    } else {
      startDate = `${targetYear}-01-01`;
      endDate = `${targetYear}-12-31`;
      periodLabel = `${targetYear}年`;
    }
    
    // 构建查询语句
    let sql = `
      SELECT t.*, c.name as category_name, c.type as category_type, c.color as category_color
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ? AND t.date BETWEEN ? AND ?
    `;
    const params = [userId, startDate, endDate];
    
    console.log('=== 交易明细查询调试开始 ===');
    console.log('基础SQL:', sql);
    console.log('基础参数:', params);
    console.log('查询参数:', { year, month, quarter, categoryId, type, minAmount, maxAmount, keyword, limit, page });
    
    if (categoryId && !isNaN(categoryId) && categoryId > 0) {
      sql += ' AND t.category_id = ?';
      params.push(categoryId);
      console.log('添加categoryId条件:', categoryId);
    }
    
    if (type && type !== 'all') {
      sql += ' AND c.type = ?';
      params.push(type);
      console.log('添加type条件:', type);
    }
    
    if (minAmount !== undefined && !isNaN(minAmount)) {
      sql += ' AND t.amount >= ?';
      params.push(minAmount);
      console.log('添加minAmount条件:', minAmount);
    }
    
    if (maxAmount !== undefined && !isNaN(maxAmount)) {
      sql += ' AND t.amount <= ?';
      params.push(maxAmount);
      console.log('添加maxAmount条件:', maxAmount);
    }
    
    if (keyword) {
      sql += ' AND (t.description LIKE ? OR c.name LIKE ?)';
      const keywordPattern = `%${keyword}%`;
      params.push(keywordPattern, keywordPattern);
      console.log('添加keyword条件:', keyword);
    }
    
    console.log('构建后SQL:', sql);
    console.log('构建后参数:', params);
    console.log('参数类型:', params.map(p => typeof p));
    
    // 获取总数
    const countSql = sql.replace('SELECT t.*, c.name as category_name, c.type as category_type, c.color as category_color', 'SELECT COUNT(*) as total');
    console.log('CountSQL:', countSql);
    
    let total, totalPages;
    try {
      const countRow = db.get(countSql, params);
      total = countRow.total || 0;
      totalPages = Math.ceil(total / limit);
      console.log('Count查询成功，总数:', total);
    } catch (err) {
      console.error('Count查询失败:', err.message);
      console.error('失败SQL:', countSql);
      console.error('失败参数:', params);
      throw err;
    }
    
    // 添加分页
    sql += ' ORDER BY t.date DESC, t.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    console.log('分页后SQL:', sql);
    console.log('分页后参数:', params);
    
    // 执行查询
    const rows = db.all(sql, params);
    console.log('查询结果行数:', rows.length);
    
    // 转换数据格式
    const transactions = rows.map(row => ({
      id: row.id,
      date: row.date,
      category: row.category_name ? {
        id: row.category_id,
        name: row.category_name,
        type: row.category_type,
        color: row.category_color
      } : null,
      description: row.description,
      amount: parseFloat(row.amount),
      type: row.amount >= 0 ? 'income' : 'expense'
    }));
    
    // 统计摘要
    let summarySql = `
      SELECT
        COALESCE(SUM(CASE WHEN c.type = 'income' THEN t.amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN c.type = 'expense' THEN t.amount ELSE 0 END), 0) as total_expense,
        COUNT(*) as transaction_count
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ? AND t.date BETWEEN ? AND ?
    `;
    const summaryParams = [userId, startDate, endDate];
    
    if (categoryId && !isNaN(categoryId) && categoryId > 0) {
      summarySql += ' AND t.category_id = ?';
      summaryParams.push(categoryId);
    }
    
    if (type && type !== 'all') {
      summarySql += ' AND c.type = ?';
      summaryParams.push(type);
    }
    
    console.log('SummarySQL:', summarySql);
    console.log('Summary参数:', summaryParams);
    
    const summaryRow = db.get(summarySql, summaryParams);
    
    console.log('=== 交易明细查询调试结束 ===');
    
    res.json({
      period: {
        startDate,
        endDate,
        year: targetYear,
        month: month || null,
        quarter: quarter || null,
        label: periodLabel
      },
      filters: {
        categoryId,
        type,
        minAmount,
        maxAmount,
        keyword
      },
      summary: {
        totalIncome: parseFloat(summaryRow.total_income) || 0,
        totalExpense: parseFloat(summaryRow.total_expense) || 0,
        transactionCount: summaryRow.transaction_count || 0,
        balance: (parseFloat(summaryRow.total_income) || 0) - (parseFloat(summaryRow.total_expense) || 0)
      },
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasPrev: page > 1,
        hasNext: page < totalPages
      },
      transactions
    });
    
  } catch (error) {
    console.error('交易明细查询失败:', error);
    console.error('错误堆栈:', error.stack);
    res.status(500).json({ error: '内部服务器错误', details: error.message });
  }
});

// 类别交易明细 - 根据类别ID获取该类别下的具体交易
router.get('/category-transactions', authenticate, [
  query('categoryId').isInt().toInt(),
  query('year').optional().isInt({ min: 2000, max: 2100 }).toInt(),
  query('month').optional().isInt({ min: 1, max: 12 }),
  query('limit').optional().isInt({ min: 1, max: 100 }).default(20).toInt(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.id;
    const { categoryId, year, month, limit } = req.query;
    const today = new Date();
    const targetYear = year || today.getFullYear();
    
    // 设定时间范围
    let startDate, endDate;
    
    if (month) {
      startDate = `${targetYear}-${month.toString().padStart(2, '0')}-01`;
      const lastDay = new Date(targetYear, month, 0).getDate();
      endDate = `${targetYear}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
    } else {
      startDate = `${targetYear}-01-01`;
      endDate = `${targetYear}-12-31`;
    }
    
    // 查询类别信息
    const categorySql = 'SELECT * FROM categories WHERE id = ? AND user_id = ?';
    const category = db.get(categorySql, [categoryId, userId]);
    
    if (!category) {
      return res.status(404).json({ error: '类别不存在或权限不足' });
    }
    
    // 查询交易
    const sql = `
      SELECT t.*, c.name as category_name, c.type as category_type, c.color as category_color
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ? AND t.category_id = ? AND t.date BETWEEN ? AND ?
      ORDER BY t.date DESC
      LIMIT ?
    `;
    const rows = db.all(sql, [userId, categoryId, startDate, endDate, limit]);
    
    // 交易统计
    const statSql = `
      SELECT
        COALESCE(SUM(amount), 0) as total_amount,
        COUNT(*) as transaction_count,
        MIN(date) as earliest_date,
        MAX(date) as latest_date
      FROM transactions
      WHERE user_id = ? AND category_id = ? AND date BETWEEN ? AND ?
    `;
    const statRow = db.get(statSql, [userId, categoryId, startDate, endDate]);
    
    const transactions = rows.map(row => ({
      id: row.id,
      date: row.date,
      description: row.description,
      amount: parseFloat(row.amount),
      type: row.amount >= 0 ? 'income' : 'expense'
    }));
    
    res.json({
      category: {
        id: category.id,
        name: category.name,
        type: category.type,
        color: category.color
      },
      period: {
        startDate,
        endDate,
        year: targetYear,
        month: month || null
      },
      statistics: {
        totalAmount: parseFloat(statRow.total_amount) || 0,
        transactionCount: statRow.transaction_count || 0,
        earliestDate: statRow.earliest_date,
        latestDate: statRow.latest_date
      },
      transactions
    });
    
  } catch (error) {
    console.error('类别交易明细查询失败:', error);
    res.status(500).json({ error: '内部服务器错误', details: error.message });
  }
});

module.exports = router;
