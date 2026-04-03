import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NeedleLogo from '../components/NeedleLogo';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ width: 380, padding: 40, background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <NeedleLogo size={56} />
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4, textAlign: 'center', letterSpacing: '-0.3px', color: 'var(--text)' }}>
          Unlimited <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>Avenues</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', marginBottom: 28, letterSpacing: '1px', textTransform: 'uppercase' }}>Operations Dashboard</p>

        {error && (
          <div style={{ background: 'rgba(196,80,80,0.08)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 6, fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Email</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@unlimitedavenues.com" required />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Password</label>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" required />
          </div>
          <button className="btn btn-primary" type="submit" style={{ width: '100%', justifyContent: 'center', padding: '12px 28px' }}>
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}