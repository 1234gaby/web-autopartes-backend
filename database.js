// database.js
const { Pool } = require('pg');
const dotenv = require('dotenv');

// Cargar las variables del archivo .env
dotenv.config();

// Mostrar la URL solo para debugging (desactivalo luego en producción)
if (process.env.NODE_ENV !== 'production') {
  console.log('*** DATABASE_URL env variable:', process.env.DATABASE_URL);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Crear tablas si no existen
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        tipo_cuenta TEXT NOT NULL,
        nombre TEXT,
        apellido TEXT,
        nombre_local TEXT,
        localidad TEXT,
        dni TEXT,
        constancia_afip_url TEXT,
        certificado_estudio_url TEXT
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS publicaciones (
        id SERIAL PRIMARY KEY,
        nombre_producto TEXT NOT NULL,
        marca TEXT NOT NULL,
        modelo TEXT NOT NULL,
        precio NUMERIC(10, 2) NOT NULL,
        ubicacion TEXT NOT NULL,
        envio BOOLEAN,
        tipo_envio TEXT,
        categoria TEXT NOT NULL,
        estado TEXT NOT NULL,
        codigo_serie TEXT,
        compatibilidad JSON,
        marca_repuesto TEXT,
        fotos JSON,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    console.log('✅ Tablas verificadas o creadas correctamente');
  } catch (err) {
    console.error('❌ Error creando/verificando tablas:', err);
  }
})();

module.exports = pool;
