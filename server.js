const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');  // Asegúrate de importar better-sqlite3
const db = new Database('usuarios.db');     // Ruta a tu base de datos SQLite

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Servidor funcionando con better-sqlite3 🚀');
});

// Crear usuario
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

// Obtener usuarios
app.get('/usuarios', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM usuarios');
    const usuarios = stmt.all();
    res.json(usuarios);
  } catch (err) {
    console.error(err); // Esto te ayudará a ver más detalles en los logs
    res.status(500).json({ mensaje: 'Error al obtener usuarios' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
