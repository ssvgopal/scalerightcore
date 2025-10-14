// src/config.js
module.exports = {
  server: {
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || '0.0.0.0'
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'change-in-production'
  }
};
