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
      telefono // <-- AGREGADO
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
          (email, password, tipo_cuenta, nombre, apellido, nombre_local, localidad, dni, telefono, constancia_afip_url, certificado_estudio_url)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
        [
          email,
          password,
          tipoCuenta,
          nombre || null,
          apellido || null,
          nombreLocal || null,
          localidad || null,
          dni || null,
          telefono || null, // <-- AGREGADO
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
        categoria, estado, codigo_serie, compatibilidad, marca_repuesto, fotos, user_id, pausada
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, false)`,
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
    // Parsear fotos a array si es string
    const publicaciones = result.rows.map(pub => ({
      ...pub,
      fotos: typeof pub.fotos === 'string' ? JSON.parse(pub.fotos) : pub.fotos
    }));
    res.json(publicaciones);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener publicaciones' });
  }
});

/**
 * Obtener una publicación por ID
 */
app.get('/publicaciones/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM publicaciones WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Publicación no encontrada' });
    }
    const pub = result.rows[0];
    pub.fotos = typeof pub.fotos === 'string' ? JSON.parse(pub.fotos) : pub.fotos;
    res.json(pub);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener publicación' });
  }
});

/**
 * Pausar o volver a publicar una publicación
 */
app.put('/publicaciones/:id/pausar', async (req, res) => {
  const { id } = req.params;
  const { pausada } = req.body;
  try {
    const result = await pool.query(
      'UPDATE publicaciones SET pausada = $1 WHERE id = $2 RETURNING *',
      [pausada, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Publicación no encontrada' });
    }
    res.json({ message: 'Estado actualizado', publicacion: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al pausar/publicar' });
  }
});

/**
 * Borrar una publicación
 */
app.delete('/publicaciones/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Opcional: obtener fotos para borrar de cloudinary si lo deseas
    await pool.query('DELETE FROM publicaciones WHERE id = $1', [id]);
    res.json({ message: 'Publicación eliminada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al borrar publicación' });
  }
});

/**
 * Editar publicación (datos + imágenes + compatibilidad)
 * Espera: campos editables, nuevasFotos (array de files), imagenesAEliminar (array de urls)
 */
app.put('/publicaciones/:id', upload.array('nuevasFotos', 5), async (req, res) => {
  const { id } = req.params;
  const {
    nombre_producto,
    marca,
    modelo,
    precio,
    ubicacion,
    categoria,
    estado,
    codigo_serie,
    compatibilidad,
    marca_repuesto,
    imagenesAEliminar
  } = req.body;

  try {
    // Obtener publicación actual
    const result = await pool.query('SELECT * FROM publicaciones WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Publicación no encontrada' });
    }
    let fotosActuales = typeof result.rows[0].fotos === 'string'
      ? JSON.parse(result.rows[0].fotos)
      : result.rows[0].fotos;

    // Eliminar imágenes seleccionadas
    let nuevasFotos = fotosActuales;
    if (imagenesAEliminar) {
      const aEliminar = JSON.parse(imagenesAEliminar);
      nuevasFotos = fotosActuales.filter(f => !aEliminar.includes(f));
      // Opcional: borrar de cloudinary
    }

    // Subir nuevas imágenes
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const uploadResult = await cloudinary.uploader.upload(file.path, {
          folder: 'autopartes',
        });
        nuevasFotos.push(uploadResult.secure_url);
        fs.unlinkSync(file.path);
      }
    }

    // Actualizar publicación (ahora incluye compatibilidad, codigo_serie y marca_repuesto)
    await pool.query(
      `UPDATE publicaciones SET
        nombre_producto = COALESCE($1, nombre_producto),
        marca = COALESCE($2, marca),
        modelo = COALESCE($3, modelo),
        precio = COALESCE($4, precio),
        ubicacion = COALESCE($5, ubicacion),
        categoria = COALESCE($6, categoria),
        estado = COALESCE($7, estado),
        fotos = $8,
        codigo_serie = COALESCE($9, codigo_serie),
        compatibilidad = COALESCE($10, compatibilidad),
        marca_repuesto = COALESCE($11, marca_repuesto)
      WHERE id = $12`,
      [
        nombre_producto || null,
        marca || null,
        modelo || null,
        precio || null,
        ubicacion || null,
        categoria || null,
        estado || null,
        JSON.stringify(nuevasFotos),
        codigo_serie || null,
        compatibilidad ? JSON.stringify(JSON.parse(compatibilidad)) : null,
        marca_repuesto || null,
        id
      ]
    );

    res.json({ message: 'Publicación actualizada correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al editar publicación' });
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
 * Editar datos de usuario (nombre, apellido, email, contraseña, telefono, archivos)
 */
app.put(
  '/usuarios/:id',
  upload.fields([
    { name: 'constanciaAfip', maxCount: 1 },
    { name: 'certificadoEstudio', maxCount: 1 },
  ]),
  async (req, res) => {
    const { id } = req.params;
    const { nombre, apellido, email, contrasena, telefono } = req.body; // <-- AGREGADO telefono

    try {
      // Buscar usuario
      const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

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

      // Actualizar usuario
      const result = await pool.query(
        `UPDATE users SET
          nombre = COALESCE($1, nombre),
          apellido = COALESCE($2, apellido),
          email = COALESCE($3, email),
          password = COALESCE($4, password),
          telefono = COALESCE($5, telefono),
          constancia_afip_url = COALESCE($6, constancia_afip_url),
          certificado_estudio_url = COALESCE($7, certificado_estudio_url)
         WHERE id = $8
         RETURNING *`,
        [
          nombre || null,
          apellido || null,
          email || null,
          contrasena || null,
          telefono || null, // <-- AGREGADO
          constanciaAfipUrl,
          certificadoEstudioUrl,
          id
        ]
      );

      res.json({
        message: 'Perfil actualizado correctamente',
        usuario: result.rows[0]
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al actualizar usuario' });
    }
  }
);

/**
 * Subir documentos de un usuario (solo archivos, sin datos)
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