const express = require('express');
const cors = require('cors');
const { createUser, findUserByEmail } = require('./models/User');
const Database = require('better-sqlite3'); // Asegúrate de importar la librería para acceder a la DB

const app = express();
const PORT = process.env.PORT || 3000;

// Conectar a la base de datos
const db = new Database('usuarios.db'); // Cambia el nombre del archivo de la base de datos si es necesario

app.use(cors());
app.use(express.json());

// Ruta para verificar que el servidor está funcionando
app.get('/', (req, res) => {
  res.send('Servidor funcionando con better-sqlite3 🚀');
});

// Ruta para registrar un usuario
app.post('/register', (req, res) => {
  const { email, password } = req.body;
  try {
    createUser(email, password);
    res.status(201).json({ mensaje: 'Usuario registrado' });
  } catch (error) {
    res.status(400).json({ mensaje: 'Error al registrar', error: error.message });
  }
});

// Ruta para login de usuario
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = findUserByEmail(email);
  if (!user || user.password !== password) {
    return res.status(400).json({ mensaje: 'Credenciales inválidas' });
  }
  res.json({ mensaje: 'Login exitoso' });
});

// Nueva ruta para obtener todos los usuarios de la base de datos
// Ruta para obtener usuarios
app.get('/usuarios', (req, res) => {
    try {
      // Verificar si la tabla "usuarios" existe
      const stmt = db.prepare('SELECT name FROM sqlite_master WHERE type="table" AND name="usuarios"');
      const tableExists = stmt.get();
  
      if (!tableExists) {
        console.log('Tabla usuarios no existe');
        return res.status(500).json({ mensaje: 'Tabla usuarios no existe' });
      } else {
        console.log('La tabla usuarios existe');
      }
  
      // Si la tabla existe, obtenemos los usuarios
      const usersStmt = db.prepare('SELECT * FROM usuarios');
      const usuarios = usersStmt.all();
  
      res.json(usuarios);
  
    } catch (err) {
      console.error('Error al obtener usuarios:', err);
      res.status(500).json({ mensaje: 'Error al obtener usuarios', error: err.message });
    }
  });
  
