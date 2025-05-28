const { Pool } = require('pg');

// Mostrar la URL solo para debugging (desactivá luego en producción)
console.log('*** DATABASE_URL env variable:', process.env.DATABASE_URL);

// Crear pool de conexión usando la variable de entorno
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
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

    console.log('✅ Tablas verificadas o creadas correctamente');
  } catch (err) {
    console.error('❌ Error creando/verificando tablas:', err);
  }
})();

module.exports = pool;


