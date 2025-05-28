// server.js con PostgreSQL
const express = require('express');
const cors = require('cors');
const pool = require('./database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Carpeta estática para imágenes
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Registro
app.post('/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });
  try {
    const result = await pool.query('INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id', [email, password]);
    res.status(201).json({ message: 'Usuario registrado correctamente', user_id: result.rows[0].id });
  } catch (err) {
    if (err.code === '23505') res.status(409).json({ error: 'El email ya está registrado' });
    else res.status(500).json({ error: 'Error del servidor' });
  }
});

// Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1 AND password = $2', [email, password]);
    if (result.rows.length > 0) res.json({ message: 'Login exitoso', user_id: result.rows[0].id });
    else res.status(401).json({ error: 'Credenciales incorrectas' });
  } catch (err) {
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Crear publicación
app.post('/publicaciones', upload.array('fotos', 5), async (req, res) => {
  try {
    const {
      nombre_producto, marca, modelo, precio,
      ubicacion, envio, tipo_envio, categoria,
      estado, codigo_serie, compatibilidad,
      marca_repuesto, user_id
    } = req.body;

    const compatParsed = JSON.parse(compatibilidad || '[]');
    const fotosPaths = req.files.map(file => file.filename);

    await pool.query(`
      INSERT INTO publicaciones (
        nombre_producto, marca, modelo, precio, ubicacion, envio, tipo_envio,
        categoria, estado, codigo_serie, compatibilidad, marca_repuesto, fotos, user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `, [
      nombre_producto, marca, modelo, parseFloat(precio), ubicacion, envio, tipo_envio,
      categoria, estado, codigo_serie, JSON.stringify(compatParsed), marca_repuesto,
      JSON.stringify(fotosPaths), user_id
    ]);

    res.status(201).json({ message: 'Publicación creada con éxito' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear la publicación' });
  }
});

// Obtener publicaciones
app.get('/publicaciones', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM publicaciones');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener publicaciones' });
  }
});

// Iniciar servidor
app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));
