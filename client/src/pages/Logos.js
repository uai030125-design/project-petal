import React, { useState, useCallback } from 'react';
import PageHeader from '../components/shared/PageHeader';

const ACCENT = '#3C1A00';

const LOGO_CATEGORIES = [
  { id: 'brand', label: 'Brand Logos' },
  { id: 'buyer', label: 'Buyer Logos' },
  { id: 'misc', label: 'Other' },
];

export default function Logos() {
  const [logos, setLogos] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ua_logos') || '[]'); } catch { return []; }
  });
  const [activeCategory, setActiveCategory] = useState('brand');
  const [dragOver, setDragOver] = useState(false);

  const save = useCallback((updated) => {
    setLogos(updated);
    localStorage.setItem('ua_logos', JSON.stringify(updated));
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setLogos(prev => {
          const next = [...prev, {
            id: Date.now() + Math.random(),
            name: file.name.replace(/\.[^.]+$/, ''),
            src: ev.target.result,
            category: activeCategory,
            addedAt: new Date().toISOString(),
          }];
          localStorage.setItem('ua_logos', JSON.stringify(next));
          return next;
        });
      };
      reader.readAsDataURL(file);
    });
  }, [activeCategory]);

  const handleFileSelect = useCallback((e) => {
    const files = [...e.target.files].filter(f => f.type.startsWith('image/'));
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setLogos(prev => {
          const next = [...prev, {
            id: Date.now() + Math.random(),
            name: file.name.replace(/\.[^.]+$/, ''),
            src: ev.target.result,
            category: activeCategory,
            addedAt: new Date().toISOString(),
          }];
          localStorage.setItem('ua_logos', JSON.stringify(next));
          return next;
        });
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  }, [activeCategory]);

  const removeLogo = useCallback((id) => {
    save(logos.filter(l => l.id !== id));
  }, [logos, save]);

  const renameLogo = useCallback((id, newName) => {
    save(logos.map(l => l.id === id ? { ...l, name: newName } : l));
  }, [logos, save]);

  const filtered = logos.filter(l => l.category === activeCategory);

  return (
    <div className="fade-in">
      <PageHeader title="Logos" />

      {/* Category tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {LOGO_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            style={{
              padding: '7px 18px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
              background: activeCategory === cat.id ? ACCENT : 'var(--surface2)',
              color: activeCategory === cat.id ? '#fff' : 'var(--text-muted)',
            }}
          >{cat.label}</button>
        ))}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragOver ? ACCENT : 'var(--border)'}`,
          borderRadius: 12, padding: '28px 20px', textAlign: 'center',
          marginBottom: 24, transition: 'all 0.2s',
          background: dragOver ? 'rgba(60,26,0,0.04)' : 'transparent',
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>+</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
          Drop logo images here or{' '}
          <label style={{ color: ACCENT, cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}>
            browse
            <input type="file" accept="image/*" multiple onChange={handleFileSelect} style={{ display: 'none' }} />
          </label>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>PNG, SVG, JPG supported</div>
      </div>

      {/* Logo grid */}
      {filtered.length === 0 ? (
        <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          No logos in this category yet
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 16,
        }}>
          {filtered.map(logo => (
            <LogoCard key={logo.id} logo={logo} onRemove={removeLogo} onRename={renameLogo} />
          ))}
        </div>
      )}
    </div>
  );
}

function LogoCard({ logo, onRemove, onRename }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(logo.name);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', padding: 16, textAlign: 'center',
        position: 'relative', transition: 'all 0.2s',
        boxShadow: hovered ? '0 4px 16px rgba(0,0,0,0.06)' : 'none',
      }}
    >
      {hovered && (
        <button
          onClick={() => onRemove(logo.id)}
          style={{
            position: 'absolute', top: 6, right: 8,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 16, color: 'var(--text-muted)', lineHeight: 1,
          }}
          title="Remove"
        >&times;</button>
      )}
      <div style={{
        height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 10,
      }}>
        <img
          src={logo.src}
          alt={logo.name}
          style={{ maxWidth: '100%', maxHeight: 80, objectFit: 'contain' }}
        />
      </div>
      {editing ? (
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={() => { onRename(logo.id, name); setEditing(false); }}
          onKeyDown={e => { if (e.key === 'Enter') { onRename(logo.id, name); setEditing(false); } }}
          style={{
            width: '100%', textAlign: 'center', border: '1px solid var(--border)',
            borderRadius: 6, padding: '3px 6px', fontSize: 12, fontWeight: 600,
            background: 'var(--surface2)', outline: 'none',
          }}
        />
      ) : (
        <div
          onClick={() => setEditing(true)}
          style={{ fontSize: 12, fontWeight: 600, cursor: 'text', color: 'var(--text)' }}
          title="Click to rename"
        >{logo.name}</div>
      )}
    </div>
  );
}
