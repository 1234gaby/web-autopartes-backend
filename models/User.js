// models/User.js
const db = require('../database');

const createUser = (email, password) => {
  const stmt = db.prepare('INSERT INTO users (email, password) VALUES (?, ?)');
  return stmt.run(email, password);
};

const findUserByEmail = (email) => {
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  return stmt.get(email);
};

module.exports = {
  createUser,
  findUserByEmail
};
