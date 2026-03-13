import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Link } from 'react-router-dom';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useContext(AuthContext);

  // Reset password flow
  const [showReset, setShowReset] = useState(false);
  const [resetUsername, setResetUsername] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const res = await login(username, password);
    if (!res.success) {
      setError(res.message);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');

    if (!resetUsername.trim()) {
      setResetError('Ingresá tu nombre de usuario.');
      return;
    }
    if (resetNewPassword.length < 4) {
      setResetError('La contraseña debe tener al menos 4 caracteres.');
      return;
    }
    if (resetNewPassword !== resetConfirm) {
      setResetError('Las contraseñas no coinciden.');
      return;
    }

    setResetLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: resetUsername, newPassword: resetNewPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setResetSuccess('Contraseña actualizada con éxito. Podés iniciar sesión ahora.');
        setResetUsername('');
        setResetNewPassword('');
        setResetConfirm('');
      } else {
        setResetError(data.error || 'Error al resetear la contraseña.');
      }
    } catch {
      setResetError('Error de conexión. Intentá de nuevo.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1e1f22] flex items-center justify-center text-[#dbdee1]">
      <div className="bg-[#313338] p-8 rounded-md shadow-lg w-full max-w-md">

        {!showReset ? (
          <>
            <h2 className="text-2xl font-bold mb-2 text-center text-white">¡Bienvenido de vuelta!</h2>
            <p className="text-center text-[#b5bac1] mb-6">Nos alegra verte de nuevo</p>
            
            {error && <div className="bg-red-500/20 text-red-400 p-3 rounded mb-4 text-sm">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-2">Usuario</label>
                <input 
                  type="text" 
                  className="w-full bg-[#1e1f22] p-2.5 rounded text-white focus:outline-none focus:ring-2 focus:ring-[#5865f2]"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="mb-2">
                <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-2">Contraseña</label>
                <input 
                  type="password" 
                  className="w-full bg-[#1e1f22] p-2.5 rounded text-white focus:outline-none focus:ring-2 focus:ring-[#5865f2]"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="mb-6 text-right">
                <button
                  type="button"
                  onClick={() => setShowReset(true)}
                  className="text-xs text-[#00a8fc] hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <button 
                type="submit" 
                className="w-full bg-[#5865f2] hover:bg-[#4752c4] text-white font-semibold py-2.5 rounded transition"
              >
                Iniciar Sesión
              </button>
            </form>
            
            <div className="mt-4 text-sm text-[#b5bac1]">
              ¿Necesitas una cuenta? <Link to="/register" className="text-[#00a8fc] hover:underline">Regístrate</Link>
            </div>
          </>
        ) : (
          <>
            <button
              onClick={() => { setShowReset(false); setResetError(''); setResetSuccess(''); }}
              className="flex items-center gap-1.5 text-[#b5bac1] hover:text-white text-sm mb-5 transition"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
              Volver al inicio de sesión
            </button>

            <h2 className="text-2xl font-bold mb-2 text-white">Restablecer Contraseña</h2>
            <p className="text-[#b5bac1] text-sm mb-6">Ingresá tu usuario y elegí una nueva contraseña.</p>

            {resetError && <div className="bg-red-500/20 text-red-400 p-3 rounded mb-4 text-sm">{resetError}</div>}
            {resetSuccess && <div className="bg-green-500/20 text-green-400 p-3 rounded mb-4 text-sm">{resetSuccess}</div>}

            <form onSubmit={handleReset}>
              <div className="mb-4">
                <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-2">Nombre de Usuario</label>
                <input
                  type="text"
                  className="w-full bg-[#1e1f22] p-2.5 rounded text-white focus:outline-none focus:ring-2 focus:ring-[#5865f2]"
                  value={resetUsername}
                  onChange={e => setResetUsername(e.target.value)}
                  placeholder="Tu nombre de usuario"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-2">Nueva Contraseña</label>
                <input
                  type="password"
                  className="w-full bg-[#1e1f22] p-2.5 rounded text-white focus:outline-none focus:ring-2 focus:ring-[#5865f2]"
                  value={resetNewPassword}
                  onChange={e => setResetNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              <div className="mb-6">
                <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-2">Confirmar Contraseña</label>
                <input
                  type="password"
                  className="w-full bg-[#1e1f22] p-2.5 rounded text-white focus:outline-none focus:ring-2 focus:ring-[#5865f2]"
                  value={resetConfirm}
                  onChange={e => setResetConfirm(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={resetLoading}
                className="w-full bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-60 text-white font-semibold py-2.5 rounded transition"
              >
                {resetLoading ? 'Actualizando...' : 'Cambiar Contraseña'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
