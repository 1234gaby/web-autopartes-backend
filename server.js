const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { createUser, findUserByEmail } = require('./models/User');
const { crearPublicacion, obtenerPublicaciones } = require('./models/Publicacion');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Crear carpeta uploads si no existe
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Configurar multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// Middleware para JSON solo en endpoints sin archivos
app.use(express.json());

// Ruta base
app.get('/', (req, res) => {
  res.send('Servidor funcionando con better-sqlite3 🚀');
});

// Registro
app.post('/register', (req, res) => {
  const { email, password } = req.body;
  try {
    createUser(email, password);
    res.status(201).json({ mensaje: 'Usuario registrado' });
  } catch (error) {
    res.status(400).json({ mensaje: 'Error al registrar', error: error.message });
  }
});

// Login
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = findUserByEmail(email);
  if (!user || user.password !== password) {
    return res.status(400).json({ mensaje: 'Credenciales inválidas' });
  }
  res.json({ mensaje: 'Login exitoso' });
});

// Ver usuarios
app.get('/usuarios', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM users');
    const usuarios = stmt.all();
    res.json(usuarios);
  } catch (err) {
    console.error('Error al obtener usuarios:', err);
    res.status(500).json({ mensaje: 'Error al obtener usuarios' });
  }
});

// Crear publicación con fotos
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

    const fotos = req.files.map(file => file.filename);
    const compatibilidadParsed = JSON.parse(compatibilidad);

    crearPublicacion({
      nombre_producto,
      marca,
      modelo,
      precio: parseFloat(precio),
      ubicacion,
      envio: envio === '1' || envio === 1,
      tipo_envio,
      categoria,
      estado,
      codigo_serie,
      compatibilidad: compatibilidadParsed,
      marca_repuesto,
      fotos,
      user_id: parseInt(user_id)
    });

    res.status(201).json({ mensaje: 'Publicación creada con éxito' });
  } catch (error) {
    console.error('Error al crear publicación:', error.message);
    res.status(500).json({ mensaje: 'Error al crear publicación', error: error.message });
  }
});

// Ver publicaciones
app.get('/publicaciones', (req, res) => {
  try {
    const publicaciones = obtenerPublicaciones();
    res.json(publicaciones);
  } catch (err) {
    console.error('Error al obtener publicaciones:', err);
    res.status(500).json({ mensaje: 'Error al obtener publicaciones' });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
