// Archivo de configuración de PM2 para Pajabrava
// Uso: pm2 start ecosystem.config.cjs
//
// Comandos útiles:
//   pm2 start ecosystem.config.cjs   → Iniciar todos los servicios
//   pm2 stop all                     → Parar todos
//   pm2 restart all                  → Reiniciar todos
//   pm2 logs                         → Ver logs en tiempo real
//   pm2 status                       → Ver estado de los procesos
//   pm2 save                         → Guardar config para auto-inicio
//   pm2 startup                      → Generar script de auto-inicio en el VPS

module.exports = {
  apps: [
    // =====================================================
    //  BACKEND — Servidor Node.js / Express / Socket.IO
    // =====================================================
    {
      name: 'pajabrava-backend',
      script: 'server.js',
      cwd: './backend',             // Directorio del backend
      interpreter: 'node',
      watch: false,                 // false en produccion (true solo en dev)
      instances: 1,
      autorestart: true,            // Reiniciar automaticamente si crashea
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        PORT: 3001                  // Puede sobreescribirse desde .env
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

    // =====================================================
    //  FRONTEND — Build estatico servido con "serve"
    //  Requiere: npm install -g serve
    //            cd frontend && npm run build
    // =====================================================
    {
      name: 'pajabrava-frontend',
      script: 'serve',              // Requiere: npm install -g serve
      args: '-s dist -l 5173',      // Sirve la carpeta dist en el puerto 5173
      cwd: './frontend',            // Directorio del frontend
      interpreter: 'none',          // "serve" es un binario, no un script JS
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    }
  ]
};
