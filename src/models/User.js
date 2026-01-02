/**
 * �û�ģ��
 * �����û����ݽṹ�ͷ�����
 */

class User {
  constructor({ id, username, password_hash, email, role, created_at }) {
    this.id = id;
    this.username = username;
    this.password_hash = password_hash;
    this.email = email;
    this.role = role || 'user';
    this.created_at = created_at;
  }

  /**
   * ת��Ϊ���������� JSON ��Ӧ��
   */
  toJSON() {
    return {
      id: this.id,
      username: this.username,
      email: this.email,
      role: this.role,
      created_at: this.created_at,
    };
  }
}

module.exports = User;
