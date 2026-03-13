import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Link } from 'react-router-dom';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const res = await login(username, password);
    if (!res.success) {
      setError(res.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#1e1f22] flex items-center justify-center text-[#dbdee1]">
      <div className="bg-[#313338] p-8 rounded-md shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-white">¡Bienvenido de vuelta!</h2>
        <p className="text-center text-[#b5bac1] mb-6">Nos alegra verte de nuevo</p>
        
        {error && <div className="bg-red-500/20 text-red-500 p-3 rounded mb-4 text-sm">{error}</div>}

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
          <div className="mb-6">
            <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-2">Contraseña</label>
            <input 
              type="password" 
              className="w-full bg-[#1e1f22] p-2.5 rounded text-white focus:outline-none focus:ring-2 focus:ring-[#5865f2]"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
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
      </div>
    </div>
  );
}
