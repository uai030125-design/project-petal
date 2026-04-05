import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import NeedleLogo from '../components/NeedleLogo';

export default function ResetPassword() {
  const [email, setEmail] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, securityAnswer, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reset failed');
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.message);
    }
  };

  const labelStyle = {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ width: 380, padding: 40, background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <NeedleLogo size={56} />
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4, textAlign: 'center', letterSpacing: '-0.3px', color: 'var(--text)' }}>
          Reset Password
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', marginBottom: 28, letterSpacing: '1px', textTransform: 'uppercase' }}>
          Verify your identity
        </p>

        {success ? (
          <div style={{ background: 'rgba(34,197,94,0.08)', color: '#22c55e', padding: '14px 18px', borderRadius: 8, fontSize: 14, textAlign: 'center', lineHeight: 1.5 }}>
            Password updated! Redirecting to login...
          </div>
        ) : (
          <>
            {error && (
              <div style={{ background: 'rgba(196,80,80,0.08)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 6, fontSize: 13, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Email</label>
                <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@unlimitedavenues.com" required />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>What is the name of your company?</label>
                <input className="input" type="text" value={securityAnswer} onChange={e => setSecurityAnswer(e.target.value)} placeholder="Security answer" required />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>New Password</label>
                <input className="input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 6 characters" required />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Confirm Password</label>
                <input className="input" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter new password" required />
              </div>
              <button className="btn btn-primary" type="submit" style={{ width: '100%', justifyContent: 'center', padding: '12px 28px' }}>
                Reset Password
              </button>
            </form>
          </>
        )}

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Link to="/login" style={{ color: 'var(--accent)', fontSize: 13, textDecoration: 'none' }}>
            ← Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
