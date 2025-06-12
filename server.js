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
      telefono
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
          telefono || null,
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

    // CONVIERTE envio a booleano REAL (corrige el error 500)
    const envioBool = envio === 'true' || envio === true;

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
        envioBool,
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
    await pool.query('DELETE FROM publicaciones WHERE id = $1', [id]);
    res.json({ message: 'Publicación eliminada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al borrar publicación' });
  }
});

/**
 * Editar publicación (datos + imágenes + compatibilidad)
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
    const result = await pool.query('SELECT * FROM publicaciones WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Publicación no encontrada' });
    }
    let fotosActuales = typeof result.rows[0].fotos === 'string'
      ? JSON.parse(result.rows[0].fotos)
      : result.rows[0].fotos;

    let nuevasFotos = fotosActuales;
    if (imagenesAEliminar) {
      const aEliminar = JSON.parse(imagenesAEliminar);
      nuevasFotos = fotosActuales.filter(f => !aEliminar.includes(f));
    }

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const uploadResult = await cloudinary.uploader.upload(file.path, {
          folder: 'autopartes',
        });
        nuevasFotos.push(uploadResult.secure_url);
        fs.unlinkSync(file.path);
      }
    }

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
 * Registrar una venta
 */
app.post('/ventas', async (req, res) => {
  const { vendedor_id, comprador_id, publicacion_id, cantidad, monto } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO ventas (vendedor_id, comprador_id, publicacion_id, cantidad, monto, fecha)
       VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
      [vendedor_id, comprador_id, publicacion_id, cantidad, monto]
    );
    res.status(201).json({ message: 'Venta registrada', venta: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar la venta' });
  }
});
/**
 * Obtener todas las compras de un usuario (ventas donde es comprador)
 */
app.get('/usuarios/:id/compras', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT v.*, p.nombre_producto, p.envio, p.tipo_envio
       FROM ventas v
       LEFT JOIN publicaciones p ON v.publicacion_id = p.id
       WHERE v.comprador_id = $1
       ORDER BY v.fecha DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener compras del usuario' });
  }
});
/**
 * Actualizar el cashback del usuario
 */
app.put('/usuarios/:id/cashback', async (req, res) => {
  const { id } = req.params;
  const { cashback } = req.body;
  try {
    const result = await pool.query(
      'UPDATE users SET cashback = $1 WHERE id = $2 RETURNING *',
      [cashback, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ message: 'Cashback actualizado', usuario: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar cashback' });
  }
});

/**
 * Obtener cantidad de compras de un usuario en los últimos 30 días
 */
app.get('/usuarios/:id/compras-ultimos-30', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT COUNT(*) FROM ventas 
       WHERE comprador_id = $1 AND fecha >= NOW() - INTERVAL '30 days'`,
      [id]
    );
    res.json({ comprasUltimos30: parseInt(result.rows[0].count, 10) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener compras de los últimos 30 días' });
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
 * Obtener cantidad de ventas de un usuario en los últimos 30 días
 */
app.get('/usuarios/:id/ventas-ultimos-30', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT COUNT(*) FROM ventas 
       WHERE vendedor_id = $1 AND fecha >= NOW() - INTERVAL '30 days'`,
      [id]
    );
    res.json({ ventasUltimos30: parseInt(result.rows[0].count, 10) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener ventas de los últimos 30 días' });
  }
});

/**
 * Editar datos de usuario (nombre, apellido, email, contraseña, telefono, nombre_local, archivos)
 */
app.put(
  '/usuarios/:id',
  upload.fields([
    { name: 'constanciaAfip', maxCount: 1 },
    { name: 'certificadoEstudio', maxCount: 1 },
  ]),
  async (req, res) => {
    const { id } = req.params;
    // AGREGA nombre_local aquí
    const { nombre, apellido, email, contrasena, telefono, nombre_local } = req.body;

    try {
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

      // AGREGA nombre_local en la query
      const result = await pool.query(
        `UPDATE users SET
          nombre = COALESCE($1, nombre),
          apellido = COALESCE($2, apellido),
          email = COALESCE($3, email),
          password = COALESCE($4, password),
          telefono = COALESCE($5, telefono),
          nombre_local = COALESCE($6, nombre_local),
          constancia_afip_url = COALESCE($7, constancia_afip_url),
          certificado_estudio_url = COALESCE($8, certificado_estudio_url)
         WHERE id = $9
         RETURNING *`,
        [
          nombre || null,
          apellido || null,
          email || null,
          contrasena || null,
          telefono || null,
          nombre_local || null,
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

// Subir comprobante de pago para una venta
app.post('/ventas/:id/comprobante', upload.single('comprobante'), async (req, res) => {
  const { id } = req.params;
  try {
    if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' });

    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'comprobantes',
    });
    const comprobanteUrl = result.secure_url;
    fs.unlinkSync(req.file.path);

    await pool.query(
      'UPDATE ventas SET comprobante_pago_url = $1 WHERE id = $2',
      [comprobanteUrl, id]
    );
    res.json({ message: 'Comprobante subido', comprobante_pago_url: comprobanteUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al subir comprobante' });
  }
});

// 🟢 Arrancar el servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});