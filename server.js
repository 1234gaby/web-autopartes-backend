// server.js
const express = require('express');
const cors = require('cors');
const db = require('./database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json()); // para requests con JSON
app.use(express.urlencoded({ extended: true })); // para formularios

// Carpeta estática para acceder a las imágenes
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Asegurarse de que exista la carpeta de uploads
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Configurar multer para guardar archivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});
const upload = multer({ storage: storage });

// Ruta: Registro de usuario
app.post('/register', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos' });
  }

  try {
    const stmt = db.prepare('INSERT INTO users (email, password) VALUES (?, ?)');
    stmt.run(email, password);
    res.status(201).json({ message: 'Usuario registrado correctamente' });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(409).json({ error: 'El email ya está registrado' });
    } else {
      console.error(err);
      res.status(500).json({ error: 'Error del servidor' });
    }
  }
});

// Ruta: Crear publicación (usa multer para imágenes)
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

    const compatibilidadParsed = JSON.parse(compatibilidad || '[]');
    const fotosPaths = req.files.map(file => file.filename);

    const stmt = db.prepare(`
      INSERT INTO publicaciones (
        nombre_producto, marca, modelo, precio, ubicacion, envio, tipo_envio,
        categoria, estado, codigo_serie, compatibilidad, marca_repuesto, fotos, user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      nombre_producto,
      marca,
      modelo,
      parseFloat(precio),
      ubicacion,
      envio,
      tipo_envio,
      categoria,
      estado,
      codigo_serie,
      JSON.stringify(compatibilidadParsed),
      marca_repuesto,
      JSON.stringify(fotosPaths),
      user_id
    );

    res.status(201).json({ message: 'Publicación creada con éxito' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear la publicación' });
  }
});

// Ruta: Obtener publicaciones
app.get('/publicaciones', (req, res) => {
  try {
    const publicaciones = db.prepare('SELECT * FROM publicaciones').all();
    res.json(publicaciones);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener publicaciones' });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
