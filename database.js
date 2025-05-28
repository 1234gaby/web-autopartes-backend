// database.js
const { Pool } = require('pg');

// URL de conexión a tu base de datos en Render
const connectionString = 'postgresql://autopartes_db_user:9HZDmKwGwlREKvUQJlfDbPE277rxA0vh@dpg-d0r6hd15pdvs73dn4js0-a.render.com:5432/autopartes_db';

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false // necesario para Render
  }
});

// Crear tablas si no existen
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE,
        password TEXT
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS publicaciones (
        id SERIAL PRIMARY KEY,
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
        compatibilidad JSON,
        marca_repuesto TEXT,
        fotos JSON,
        user_id INTEGER REFERENCES users(id)
      );
    `);

    console.log('Tablas verificadas o creadas correctamente');
  } catch (err) {
    console.error('Error creando/verificando tablas:', err);
  }
})();

module.exports = pool;
