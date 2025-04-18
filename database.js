// database.js
const Database = require('better-sqlite3');
const db = new Database('autopartes.db');

// Crear tabla si no existe
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT
  )
`).run();
  
  module.exports = db;