const express = require('express')
const cors = require('cors')
const sequelize = require('./database')
const User = require('./models/User')

const app = express()
const PORT = 3000

app.use(cors())
app.use(express.json())

// Sincroniza la base de datos y modelos
sequelize.sync().then(() => {
  console.log('Base de datos conectada y sincronizada')
})

// Registro
app.post('/register', async (req, res) => {
  const { email, password } = req.body
  try {
    const usuario = await User.create({ email, password })
    res.status(201).json({ mensaje: 'Usuario registrado', usuario })
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    res.status(400).json({ mensaje: 'Error al registrar', error: error.message });
  }
})

// Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body
  try {
    const usuario = await User.findOne({ where: { email } })
    if (!usuario || usuario.password !== password) {
      return res.status(400).json({ mensaje: 'Credenciales incorrectas' })
    }
    res.json({ mensaje: 'Login exitoso' })
  } catch (error) {
    res.status(500).json({ mensaje: 'Error en el servidor' })
  }
})

// Test
app.get('/', (req, res) => {
  res.send('Backend con SQLite funcionando 🚀')
})

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`)
})
