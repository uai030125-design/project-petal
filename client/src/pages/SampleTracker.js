import React, { useState, useMemo, useCallback } from 'react';
import PageHeader from '../components/shared/PageHeader';

// ── Category color mapping ──
const CATEGORY_COLORS = {
  'Caftan': '#e8d4f1',
  'Missy Dress': '#d4e8f1',
  'Scrubs': '#d4f1e8',
  'Junior': '#f1e8d4',
};

const getCategoryColor = (category) => CATEGORY_COLORS[category] || '#f0f0f0';

// ── Initial seed data ──
const INITIAL_SAMPLES = [];

// ── Status badge styling ──
const StatusBadge = ({ status }) => {
  const bgColor = {
    'Available': '#d4f1e8',
    'Out': '#f1d4d4',
    'Pending': '#f1e8d4',
  }[status] || '#f0f0f0';

  const textColor = {
    'Available': '#2d6a4f',
    'Out': '#8b2e2e',
    'Pending': '#8b7a2e',
  }[status] || '#666';

  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 600,
      backgroundColor: bgColor,
      color: textColor,
    }}>
      {status}
    </span>
  );
};

// ── Category badge ──
const CategoryBadge = ({ category }) => {
  return (
    <span style={{
      display: 'inline-block',
      padding: '4px 10px',
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 600,
      backgroundColor: getCategoryColor(category),
      color: '#333',
    }}>
      {category}
    </span>
  );
};

// ── Editable spec field ──
const EditableSpec = ({ label, value, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleSave = () => {
    onSave(editValue);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
          {label}
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            style={{
              flex: 1,
              padding: '8px 12px',
              border: '1px solid var(--accent-dark)',
              borderRadius: 4,
              fontSize: 13,
              fontFamily: 'inherit',
              backgroundColor: 'var(--surface)',
              color: 'var(--text)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') setIsEditing(false);
            }}
          />
          <button
            onClick={handleSave}
            style={{
              padding: '8px 12px',
              borderRadius: 4,
              border: '1px solid var(--accent-dark)',
              backgroundColor: 'var(--accent-dark)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 14, cursor: 'pointer' }} onClick={() => setIsEditing(true)}>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
        {label}
      </label>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text)', padding: '8px 0' }}>
        {value || <em style={{ color: 'var(--text-muted)' }}>Click to edit</em>}
      </p>
    </div>
  );
};

export default function SampleTracker() {
  const [samples, setSamples] = useState(() => {
    const stored = localStorage.getItem('ua_sample_tracker');
    return stored ? JSON.parse(stored) : INITIAL_SAMPLES;
  });

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newForm, setNewForm] = useState({
    reference: '',
    category: 'Caftan',
    name: '',
    colors: '',
    fabric: '',
    sizeRange: '',
    status: 'Available',
    notes: '',
    imageUrl: null,
  });

  // Persist to localStorage
  const saveSamples = useCallback((updatedSamples) => {
    setSamples(updatedSamples);
    localStorage.setItem('ua_sample_tracker', JSON.stringify(updatedSamples));
  }, []);

  // Filter samples
  const filtered = useMemo(() => {
    if (!search) return samples;
    const q = search.toLowerCase();
    return samples.filter(
      (s) =>
        s.reference.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.notes.toLowerCase().includes(q)
    );
  }, [samples, search]);

  const selectedSample = selectedId ? samples.find((s) => s.id === selectedId) : null;

  // Update a field in the selected sample
  const updateSampleField = useCallback(
    (field, value) => {
      if (!selectedSample) return;
      const updated = samples.map((s) =>
        s.id === selectedSample.id ? { ...s, [field]: value } : s
      );
      saveSamples(updated);
    },
    [selectedSample, samples, saveSamples]
  );

  // Add new sample
  const handleAddSample = () => {
    if (!newForm.reference.trim()) {
      alert('Reference # is required');
      return;
    }
    const newSample = {
      id: newForm.reference,
      ...newForm,
    };
    saveSamples([newSample, ...samples]);
    setNewForm({
      reference: '',
      category: 'Caftan',
      name: '',
      colors: '',
      fabric: '',
      sizeRange: '',
      status: 'Available',
      notes: '',
      imageUrl: null,
    });
    setShowAddModal(false);
  };

  // Delete sample
  const handleDeleteSample = (id) => {
    if (window.confirm('Delete this sample?')) {
      saveSamples(samples.filter((s) => s.id !== id));
      if (selectedId === id) setSelectedId(null);
    }
  };

  // Handle image upload
  const handleImageUpload = (e, isNew = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      if (isNew) {
        setNewForm((p) => ({ ...p, imageUrl: reader.result }));
      } else {
        updateSampleField('imageUrl', reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader title="Sample Tracker" />

      {/* Main two-panel layout */}
      <div style={{ display: 'flex', gap: 0, flex: 1, overflow: 'hidden' }}>
        {/* ── LEFT PANEL ── */}
        <div
          style={{
            width: 320,
            backgroundColor: 'var(--surface2)',
            borderRight: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header & Search */}
          <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)' }}>
            <h3
              style={{
                margin: '0 0 12px 0',
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--accent-dark)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              SAMPLE TRACKER
            </h3>
            <input
              type="text"
              placeholder="Search samples…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 4,
                fontSize: 12,
                fontFamily: 'inherit',
                backgroundColor: 'var(--surface)',
                color: 'var(--text)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Add Sample Button */}
          <div style={{ padding: '12px 12px' }}>
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                width: '100%',
                padding: '9px 12px',
                backgroundColor: 'var(--accent-dark)',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              + Add Sample
            </button>
          </div>

          {/* Sample List */}
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '0 8px 8px',
            }}
          >
            {filtered.length === 0 ? (
              <div
                style={{
                  padding: '20px 12px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: 12,
                }}
              >
                {samples.length === 0 ? 'Nothing available.' : 'No samples found.'}
              </div>
            ) : (
              filtered.map((sample) => (
                <div
                  key={sample.id}
                  onClick={() => setSelectedId(sample.id)}
                  style={{
                    padding: '12px',
                    marginBottom: 8,
                    backgroundColor:
                      selectedId === sample.id ? 'var(--accent-dim)' : 'var(--surface)',
                    border:
                      selectedId === sample.id
                        ? '2px solid var(--accent-dark)'
                        : '1px solid var(--border)',
                    borderRadius: 6,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (selectedId !== sample.id) {
                      e.currentTarget.style.backgroundColor = 'var(--surface2)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedId !== sample.id) {
                      e.currentTarget.style.backgroundColor = 'var(--surface)';
                    }
                  }}
                >
                  <div style={{ marginBottom: 6 }}>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: 'var(--accent-dark)',
                        marginRight: 8,
                      }}
                    >
                      {sample.reference}
                    </span>
                    <CategoryBadge category={sample.category} />
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12,
                        color: 'var(--text)',
                        lineHeight: 1.3,
                      }}
                    >
                      {sample.name}
                    </p>
                  </div>
                  <div>
                    <StatusBadge status={sample.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div
          style={{
            flex: 1,
            backgroundColor: 'var(--surface)',
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {selectedSample ? (
            <div style={{ padding: '24px', height: '100%', overflow: 'auto' }}>
              {/* Image area */}
              <div
                style={{
                  width: '100%',
                  height: 300,
                  backgroundColor: 'var(--surface2)',
                  borderRadius: 8,
                  border: '2px dashed var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 24,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {selectedSample.imageUrl ? (
                  <img
                    src={selectedSample.imageUrl}
                    alt={selectedSample.reference}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 48, marginBottom: 8 }}>📷</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Drag & drop or click to upload
                    </div>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, false)}
                  onClick={(e) => (e.currentTarget.value = '')}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer',
                  }}
                />
              </div>

              {/* Specs Banner */}
              <div
                style={{
                  backgroundColor: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '20px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                }}
              >
                {/* Reference & Category */}
                <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                  <h2
                    style={{
                      margin: '0 0 8px 0',
                      fontSize: 24,
                      fontWeight: 700,
                      color: 'var(--text)',
                    }}
                  >
                    {selectedSample.reference}
                  </h2>
                  <div style={{ marginBottom: 8 }}>
                    <CategoryBadge category={selectedSample.category} />
                  </div>
                  <div>
                    <StatusBadge status={selectedSample.status} />
                  </div>
                </div>

                {/* Editable fields */}
                <EditableSpec
                  label="Name / Description"
                  value={selectedSample.name}
                  onSave={(v) => updateSampleField('name', v)}
                />
                <EditableSpec
                  label="Category"
                  value={selectedSample.category}
                  onSave={(v) => updateSampleField('category', v)}
                />
                <EditableSpec
                  label="Colors Available"
                  value={selectedSample.colors}
                  onSave={(v) => updateSampleField('colors', v)}
                />
                <EditableSpec
                  label="Fabric Composition"
                  value={selectedSample.fabric}
                  onSave={(v) => updateSampleField('fabric', v)}
                />
                <EditableSpec
                  label="Size Range"
                  value={selectedSample.sizeRange}
                  onSave={(v) => updateSampleField('sizeRange', v)}
                />
                <EditableSpec
                  label="Status"
                  value={selectedSample.status}
                  onSave={(v) => updateSampleField('status', v)}
                />

                {/* Notes textarea */}
                <div style={{ marginBottom: 14 }}>
                  <label
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      display: 'block',
                      marginBottom: 4,
                    }}
                  >
                    Notes
                  </label>
                  <textarea
                    value={selectedSample.notes}
                    onChange={(e) => updateSampleField('notes', e.target.value)}
                    placeholder="Add notes…"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      fontSize: 13,
                      fontFamily: 'inherit',
                      backgroundColor: 'var(--surface)',
                      color: 'var(--text)',
                      outline: 'none',
                      boxSizing: 'border-box',
                      resize: 'vertical',
                      minHeight: 80,
                    }}
                  />
                </div>

                {/* Tech Pack */}
                <div style={{ marginBottom: 14 }}>
                  <label
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      display: 'block',
                      marginBottom: 4,
                    }}
                  >
                    Tech Pack
                  </label>
                  <input
                    type="text"
                    value={selectedSample.techPackUrl}
                    onChange={(e) => updateSampleField('techPackUrl', e.target.value)}
                    placeholder="Paste tech pack URL…"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      fontSize: 13,
                      fontFamily: 'inherit',
                      backgroundColor: 'var(--surface)',
                      color: 'var(--text)',
                      outline: 'none',
                      boxSizing: 'border-box',
                      marginBottom: 8,
                    }}
                  />
                  {selectedSample.techPackUrl && (
                    <a
                      href={selectedSample.techPackUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--accent-dark)',
                        textDecoration: 'none',
                        gap: 6,
                      }}
                    >
                      📄 Download Tech Pack
                    </a>
                  )}
                </div>

                {/* Actions */}
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    marginTop: 20,
                    paddingTop: 16,
                    borderTop: '1px solid var(--border)',
                  }}
                >
                  <button
                    onClick={() => handleDeleteSample(selectedSample.id)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 4,
                      border: '1px solid #e53e3e',
                      backgroundColor: 'transparent',
                      color: '#e53e3e',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                fontSize: 14,
              }}
            >
              Select a sample to view details
            </div>
          )}
        </div>
      </div>

      {/* ── ADD SAMPLE MODAL ── */}
      {showAddModal && (
        <div
          onClick={() => setShowAddModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius)',
              padding: '28px 32px',
              minWidth: 380,
              maxWidth: 600,
              width: '92%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
              border: '1px solid var(--border)',
            }}
          >
            <h3 style={{ margin: '0 0 20px', color: 'var(--accent-dark)', fontSize: 17 }}>
              Add New Sample
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    display: 'block',
                    marginBottom: 5,
                  }}
                >
                  Reference #
                </label>
                <input
                  value={newForm.reference}
                  onChange={(e) => setNewForm((p) => ({ ...p, reference: e.target.value }))}
                  placeholder="e.g. REF-006"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    fontSize: 13,
                    fontFamily: 'inherit',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    display: 'block',
                    marginBottom: 5,
                  }}
                >
                  Category
                </label>
                <select
                  value={newForm.category}
                  onChange={(e) => setNewForm((p) => ({ ...p, category: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    fontSize: 13,
                    fontFamily: 'inherit',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                >
                  <option>Caftan</option>
                  <option>Missy Dress</option>
                  <option>Scrubs</option>
                  <option>Junior</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  display: 'block',
                  marginBottom: 5,
                }}
              >
                Name / Description
              </label>
              <input
                value={newForm.name}
                onChange={(e) => setNewForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Silk Blend Caftan"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  fontSize: 13,
                  fontFamily: 'inherit',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    display: 'block',
                    marginBottom: 5,
                  }}
                >
                  Colors
                </label>
                <input
                  value={newForm.colors}
                  onChange={(e) => setNewForm((p) => ({ ...p, colors: e.target.value }))}
                  placeholder="e.g. Ivory, Black, Navy"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    fontSize: 13,
                    fontFamily: 'inherit',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    display: 'block',
                    marginBottom: 5,
                  }}
                >
                  Fabric Composition
                </label>
                <input
                  value={newForm.fabric}
                  onChange={(e) => setNewForm((p) => ({ ...p, fabric: e.target.value }))}
                  placeholder="e.g. 100% Silk"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    fontSize: 13,
                    fontFamily: 'inherit',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    display: 'block',
                    marginBottom: 5,
                  }}
                >
                  Size Range
                </label>
                <input
                  value={newForm.sizeRange}
                  onChange={(e) => setNewForm((p) => ({ ...p, sizeRange: e.target.value }))}
                  placeholder="e.g. XS-2XL"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    fontSize: 13,
                    fontFamily: 'inherit',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    display: 'block',
                    marginBottom: 5,
                  }}
                >
                  Status
                </label>
                <select
                  value={newForm.status}
                  onChange={(e) => setNewForm((p) => ({ ...p, status: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    fontSize: 13,
                    fontFamily: 'inherit',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                >
                  <option>Available</option>
                  <option>Out</option>
                  <option>Pending</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 22 }}>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  display: 'block',
                  marginBottom: 5,
                }}
              >
                Image
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, true)}
                onClick={(e) => (e.currentTarget.value = '')}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  fontSize: 12,
                  fontFamily: 'inherit',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {newForm.imageUrl && (
                <img
                  src={newForm.imageUrl}
                  alt="preview"
                  style={{ marginTop: 10, maxHeight: 100, borderRadius: 4 }}
                />
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setShowAddModal(false)}
                style={{
                  padding: '9px 16px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  backgroundColor: 'transparent',
                  color: 'var(--text)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddSample}
                style={{
                  padding: '9px 16px',
                  borderRadius: 6,
                  backgroundColor: 'var(--accent-dark)',
                  color: '#fff',
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Add Sample
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
