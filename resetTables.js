// resetTables.js
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

(async () => {
  try {
    console.log('🔄 Borrando tablas...');
    await pool.query(`DROP TABLE IF EXISTS publicaciones;`);
    await pool.query(`DROP TABLE IF EXISTS users;`);
    console.log('✅ Tablas borradas exitosamente');
  } catch (err) {
    console.error('❌ Error al borrar tablas:', err);
  } finally {
    await pool.end();
  }
})();
