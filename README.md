# 🦜 Pajabrava — Guía de Despliegue en VPS

## Estructura del proyecto

```
DiscordPajabrava/
├── backend/               → Servidor Node.js + Express + Socket.IO
│   ├── .env               → Variables de entorno del backend
│   ├── server.js          → Punto de entrada
│   ├── routes/            → Rutas REST (auth, channels)
│   ├── sockets/           → Lógica de WebSocket / WebRTC
│   └── prisma/            → Base de datos SQLite
│       └── dev.db         → Archivo de base de datos (se crea automático)
├── frontend/              → App React + Vite + TailwindCSS
│   ├── .env               → ⚠️ URL del backend (LA QUE MÁS VAS A TOCAR)
│   └── src/
├── ecosystem.config.cjs   → Configuración de PM2
├── deploy.sh              → Script de setup inicial (solo Linux/VPS)
├── instalar_pajabrava.bat → Instalar dependencias en Windows
└── iniciar_pajabrava.bat  → Iniciar en modo desarrollo (Windows local)
```

---

## ⚙️ Variables de entorno — Dónde tocar

### `frontend/.env` — La más importante

```env
# LOCAL (tu PC):
VITE_API_URL=http://localhost:3001

# VPS / PRODUCCIÓN (cambiar por tu IP real):
# VITE_API_URL=http://179.41.169.104:3001
```

> Comentá/descomentá según dónde estés corriendo la app.

### `backend/.env`

```env
PORT=3001                          # Puerto del servidor backend
JWT_SECRET=supersecret_dev_key     # ⚠️ Cambiar por algo seguro en producción
```

> El frontend tiene que apuntar al mismo puerto que `PORT`.

---

## 🖥️ Desarrollo local (Windows)

### Primera vez
```bat
instalar_pajabrava.bat
```

### Iniciar servidores
```bat
iniciar_pajabrava.bat
```

Esto abre dos ventanas: una con el backend (`localhost:3001`) y otra con el frontend (`localhost:5173`).

Asegurate de que `frontend/.env` tenga:
```
VITE_API_URL=http://localhost:3001
```

---

## 🚀 Despliegue en VPS (Linux)

### Requisitos previos en el servidor

```bash
# Node.js v18 o superior
node -v

# PM2 instalado globalmente
npm install -g pm2

# serve instalado globalmente (para servir el frontend buildeado)
npm install -g serve
```

---

### Paso 1 — Clonar el repositorio en el VPS

```bash
git clone <URL_DEL_REPO> pajabrava
cd pajabrava
```

---

### Paso 2 — Configurar variables de entorno

**Backend:**
```bash
cp backend/.env.example backend/.env
nano backend/.env
```
```env
PORT=3001
JWT_SECRET=cambia_esto_por_algo_muy_seguro_y_largo
```

**Frontend:**
```bash
cp frontend/.env.example frontend/.env
nano frontend/.env
```
```env
VITE_API_URL=http://179.41.169.104:3001
```
> Reemplazá `179.41.169.104` por la IP pública de tu VPS.

---

### Paso 3 — Instalar, migrar y buildear

```bash
bash deploy.sh
```

Este script hace automáticamente:
1. Instala dependencias del backend (`npm install`)
2. Genera el cliente de Prisma y ejecuta migraciones de la DB
3. Instala dependencias del frontend
4. Buildea el frontend para producción (`npm run build`)
5. Verifica que `serve` esté instalado

---

### Paso 4 — Iniciar con PM2

```bash
pm2 start ecosystem.config.cjs
```

Verificá que ambos procesos estén corriendo:
```bash
pm2 status
```

Deberías ver algo así:
```
┌─────────────────────┬─────┬────────┬─────────┐
│ name                │ id  │ status │ uptime  │
├─────────────────────┼─────┼────────┼─────────┤
│ pajabrava-backend   │  0  │ online │ 10s     │
│ pajabrava-frontend  │  1  │ online │ 10s     │
└─────────────────────┴─────┴────────┴─────────┘
```

---

### Paso 5 — Auto-inicio al reiniciar el VPS

```bash
pm2 save
pm2 startup
# Ejecutá el comando que te muestra en pantalla (empieza con "sudo env...")
```

---

## 🔄 Actualizar el código en el VPS

Cuando hagas cambios y quieras actualizarlos en el servidor:

```bash
# 1. Traer los cambios
git pull

# 2a. Si cambiaste solo el BACKEND:
pm2 restart pajabrava-backend

# 2b. Si cambiaste el FRONTEND (hay que rebuildar):
cd frontend
npm run build
cd ..
pm2 restart pajabrava-frontend

# 2c. Si cambiaste ambos o no estás seguro:
bash deploy.sh
pm2 restart all
```

---

## 📋 Comandos PM2 útiles

| Comando | Descripción |
|---------|-------------|
| `pm2 status` | Ver estado de todos los procesos |
| `pm2 logs` | Ver logs en tiempo real (Ctrl+C para salir) |
| `pm2 logs pajabrava-backend` | Logs solo del backend |
| `pm2 logs pajabrava-frontend` | Logs solo del frontend |
| `pm2 restart all` | Reiniciar todos los procesos |
| `pm2 stop all` | Parar todos los procesos |
| `pm2 delete all` | Eliminar todos los procesos de PM2 |
| `pm2 monit` | Monitor visual en tiempo real |

Los archivos de log se guardan en:
```
logs/backend-error.log
logs/backend-out.log
logs/frontend-error.log
logs/frontend-out.log
```

---

## 🌐 Puertos que deben estar abiertos en el firewall del VPS

| Puerto | Servicio |
|--------|---------|
| `3001` | Backend (API REST + Socket.IO) |
| `5173` | Frontend (React buildeado) |

Para abrirlos en Ubuntu/Debian con `ufw`:
```bash
sudo ufw allow 3001
sudo ufw allow 5173
sudo ufw reload
```

---

## 🗄️ Base de datos

La app usa **SQLite** (archivo local, no necesita instalar ningún motor de DB).

- Archivo: `backend/prisma/dev.db`
- Se crea automáticamente la primera vez que corres `prisma migrate deploy`
- **No subas este archivo al repositorio** (ya está en `.gitignore`)

Para hacer un backup de la DB en el VPS:
```bash
cp backend/prisma/dev.db backend/prisma/backup_$(date +%Y%m%d).db
```

---

## ❓ Problemas comunes

**"Error de conexión" al loguearse:**
- Verificá que `frontend/.env` tenga la IP correcta del VPS
- Verificá que el backend esté corriendo: `pm2 status`
- Verificá que el puerto 3001 esté abierto: `curl http://localhost:3001`

**El frontend no carga:**
- Verificá que el build esté hecho: `ls frontend/dist/`
- Si la carpeta `dist/` no existe, corré: `cd frontend && npm run build`

**PM2 no encuentra `serve`:**
```bash
npm install -g serve
pm2 restart pajabrava-frontend
```

**Los cambios del frontend no se reflejan:**
- Hay que rebuildar: `cd frontend && npm run build && pm2 restart pajabrava-frontend`
