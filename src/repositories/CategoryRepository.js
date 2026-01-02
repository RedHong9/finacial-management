/**
 * ??????
 * ???? categories ??????????????
 */

const { db } = require('../../config/database');
const Category = require('../models/Category');

class CategoryRepository {
  /**
   * ???????ID????????��?
   * @param {number} userId
   * @param {string} type ??? 'income' ?? 'expense'
   * @returns {Category[]}
   */
  findByUser(userId, type = null) {
    let sql = 'SELECT * FROM categories WHERE user_id = ?';
    const params = [userId];
    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    sql += ' ORDER BY name';
    const rows = db.all(sql, params);
    return rows.map(row => new Category(row));
  }

  /**
   * ????ID???????
   * @param {number} id
   * @returns {Category|null}
   */
  findById(id) {
    const row = db.get('SELECT * FROM categories WHERE id = ?', [id]);
    return row ? new Category(row) : null;
  }

  /**
   * ????????
   * @param {Object} categoryData
   * @returns {Category}
   */
  create(categoryData) {
    const { name, type, user_id, color } = categoryData;
    // SQL.js �޷��� undefined����Ҫת��Ϊ null ��Ĭ��ֵ
    const colorToInsert = color === undefined || color === null ? null : color;
    const result = db.run(
      'INSERT INTO categories (name, type, user_id, color) VALUES (?, ?, ?, ?)',
      [name, type, user_id, colorToInsert]
    );
    return this.findById(result.lastID);
  }

  /**
   * ???��???
   * @param {number} id
   * @param {Object} updates
   * @returns {boolean}
   */
  update(id, updates) {
    const allowed = ['name', 'type', 'color'];
    const setClause = Object.keys(updates)
      .filter(key => allowed.includes(key))
      .map(key => `${key} = ?`)
      .join(', ');
    if (!setClause) return false;
    const values = Object.keys(updates)
      .filter(key => allowed.includes(key))
      .map(key => updates[key]);
    values.push(id);
    const result = db.run(`UPDATE categories SET ${setClause} WHERE id = ?`, values);
    return result.changes > 0;
  }

  /**
   * ???????
   * @param {number} id
   * @returns {boolean}
   */
  delete(id) {
    const result = db.run('DELETE FROM categories WHERE id = ?', [id]);
    return result.changes > 0;
  }
}

module.exports = new CategoryRepository();
