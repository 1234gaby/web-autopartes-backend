const express = require('express');
const cors = require('cors');
const { createUser, findUserByEmail } = require('./models/User');
const db = require('./database'); // Importamos la base de datos

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Verificar si la tabla 'users' existe
const stmt = db.prepare('SELECT name FROM sqlite_master WHERE type="table" AND name="users"');
const tableExists = stmt.get();
if (!tableExists) {
  console.log('❌ La tabla "users" no existe');
} else {
  console.log('✅ La tabla "users" existe en la base de datos autopartes.db');
}

// Rutas
app.get('/', (req, res) => {
  res.send('Servidor funcionando con better-sqlite3 🚀');
});

app.post('/register', (req, res) => {
  const { email, password } = req.body;
  try {
    createUser(email, password);
    res.status(201).json({ mensaje: 'Usuario registrado' });
  } catch (error) {
    res.status(400).json({ mensaje: 'Error al registrar', error: error.message });
  }
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = findUserByEmail(email);
  if (!user || user.password !== password) {
    return res.status(400).json({ mensaje: 'Credenciales inválidas' });
  }
  res.json({ mensaje: 'Login exitoso' });
});

// Nuevo endpoint para ver los usuarios registrados
app.get('/usuarios', (req, res) => {
  try {
    const stmt = db.prepare('SELECT id, email FROM users');
    const usuarios = stmt.all();
    res.json(usuarios);
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener usuarios' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
