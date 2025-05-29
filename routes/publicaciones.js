app.post('/publicaciones', upload.array('fotos', 5), async (req, res) => {
  try {
    const {
      nombre_producto, marca, modelo, precio,
      ubicacion, envio, tipo_envio, categoria,
      estado, codigo_serie, compatibilidad,
      marca_repuesto, user_id
    } = req.body;

    const compatParsed = JSON.parse(compatibilidad || '[]');

    // Subir todas las imágenes a Cloudinary
    const urls = [];
    for (const file of req.files) {
      const result = await cloudinary.uploader.upload(file.path, {
        folder: 'autopartes'
      });
      urls.push(result.secure_url);
    }

    await pool.query(`
      INSERT INTO publicaciones (
        nombre_producto, marca, modelo, precio, ubicacion, envio, tipo_envio,
        categoria, estado, codigo_serie, compatibilidad, marca_repuesto, fotos, user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `, [
      nombre_producto, marca, modelo, parseFloat(precio), ubicacion, envio, tipo_envio,
      categoria, estado, codigo_serie, JSON.stringify(compatParsed), marca_repuesto,
      JSON.stringify(urls), user_id
    ]);

    res.status(201).json({ message: 'Publicación creada con éxito' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear la publicación' });
  }
});
