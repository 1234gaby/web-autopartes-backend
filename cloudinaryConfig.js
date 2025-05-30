// cloudinaryConfig.js
require('dotenv').config(); // Carga variables de entorno desde .env

const cloudinary = require('cloudinary').v2;

// Validación básica de variables necesarias
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  throw new Error('Faltan variables de entorno para la configuración de Cloudinary');
}

// Configuración de Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Exportación del cliente de Cloudinary configurado
module.exports = cloudinary;
