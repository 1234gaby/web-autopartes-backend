// models/Publicacion.js
const db = require('../database');

// Crear tabla de publicaciones si no existe
db.prepare(`
  CREATE TABLE IF NOT EXISTS publicaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre_producto TEXT NOT NULL,
    marca TEXT NOT NULL,
    modelo TEXT NOT NULL,
    precio REAL NOT NULL,
    ubicacion TEXT NOT NULL,
    envio INTEGER NOT NULL, -- 0 o 1
    tipo_envio TEXT,
    categoria TEXT NOT NULL,
    estado TEXT NOT NULL,
    codigo_serie TEXT,
    compatibilidad TEXT NOT NULL, -- JSON: [{ marca: "Ford", modelos: ["Fiesta", "Focus"] }]
    marca_repuesto TEXT NOT NULL,
    fotos TEXT -- JSON: ["foto1.jpg", "foto2.jpg", ...]
  )
`).run();

function crearPublicacion(data) {
  const stmt = db.prepare(`
    INSERT INTO publicaciones (
      nombre_producto,
      marca,
      modelo,
      precio,
      ubicacion,
      envio,
      tipo_envio,
      categoria,
      estado,
      codigo_serie,
      compatibilidad,
      marca_repuesto,
      fotos
    ) VALUES (
      @nombre_producto,
      @marca,
      @modelo,
      @precio,
      @ubicacion,
      @envio,
      @tipo_envio,
      @categoria,
      @estado,
      @codigo_serie,
      @compatibilidad,
      @marca_repuesto,
      @fotos
    )
  `);

  stmt.run({
    ...data,
    compatibilidad: JSON.stringify(data.compatibilidad),
    fotos: JSON.stringify(data.fotos),
  });
}

module.exports = { crearPublicacion };
