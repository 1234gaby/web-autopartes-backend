const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { db } = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Middleware para servir imágenes estáticamente
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configurar almacenamiento con multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// Crear tabla publicaciones si no existe
db.prepare(`
  CREATE TABLE IF NOT EXISTS publicaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre_producto TEXT,
    marca TEXT,
    modelo TEXT,
    precio INTEGER,
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

// Endpoint para crear publicación
app.post('/publicaciones', upload.array('fotos', 5), (req, res) => {
  try {
    const {
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
      user_id
    } = req.body;

    const fotos = req.files.map(file => file.filename); // nombres de archivos

    const stmt = db.prepare(`
      INSERT INTO publicaciones (
        nombre_producto, marca, modelo, precio, ubicacion,
        envio, tipo_envio, categoria, estado, codigo_serie,
        compatibilidad, marca_repuesto, fotos, user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      nombre_producto,
      marca,
      modelo,
      parseInt(precio),
      ubicacion,
      envio,
      tipo_envio,
      categoria,
      estado,
      codigo_serie,
      compatibilidad, // viene como string JSON
      marca_repuesto,
      JSON.stringify(fotos),
      parseInt(user_id)
    );

    res.status(200).json({ mensaje: 'Publicación creada correctamente' });
  } catch (error) {
    console.error('Error al crear publicación:', error.message);
    res.status(500).json({ error: 'Error al crear publicación' });
  }
});

// Endpoint para listar publicaciones
app.get('/publicaciones', (req, res) => {
  try {
    const publicaciones = db.prepare('SELECT * FROM publicaciones').all();

    const publicacionesConFotos = publicaciones.map(pub => ({
      ...pub,
      fotos: JSON.parse(pub.fotos || '[]').map(nombre => `${req.protocol}://${req.get('host')}/uploads/${nombre}`)
    }));

    res.json(publicacionesConFotos);
  } catch (error) {
    console.error('Error al obtener publicaciones:', error.message);
    res.status(500).json({ error: 'Error al obtener publicaciones' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
