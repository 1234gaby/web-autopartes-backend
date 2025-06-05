const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER, // Debe ser la variable de entorno, no el email directo
    pass: process.env.GMAIL_PASS, // Usa una variable de entorno para la contraseña
  },
});

async function sendRecoveryEmail(toEmail) {
  // Usa la URL de frontend según el entorno, o por defecto localhost
  const FRONTEND_URL = process.env.FRONTEND_URL || 'https://web-autopartes.vercel.app/recuperacion';

  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: toEmail,
    subject: 'Recuperación de contraseña - Autopartes',
    html: `
      <p>Para recuperar tu contraseña, por favor ingresa a este enlace:</p>
      <p><a href="${FRONTEND_URL}/recuperacion">Recuperar contraseña</a></p>
      <p>En esa página deberás ingresar tu correo y DNI para poder actualizar tu contraseña.</p>
    `,
  };

  await transporter.sendMail(mailOptions);
}

module.exports = { sendRecoveryEmail };