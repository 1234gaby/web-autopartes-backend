const { Sequelize } = require('sequelize')

// Crea una base de datos local llamada 'autopartes.db'
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './autopartes.db'
})

module.exports = sequelize
