// database.js
const Database = require('better-sqlite3');
const db = new Database('autopartes.db');

// Crear tabla de usuarios si no existe
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT
  )
`).run();

// Crear tabla de publicaciones si no existe
db.prepare(`
  CREATE TABLE IF NOT EXISTS publicaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre_producto TEXT,
    marca TEXT,
    modelo TEXT,
    precio REAL,
    ubicacion TEXT,
    envio TEXT,
    tipo_envio TEXT,
    categoria TEXT,
    estado TEXT,
    codigo_serie TEXT,
    compatibilidad TEXT,
    marca_repuesto TEXT,
    fotos TEXT,
    user_id INTEGER
  )
`).run();

module.exports = db;
