/**
 * 分类模型
 * 表示收入和支出分类。
 */

class Category {
  constructor({ id, name, type, user_id, color }) {
    this.id = id;
    this.name = name;
    this.type = type; // 'income' 或 'expense'
    this.user_id = user_id;
    this.color = color || '#007bff';
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      user_id: this.user_id,
      color: this.color,
    };
  }
}

module.exports = Category;
