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
    //  Puerto: 3001
    // =====================================================
    {
      name: 'pajabrava-backend',
      script: 'server.js',
      cwd: './backend',
      interpreter: 'node',
      watch: false,
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: '../logs/backend-error.log',
      out_file: '../logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

    // =====================================================
    //  FRONTEND — Servidor estático Node.js puro
    //  Puerto: 8080  →  http://IP_DEL_VPS:8080
    //  Sirve la carpeta frontend/dist (build de Vite)
    // =====================================================
    {
      name: 'pajabrava-frontend',
      script: 'frontend-server.mjs',   // servidor Node.js puro, sin dependencias
      cwd: './',
      interpreter: 'node',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        FRONTEND_PORT: 8080
      },
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    }
  ]
};
