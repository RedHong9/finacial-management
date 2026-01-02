/**
 * ??????
 * ???? users ??????????????????? sql.js ??? API??
 */

const { db } = require('../../config/database');
const User = require('../models/User');

class UserRepository {
  /**
   * ????????????????
   * @param {string} username
   * @returns {Promise<User|null>}
   */
  async findByUsername(username) {
    const row = db.get('SELECT * FROM users WHERE username = ?', [username]);
    return row ? new User(row) : null;
  }

  /**
   * ???????ID???????
   * @param {number} id
   * @returns {Promise<User|null>}
   */
  async findById(id) {
    const row = db.get('SELECT * FROM users WHERE id = ?', [id]);
    return row ? new User(row) : null;
  }

  /**
   * ?????????
   * @param {Object} userData
   * @returns {Promise<User>}
   */
  async create(userData) {
    const { username, password_hash, email, role } = userData;
    console.log('UserRepository.create: inserting user', username);
    // �� undefined ת��Ϊ null����Ϊ SQL.js �޷��� undefined
    const emailToInsert = email === undefined ? null : email;
    const roleToInsert = role || 'user';
    let result;
    try {
      result = db.run(
        'INSERT INTO users (username, password_hash, email, role) VALUES (?, ?, ?, ?)',
        [username, password_hash, emailToInsert, roleToInsert]
      );
    } catch (err) {
      console.error('UserRepository.create: db.run error', err);
      throw err;
    }
    console.log('UserRepository.create: result', result);
    if (!result.lastID) {
      console.error('UserRepository.create: no lastID returned');
    }
    return this.findById(result.lastID);
  }

  /**
   * ??????????
   * @param {number} id
   * @param {Object} updates
   * @returns {Promise<boolean>}
   */
  async update(id, updates) {
    const allowed = ['email', 'password_hash'];
    const setClause = Object.keys(updates)
      .filter(key => allowed.includes(key))
      .map(key => `${key} = ?`)
      .join(', ');
    if (!setClause) return false;
    const values = Object.keys(updates)
      .filter(key => allowed.includes(key))
      .map(key => updates[key]);
    values.push(id);
    const result = db.run(`UPDATE users SET ${setClause} WHERE id = ?`, values);
    return result.changes > 0;
  }

  /**
   * ????????????????
   * @param {number} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    const result = db.run('DELETE FROM users WHERE id = ?', [id]);
    return result.changes > 0;
  }
}

module.exports = new UserRepository();
