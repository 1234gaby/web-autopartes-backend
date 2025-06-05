require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const pool = require('./database');
const cloudinary = require('./cloudinaryConfig');
const { sendRecoveryEmail } = require('./mailer');

const app = express();
const PORT = process.env.PORT || 3001;

// ✅ Configuración de CORS para permitir acceso desde el frontend
const allowedOrigins = [
  'http://localhost:3000',
  'https://web-autopartes.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({ dest: 'tmp/' });

/**
 * Registro de usuarios (Mecánico o Vendedor)
 */
app.post(
  '/register',
  upload.fields([
    { name: 'constanciaAfip', maxCount: 1 },
    { name: 'certificadoEstudio', maxCount: 1 },
  ]),
  async (req, res) => {
    const {
      email,
      password,
      tipoCuenta,
      nombre,
      apellido,
      nombreLocal,
      localidad,
      dni,
    } = req.body;

    if (!email || !password || !tipoCuenta) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    try {
      let constanciaAfipUrl = null;
      let certificadoEstudioUrl = null;

      if (req.files?.constanciaAfip) {
        const archivo = req.files.constanciaAfip[0];
        const result = await cloudinary.uploader.upload(archivo.path, {
          folder: 'documentos',
        });
        constanciaAfipUrl = result.secure_url;
        fs.unlinkSync(archivo.path);
      }

      if (req.files?.certificadoEstudio) {
        const archivo = req.files.certificadoEstudio[0];
        const result = await cloudinary.uploader.upload(archivo.path, {
          folder: 'documentos',
        });
        certificadoEstudioUrl = result.secure_url;
        fs.unlinkSync(archivo.path);
      }

      const result = await pool.query(
        `INSERT INTO users 
          (email, password, tipo_cuenta, nombre, apellido, nombre_local, localidad, dni, constancia_afip_url, certificado_estudio_url)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [
          email,
          password,
          tipoCuenta,
          nombre || null,
          apellido || null,
          nombreLocal || null,
          localidad || null,
          dni || null,
          constanciaAfipUrl,
          certificadoEstudioUrl,
        ]
      );

      res.status(201).json({
        message: 'Usuario registrado correctamente',
        user_id: result.rows[0].id,
      });
    } catch (err) {
      if (err.code === '23505') {
        res.status(409).json({ error: 'El email ya está registrado' });
      } else {
        console.error(err);
        res.status(500).json({ error: 'Error en el servidor' });
      }
    }
  }
);

/**
 * Login
 */
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: 'Email y contraseña requeridos' });

  try {
    const result = await pool.query(
      'SELECT id, tipo_cuenta FROM users WHERE email = $1 AND password = $2',
      [email, password]
    );

    if (result.rows.length > 0) {
      res.json({
        message: 'Login exitoso',
        user_id: result.rows[0].id,
        tipoCuenta: result.rows[0].tipo_cuenta
      });
    } else {
      res.status(401).json({ error: 'Credenciales incorrectas' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

/**
 * Crear publicación
 */
app.post('/publicaciones', upload.array('fotos', 5), async (req, res) => {
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
      user_id,
    } = req.body;

    const compatParsed = JSON.parse(compatibilidad || '[]');

    const fotosUrls = [];
    for (const file of req.files) {
      const result = await cloudinary.uploader.upload(file.path, {
        folder: 'autopartes',
      });
      fotosUrls.push(result.secure_url);
      fs.unlinkSync(file.path);
    }

    await pool.query(
      `INSERT INTO publicaciones (
        nombre_producto, marca, modelo, precio, ubicacion, envio, tipo_envio,
        categoria, estado, codigo_serie, compatibilidad, marca_repuesto, fotos, user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        nombre_producto,
        marca,
        modelo,
        parseFloat(precio),
        ubicacion,
        envio === 'true',
        tipo_envio,
        categoria,
        estado,
        codigo_serie,
        JSON.stringify(compatParsed),
        marca_repuesto,
        JSON.stringify(fotosUrls),
        user_id,
      ]
    );

    res.status(201).json({ message: 'Publicación creada con éxito', fotos: fotosUrls });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear la publicación' });
  }
});

/**
 * Obtener todas las publicaciones
 */
app.get('/publicaciones', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM publicaciones');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener publicaciones' });
  }
});

/**
 * Obtener datos de un usuario
 */
app.get('/usuarios/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
});

/**
 * Subir documentos de un usuario
 */
app.post(
  '/usuarios/:id/documentos',
  upload.fields([
    { name: 'constanciaAfip', maxCount: 1 },
    { name: 'certificadoEstudio', maxCount: 1 },
  ]),
  async (req, res) => {
    const { id } = req.params;
    try {
      let constanciaAfipUrl = null;
      let certificadoEstudioUrl = null;

      if (req.files?.constanciaAfip) {
        const archivo = req.files.constanciaAfip[0];
        const result = await cloudinary.uploader.upload(archivo.path, {
          folder: 'documentos',
        });
        constanciaAfipUrl = result.secure_url;
        fs.unlinkSync(archivo.path);
      }

      if (req.files?.certificadoEstudio) {
        const archivo = req.files.certificadoEstudio[0];
        const result = await cloudinary.uploader.upload(archivo.path, {
          folder: 'documentos',
        });
        certificadoEstudioUrl = result.secure_url;
        fs.unlinkSync(archivo.path);
      }

      const result = await pool.query(
        `UPDATE users SET
          constancia_afip_url = COALESCE($1, constancia_afip_url),
          certificado_estudio_url = COALESCE($2, certificado_estudio_url)
         WHERE id = $3 RETURNING *`,
        [constanciaAfipUrl, certificadoEstudioUrl, id]
      );

      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al actualizar documentos' });
    }
  }
);

// --- Recuperación de contraseña ---
// Solicitar recuperación (verifica email y dni, y envía email si coinciden)
app.post('/recuperacion', async (req, res) => {
  const { email, dni } = req.body;

  if (!email || !dni) {
    return res.status(400).json({ error: 'Email y DNI requeridos' });
  }

  try {
    const user = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND dni = $2',
      [email, dni]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'No se encontró usuario con ese email y DNI' });
    }

    await sendRecoveryEmail(email);

    res.json({ message: 'Email de recuperación enviado. Revisa tu bandeja de entrada.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al enviar email' });
  }
});

// Actualizar contraseña usando email y DNI
app.post('/actualizar-password', async (req, res) => {
  const { email, dni, nuevaPassword } = req.body;

  if (!email || !dni || !nuevaPassword) {
    return res.status(400).json({ error: 'Email, DNI y nueva contraseña son requeridos' });
  }

  try {
    const user = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND dni = $2',
      [email, dni]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'No se encontró usuario con ese email y DNI' });
    }

    await pool.query(
      'UPDATE users SET password = $1 WHERE id = $2',
      [nuevaPassword, user.rows[0].id]
    );

    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    console.error('Error al actualizar contraseña:', error);
    res.status(500).json({ error: 'Error al actualizar contraseña' });
  }
});

// 🟢 Arrancar el servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});