#!/bin/bash
# =============================================================
#  deploy.sh — Script de despliegue en VPS para Pajabrava
#  Uso: bash deploy.sh
# =============================================================

set -e  # Parar si cualquier comando falla

echo ""
echo "================================================"
echo "  🚀 Desplegando Pajabrava en VPS..."
echo "================================================"
echo ""

# ── 1. Instalar dependencias del backend ──────────────────────
echo "📦 [1/5] Instalando dependencias del backend..."
cd backend
npm install --omit=dev
cd ..
echo "    ✅ Backend: OK"

# ── 2. Generar cliente de Prisma y sincronizar DB ─────────────
echo "🗄️  [2/5] Sincronizando base de datos..."
echo "    (Funciona tanto si la BD es nueva como si ya existe)"
cd backend
npx prisma generate
# db push sincroniza el schema sin necesitar carpeta migrations
# funciona con BD nueva y existente (a diferencia de migrate deploy)
npx prisma db push --accept-data-loss
echo "    ✅ Base de datos: OK"
cd ..

# ── 3. Instalar dependencias del frontend ─────────────────────
echo "📦 [3/5] Instalando dependencias del frontend..."
cd frontend
# Borrar lock file para evitar conflictos de versiones cacheadas
rm -f package-lock.json
npm install
echo "    ✅ Frontend deps: OK"

# ── 4. Buildear el frontend para produccion ───────────────────
echo "🔨 [4/5] Construyendo el frontend (esto puede tardar)..."
npm run build
cd ..
echo "    ✅ Build: OK"

# ── 5. Instalar 'serve' globalmente si no existe ──────────────
echo "🌐 [5/5] Verificando servidor estatico 'serve'..."
if ! command -v serve &> /dev/null; then
  npm install -g serve
  echo "    ✅ 'serve' instalado globalmente"
else
  echo "    ✅ 'serve' ya esta instalado"
fi

# ── Crear carpeta de logs si no existe ───────────────────────
mkdir -p logs

echo ""
echo "================================================"
echo "  ✅ Deploy completado!"
echo ""
echo "  Para iniciar los servicios con PM2:"
echo "    pm2 start ecosystem.config.cjs"
echo ""
echo "  Para que arranquen solos al reiniciar el VPS:"
echo "    pm2 save"
echo "    pm2 startup"
echo "================================================"
echo ""
