/**
 * ����ģ��
 * ��������׼�¼��
 */

class Transaction {
  constructor({ id, user_id, category_id, amount, description, date, created_at }) {
    this.id = id;
    this.user_id = user_id;
    this.category_id = category_id;
    this.amount = parseFloat(amount);
    this.description = description || '';
    this.date = date; // YYYY-MM-DD ��ʽ
    this.created_at = created_at;
  }

  toJSON() {
    return {
      id: this.id,
      user_id: this.user_id,
      category_id: this.category_id,
      amount: this.amount,
      description: this.description,
      date: this.date,
      created_at: this.created_at,
    };
  }
}

module.exports = Transaction;
