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
 * Registro de usuarios
 */
app.post(
  '/register',
  upload.fields([
    { name: 'constanciaAfip', maxCount: 1 },
    { name: 'certificadoEstudio', maxCount: 1 },
    { name: 'certificadoTrabajo', maxCount: 1 }, // solo para compatibilidad
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
          resource_type: 'auto',
        });
        constanciaAfipUrl = result.secure_url;
        fs.unlinkSync(archivo.path);
      }

      if (req.files?.certificadoTrabajo) {
        const archivo = req.files.certificadoTrabajo[0];
        const result = await cloudinary.uploader.upload(archivo.path, {
          folder: 'documentos',
          resource_type: 'auto',
        });
        constanciaAfipUrl = result.secure_url;
        fs.unlinkSync(archivo.path);
      }

      if (req.files?.certificadoEstudio) {
        const archivo = req.files.certificadoEstudio[0];
        const result = await cloudinary.uploader.upload(archivo.path, {
          folder: 'documentos',
          resource_type: 'auto',
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
 * Obtener todos los usuarios
 */
app.get('/usuarios', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

/**
 * Editar datos de usuario y aprobaciones
 */
app.put(
  '/usuarios/:id',
  upload.fields([
    { name: 'constanciaAfip', maxCount: 1 },
    { name: 'certificadoEstudio', maxCount: 1 },
    { name: 'certificadoTrabajo', maxCount: 1 },
  ]),
  async (req, res) => {
    const { id } = req.params;
    let {
      nombre,
      apellido,
      email,
      password,
      contrasena,
      telefono,
      nombre_local,
      cashback,
      tipo_cuenta,
      dni,
      localidad,
      aprobado_constancia_afip,
      aprobado_certificado_estudio
    } = req.body;

    const parseBool = v =>
      v === true || v === 'true' || v === 1 || v === '1'
        ? true
        : v === false || v === 'false' || v === 0 || v === '0'
        ? false
        : null;

    aprobado_constancia_afip = parseBool(aprobado_constancia_afip);
    aprobado_certificado_estudio = parseBool(aprobado_certificado_estudio);

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
          resource_type: 'auto',
        });
        constanciaAfipUrl = result.secure_url;
        fs.unlinkSync(archivo.path);
      }

      if (req.files?.certificadoTrabajo) {
        const archivo = req.files.certificadoTrabajo[0];
        const result = await cloudinary.uploader.upload(archivo.path, {
          folder: 'documentos',
          resource_type: 'auto',
        });
        constanciaAfipUrl = result.secure_url;
        fs.unlinkSync(archivo.path);
      }

      if (req.files?.certificadoEstudio) {
        const archivo = req.files.certificadoEstudio[0];
        const result = await cloudinary.uploader.upload(archivo.path, {
          folder: 'documentos',
          resource_type: 'auto',
        });
        certificadoEstudioUrl = result.secure_url;
        fs.unlinkSync(archivo.path);
      }

      const result = await pool.query(
        `UPDATE users SET
          nombre = COALESCE($1, nombre),
          apellido = COALESCE($2, apellido),
          email = COALESCE($3, email),
          password = COALESCE($4, password),
          telefono = COALESCE($5, telefono),
          nombre_local = COALESCE($6, nombre_local),
          constancia_afip_url = COALESCE($7, constancia_afip_url),
          certificado_estudio_url = COALESCE($8, certificado_estudio_url),
          aprobado_constancia_afip = COALESCE($9, aprobado_constancia_afip),
          aprobado_certificado_estudio = COALESCE($10, aprobado_certificado_estudio),
          cashback = COALESCE($11, cashback),
          tipo_cuenta = COALESCE($12, tipo_cuenta),
          dni = COALESCE($13, dni),
          localidad = COALESCE($14, localidad)
         WHERE id = $15
         RETURNING *`,
        [
          nombre || null,
          apellido || null,
          email || null,
          password || contrasena || null,
          telefono || null,
          nombre_local || null,
          constanciaAfipUrl,
          certificadoEstudioUrl,
          aprobado_constancia_afip,
          aprobado_certificado_estudio,
          cashback || null,
          tipo_cuenta || null,
          dni || null,
          localidad || null,
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
    { name: 'certificadoTrabajo', maxCount: 1 },
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
          resource_type: 'auto',
        });
        constanciaAfipUrl = result.secure_url;
        fs.unlinkSync(archivo.path);
      }

      if (req.files?.certificadoTrabajo) {
        const archivo = req.files.certificadoTrabajo[0];
        const result = await cloudinary.uploader.upload(archivo.path, {
          folder: 'documentos',
          resource_type: 'auto',
        });
        constanciaAfipUrl = result.secure_url;
        fs.unlinkSync(archivo.path);
      }

      if (req.files?.certificadoEstudio) {
        const archivo = req.files.certificadoEstudio[0];
        const result = await cloudinary.uploader.upload(archivo.path, {
          folder: 'documentos',
          resource_type: 'auto',
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

/**
 * Publicaciones
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

    const envioBool = envio === 'true' || envio === true;

    const compatParsed = JSON.parse(compatibilidad || '[]');

    const fotosUrls = [];
    for (const file of req.files) {
      const result = await cloudinary.uploader.upload(file.path, {
        folder: 'autopartes',
        resource_type: 'auto',
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

app.get('/publicaciones', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM publicaciones');
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
    imagenesAEliminar,
    envio,
    tipo_envio
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
          resource_type: 'auto',
        });
        nuevasFotos.push(uploadResult.secure_url);
        fs.unlinkSync(file.path);
      }
    }

    let envioBool = null;
    if (typeof envio !== 'undefined') {
      envioBool = envio === 'true' || envio === true;
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
        marca_repuesto = COALESCE($11, marca_repuesto),
        envio = COALESCE($12, envio),
        tipo_envio = COALESCE($13, tipo_envio)
      WHERE id = $14`,
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
        envioBool,
        tipo_envio || null,
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
 * Ventas
 */
app.post('/ventas', async (req, res) => {
  const {
    vendedor_id,
    comprador_id,
    publicacion_id,
    cantidad,
    monto,
    localidad_envio,
    direccion_envio,
    altura_envio,
    entrecalles_envio,
    confirmacioncomprador
  } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO ventas (
        vendedor_id, comprador_id, publicacion_id, cantidad, monto, fecha,
        localidad_envio, direccion_envio, altura_envio, entrecalles_envio, confirmacioncomprador
      )
      VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8, $9, $10) RETURNING *`,
      [
        vendedor_id,
        comprador_id,
        publicacion_id,
        cantidad,
        monto,
        localidad_envio || null,
        direccion_envio || null,
        altura_envio || null,
        entrecalles_envio || null,
        typeof confirmacioncomprador === 'undefined' ? false : confirmacioncomprador // CAMBIO confirmacioncomprador
      ]
    );
    res.status(201).json({ message: 'Venta registrada', venta: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar la venta' });
  }
});

// 🟢 NUEVO: Obtener todas las ventas con TODOS los datos de vendedor y comprador
app.get('/ventas-detalle', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT v.*, 
        p.nombre_producto, 
        u1.email AS vendedor_email, u1.nombre AS vendedor_nombre, u1.apellido AS vendedor_apellido, u1.telefono AS vendedor_telefono, u1.nombre_local AS vendedor_nombre_local, u1.localidad AS vendedor_localidad, u1.dni AS vendedor_dni,
        u2.email AS comprador_email, u2.nombre AS comprador_nombre, u2.apellido AS comprador_apellido, u2.telefono AS comprador_telefono, u2.nombre_local AS comprador_nombre_local, u2.localidad AS comprador_localidad, u2.dni AS comprador_dni
      FROM ventas v
      LEFT JOIN publicaciones p ON v.publicacion_id = p.id
      LEFT JOIN users u1 ON v.vendedor_id = u1.id
      LEFT JOIN users u2 ON v.comprador_id = u2.id
      ORDER BY v.fecha DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener ventas' });
  }
});

// 🟢 NUEVO: Editar datos de una venta (incluye pago_recibido)
app.put('/ventas/:id', async (req, res) => {
  const { id } = req.params;
  const {
    cantidad,
    monto,
    localidad_envio,
    direccion_envio,
    altura_envio,
    entrecalles_envio,
    pago_recibido,
    confirmacioncomprador // CAMBIO confirmacioncomprador
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE ventas SET
        cantidad = COALESCE($1, cantidad),
        monto = COALESCE($2, monto),
        localidad_envio = COALESCE($3, localidad_envio),
        direccion_envio = COALESCE($4, direccion_envio),
        altura_envio = COALESCE($5, altura_envio),
        entrecalles_envio = COALESCE($6, entrecalles_envio),
        pago_recibido = COALESCE($7, pago_recibido),
        confirmacioncomprador = COALESCE($8, confirmacioncomprador) -- CAMBIO confirmacioncomprador
      WHERE id = $9
      RETURNING *`,
      [
        cantidad || null,
        monto || null,
        localidad_envio || null,
        direccion_envio || null,
        altura_envio || null,
        entrecalles_envio || null,
        typeof pago_recibido === 'undefined' ? null : pago_recibido,

        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }

    // Traer detalles para devolver igual que /ventas-detalle
    const detalle = await pool.query(
      `SELECT v.*, 
        p.nombre_producto, 
        u1.email AS vendedor_email, u1.nombre AS vendedor_nombre, u1.apellido AS vendedor_apellido, u1.telefono AS vendedor_telefono, u1.nombre_local AS vendedor_nombre_local, u1.localidad AS vendedor_localidad, u1.dni AS vendedor_dni,
        u2.email AS comprador_email, u2.nombre AS comprador_nombre, u2.apellido AS comprador_apellido, u2.telefono AS comprador_telefono, u2.nombre_local AS comprador_nombre_local, u2.localidad AS comprador_localidad, u2.dni AS comprador_dni
      FROM ventas v
      LEFT JOIN publicaciones p ON v.publicacion_id = p.id
      LEFT JOIN users u1 ON v.vendedor_id = u1.id
      LEFT JOIN users u2 ON v.comprador_id = u2.id
      WHERE v.id = $1`,
      [id]
    );

    res.json({ message: 'Venta actualizada', venta: detalle.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar venta' });
  }
});

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

app.get('/usuarios/:id/ventas', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT v.*, p.nombre_producto, p.envio, p.tipo_envio
       FROM ventas v
       LEFT JOIN publicaciones p ON v.publicacion_id = p.id
       WHERE v.vendedor_id = $1
       ORDER BY v.fecha DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener ventas del usuario' });
  }
});

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
 * Recuperación de contraseña
 */
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

app.post('/ventas/:id/comprobante', upload.single('comprobante'), async (req, res) => {
  const { id } = req.params;
  try {
    if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' });

    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'comprobantes',
      resource_type: 'auto',
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

app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});