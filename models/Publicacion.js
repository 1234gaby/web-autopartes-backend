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
    envio INTEGER NOT NULL,
    tipo_envio TEXT,
    categoria TEXT NOT NULL,
    estado TEXT NOT NULL,
    codigo_serie TEXT,
    compatibilidad TEXT NOT NULL,
    marca_repuesto TEXT NOT NULL,
    fotos TEXT,
    user_id INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`).run();

// Crear publicación
function crearPublicacion(data) {
  const compat = Array.isArray(data.compatibilidad) ? data.compatibilidad : [];
  const fotosArray = Array.isArray(data.fotos) ? data.fotos : [];

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
      fotos,
      user_id
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
      @fotos,
      @user_id
    )
  `);

  stmt.run({
    ...data,
    compatibilidad: JSON.stringify(compat),
    fotos: JSON.stringify(fotosArray),
  });
}

// Obtener todas las publicaciones
function obtenerPublicaciones() {
  const stmt = db.prepare('SELECT * FROM publicaciones');
  return stmt.all();
}

// Obtener publicación por ID
function obtenerPublicacionPorId(id) {
  const stmt = db.prepare('SELECT * FROM publicaciones WHERE id = ?');
  return stmt.get(id);
}

// Modificar publicación
function modificarPublicacion(id, user_id, updatedData) {
  const publicacion = obtenerPublicacionPorId(id);
  if (!publicacion || publicacion.user_id !== user_id) {
    throw new Error('No tienes permisos para modificar esta publicación');
  }

  const stmt = db.prepare(`
    UPDATE publicaciones
    SET 
      nombre_producto = ?, 
      marca = ?, 
      modelo = ?, 
      precio = ?, 
      ubicacion = ?, 
      envio = ?, 
      tipo_envio = ?, 
      categoria = ?, 
      estado = ?, 
      codigo_serie = ?, 
      compatibilidad = ?, 
      marca_repuesto = ?, 
      fotos = ?
    WHERE id = ?
  `);

  stmt.run([
    updatedData.nombre_producto,
    updatedData.marca,
    updatedData.modelo,
    updatedData.precio,
    updatedData.ubicacion,
    updatedData.envio,
    updatedData.tipo_envio,
    updatedData.categoria,
    updatedData.estado,
    updatedData.codigo_serie,
    JSON.stringify(updatedData.compatibilidad),
    updatedData.marca_repuesto,
    JSON.stringify(updatedData.fotos),
    id,
  ]);
}

// Pausar publicación
function pausarPublicacion(id, user_id) {
  const publicacion = obtenerPublicacionPorId(id);
  if (!publicacion || publicacion.user_id !== user_id) {
    throw new Error('No tienes permisos para pausar esta publicación');
  }

  const stmt = db.prepare('UPDATE publicaciones SET estado = "pausada" WHERE id = ?');
  stmt.run(id);
}

// Eliminar publicación
function eliminarPublicacion(id, user_id) {
  const publicacion = obtenerPublicacionPorId(id);
  if (!publicacion || publicacion.user_id !== user_id) {
    throw new Error('No tienes permisos para eliminar esta publicación');
  }

  const stmt = db.prepare('DELETE FROM publicaciones WHERE id = ?');
  stmt.run(id);
}

module.exports = {
  crearPublicacion,
  obtenerPublicaciones,
  obtenerPublicacionPorId,
  modificarPublicacion,
  pausarPublicacion,
  eliminarPublicacion,
};
