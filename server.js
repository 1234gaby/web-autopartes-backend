const express = require('express');
const cors = require('cors');
const { createUser, findUserByEmail } = require('./models/User');
const { crearPublicacion } = require('./models/Publicacion'); // ✅ importar función de publicación
const db = require('./database'); // ✅ importar base de datos

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
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

// ✅ Crear publicación
app.post('/publicaciones', (req, res) => {
  try {
    crearPublicacion(req.body);
    res.status(201).json({ mensaje: 'Publicación creada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al crear la publicación' });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
