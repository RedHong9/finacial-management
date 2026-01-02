/**
 * ���ײֿ�
 * ���� transactions �������ݷ��ʺͲ���
 */

const { db } = require('../../config/database');
const Transaction = require('../models/Transaction');

class TransactionRepository {
  /**
   * �����û�ID���ҽ��׼�¼
   * @param {number} userId
   * @param {Object} filters ��ѡ������ { startDate, endDate, categoryId, type }
   * @param {number} limit ÿҳ����
   * @param {number} offset ƫ����
   * @returns {Transaction[]}
   */
  findByUser(userId, filters = {}, limit = 100, offset = 0) {
    let sql = `
      SELECT t.*, c.name as category_name, c.type as category_type
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ?
    `;
    const params = [userId];

    if (filters.startDate) {
      sql += ' AND t.date >= ?';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      sql += ' AND t.date <= ?';
      params.push(filters.endDate);
    }
    if (filters.categoryId) {
      sql += ' AND t.category_id = ?';
      params.push(filters.categoryId);
    }
    if (filters.type) {
      sql += ' AND c.type = ?';
      params.push(filters.type);
    }

    sql += ' ORDER BY t.date DESC, t.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = db.all(sql, params);
    return rows.map(row => new Transaction(row));
  }

  /**
   * ����ID���ҽ���
   * @param {number} id
   * @returns {Transaction|null}
   */
  findById(id) {
    const row = db.get('SELECT * FROM transactions WHERE id = ?', [id]);
    return row ? new Transaction(row) : null;
  }

  /**
   * ��������
   * @param {Object} transactionData
   * @returns {Transaction}
   */
  create(transactionData) {
    const { user_id, category_id, amount, description, date } = transactionData;
    // SQL.js �޷����� undefined����Ҫת��Ϊ null
    const categoryIdToInsert = category_id === undefined ? null : category_id;
    const descToInsert = description === undefined ? null : description;
    const result = db.run(
      'INSERT INTO transactions (user_id, category_id, amount, description, date) VALUES (?, ?, ?, ?, ?)',
      [user_id, categoryIdToInsert, amount, descToInsert, date]
    );
    return this.findById(result.lastID);
  }

  /**
   * ���½���
   * @param {number} id
   * @param {Object} updates
   * @returns {boolean}
   */
  update(id, updates) {
    const allowed = ['category_id', 'amount', 'description', 'date'];
    const setClause = Object.keys(updates)
      .filter(key => allowed.includes(key))
      .map(key => `${key} = ?`)
      .join(', ');
    if (!setClause) return false;
    const values = Object.keys(updates)
      .filter(key => allowed.includes(key))
      .map(key => updates[key]);
    values.push(id);
    const result = db.run(`UPDATE transactions SET ${setClause} WHERE id = ?`, values);
    return result.changes > 0;
  }

  /**
   * ɾ������
   * @param {number} id
   * @returns {boolean}
   */
  delete(id) {
    const result = db.run('DELETE FROM transactions WHERE id = ?', [id]);
    return result.changes > 0;
  }

  /**
   * ͳ���û��Ľ�������
   * @param {number} userId
   * @param {Object} filters
   * @returns {number}
   */
  countByUser(userId, filters = {}) {
    let sql = 'SELECT COUNT(*) as total FROM transactions t LEFT JOIN categories c ON t.category_id = c.id WHERE t.user_id = ?';
    const params = [userId];

    if (filters.startDate) {
      sql += ' AND t.date >= ?';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      sql += ' AND t.date <= ?';
      params.push(filters.endDate);
    }
    if (filters.categoryId) {
      sql += ' AND t.category_id = ?';
      params.push(filters.categoryId);
    }
    if (filters.type) {
      sql += ' AND c.type = ?';
      params.push(filters.type);
    }

    const row = db.get(sql, params);
    return row.total;
  }

  /**
   * ͳ���û���ָ��ʱ�����ĳ���͵��ܽ��
   * @param {number} userId
   * @param {string} startDate
   * @param {string} endDate
   * @param {string} type 'income' �� 'expense'
   * @returns {number}
   */
  sumAmountByUserAndType(userId, startDate, endDate, type) {
    const sql = `
      SELECT COALESCE(SUM(t.amount), 0) as total
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ? AND t.date BETWEEN ? AND ? AND c.type = ?
    `;
    const row = db.get(sql, [userId, startDate, endDate, type]);
    return row.total;
  }
}

module.exports = new TransactionRepository();
