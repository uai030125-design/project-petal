import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Plus,
  Minus,
  X,
  FileDown,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Image as ImageIcon,
} from 'lucide-react';
import api from '../utils/api';
import PageHeader from '../components/shared/PageHeader';
import { useToast } from '../components/shared/Toast';

const CATEGORIES = ['All', 'Dresses', 'Scrubs', 'Activewear', 'Tops', 'Bottoms'];

/* ── Utility: Format color badge ── */
function renderColorBadges(colors, colorCount, limit = 3) {
  if (!colors || colors.length === 0) return 'No colors';
  const arr = Array.isArray(colors) ? colors : colors.split(',').map(c => c.trim());
  const shown = arr.slice(0, limit);
  const more = arr.length - shown.length;
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
      {shown.map((c, i) => (
        <span key={i} className="badge-success" style={{ fontSize: 11 }}>
          {c}
        </span>
      ))}
      {more > 0 && (
        <span className="badge-neutral" style={{ fontSize: 11 }}>
          +{more} more
        </span>
      )}
    </div>
  );
}

/* ── StyleCard Component ── */
function StyleCard({ style, onAdd }) {
  return (
    <div className="showroom-card stagger-in">
      <div className="showroom-card-img" style={{ position: 'relative', overflow: 'hidden' }}>
        {style.image_url ? (
          <img
            src={style.image_url}
            alt={style.style_number}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transition: 'transform 0.3s ease',
            }}
            onMouseEnter={(e) => (e.target.style.transform = 'scale(1.05)')}
            onMouseLeave={(e) => (e.target.style.transform = 'scale(1)')}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              background: 'var(--surface-alt)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
            }}
          >
            <ImageIcon size={32} />
          </div>
        )}
      </div>
      <div className="showroom-card-info">
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
          {style.style_number}
        </div>
        <div style={{ fontSize: 11, marginBottom: 8, color: 'var(--text-muted)' }}>
          {style.color_count || style.colors?.length || 0} colors
        </div>
        <div style={{ marginBottom: 10, minHeight: 24 }}>
          {renderColorBadges(style.colors, style.color_count, 2)}
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => onAdd(style)}>
          <Plus size={14} />
          Add
        </button>
      </div>
    </div>
  );
}

/* ── LineItem Component ── */
function LineItem({ item, onUpdate, onRemove, onMoveUp, onMoveDown, isFirst, isLast }) {
  return (
    <div
      className="card"
      style={{
        padding: 12,
        marginBottom: 8,
        display: 'grid',
        gridTemplateColumns: '40px 80px 1fr 100px 100px 60px',
        gap: 12,
        alignItems: 'center',
      }}
    >
      {/* Drag handle */}
      <div style={{ color: 'var(--text-muted)', cursor: 'grab' }}>
        <GripVertical size={16} />
      </div>

      {/* Thumbnail */}
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: 4,
          overflow: 'hidden',
          background: 'var(--surface-alt)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.style_number}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <ImageIcon size={20} color="var(--text-muted)" />
        )}
      </div>

      {/* Style Number */}
      <div>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
          {item.style_number}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {item.category || 'No category'}
        </div>
      </div>

      {/* Wholesale Price */}
      <input
        type="number"
        className="input"
        placeholder="Wholesale"
        value={item.wholesale_price || ''}
        onChange={(e) => onUpdate(item.id, { wholesale_price: e.target.value })}
        style={{ fontSize: 13 }}
        step="0.01"
      />

      {/* Notes */}
      <input
        type="text"
        className="input"
        placeholder="Notes"
        value={item.notes || ''}
        onChange={(e) => onUpdate(item.id, { notes: e.target.value })}
        style={{ fontSize: 13 }}
      />

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => onMoveUp(item.id)}
          disabled={isFirst}
          title="Move up"
        >
          <ChevronUp size={14} />
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => onMoveDown(item.id)}
          disabled={isLast}
          title="Move down"
        >
          <ChevronDown size={14} />
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => onRemove(item.id)}
          title="Remove"
          style={{ color: 'var(--destructive)' }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

/* ── Main Component ── */
export default function LineSheetBuilder() {
  const toast = useToast();

  /* State */
  const [styles, setStyles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [lineItems, setLineItems] = useState([]);

  /* Fetch styles on mount and category change */
  useEffect(() => {
    const fetchStyles = async () => {
      try {
        setLoading(true);
        const params = {};
        if (selectedCategory !== 'All') params.category = selectedCategory;
        if (searchQuery.trim()) params.search = searchQuery.trim();

        const res = await api.get('/styles', { params });
        const data = Array.isArray(res.data?.data) ? res.data.data : [];
        setStyles(data);
      } catch (err) {
        toast.error('Failed to load styles');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    // Debounce search
    const timer = setTimeout(fetchStyles, 300);
    return () => clearTimeout(timer);
  }, [selectedCategory, searchQuery, toast]);

  /* Add style to line sheet */
  const handleAddStyle = useCallback((style) => {
    const newItem = {
      id: `item_${Date.now()}_${Math.random()}`,
      style_number: style.style_number,
      category: style.category,
      colors: style.colors,
      color_count: style.color_count,
      image_url: style.image_url,
      wholesale_price: '',
      notes: '',
    };
    setLineItems([...lineItems, newItem]);
    toast.success(`Added ${style.style_number}`);
  }, [lineItems, toast]);

  /* Update line item */
  const handleUpdateItem = useCallback((id, updates) => {
    setLineItems(prev =>
      prev.map(item => (item.id === id ? { ...item, ...updates } : item))
    );
  }, []);

  /* Remove line item */
  const handleRemoveItem = useCallback((id) => {
    setLineItems(prev => prev.filter(item => item.id !== id));
    toast.success('Style removed');
  }, [toast]);

  /* Move item up */
  const handleMoveUp = useCallback((id) => {
    setLineItems(prev => {
      const idx = prev.findIndex(item => item.id === id);
      if (idx <= 0) return prev;
      const copy = [...prev];
      [copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]];
      return copy;
    });
  }, []);

  /* Move item down */
  const handleMoveDown = useCallback((id) => {
    setLineItems(prev => {
      const idx = prev.findIndex(item => item.id === id);
      if (idx < 0 || idx >= prev.length - 1) return prev;
      const copy = [...prev];
      [copy[idx], copy[idx + 1]] = [copy[idx + 1], copy[idx]];
      return copy;
    });
  }, []);

  /* Export to PDF via print */
  const handleExportPDF = useCallback(() => {
    if (lineItems.length === 0) {
      toast.error('Add styles to your line sheet first');
      return;
    }

    // Create a new window with print-friendly HTML
    const printWindow = window.open('', '', 'width=1200,height=800');
    const today = new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Line Sheet</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 40px;
            background: white;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #ddd;
            padding-bottom: 15px;
          }
          .header h1 { font-size: 28px; margin-bottom: 8px; }
          .header p { font-size: 13px; color: #666; }
          .grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin-bottom: 40px;
          }
          .style-card {
            border: 1px solid #ddd;
            padding: 12px;
            border-radius: 6px;
          }
          .style-image {
            width: 100%;
            height: 200px;
            background: #f5f5f5;
            margin-bottom: 10px;
            border-radius: 4px;
            overflow: hidden;
          }
          .style-image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .style-number { font-weight: 700; font-size: 14px; margin-bottom: 8px; }
          .style-category { font-size: 12px; color: #666; margin-bottom: 6px; }
          .style-colors { font-size: 11px; color: #999; margin-bottom: 8px; }
          .style-price { font-weight: 600; font-size: 13px; margin-bottom: 4px; }
          .style-notes { font-size: 11px; color: #666; font-style: italic; }
          @media print {
            body { margin: 0; padding: 20px; }
            .grid { gap: 15px; }
            .style-card { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Line Sheet</h1>
          <p>Generated on ${today}</p>
        </div>
        <div class="grid">
          ${lineItems
            .map(
              item => `
            <div class="style-card">
              <div class="style-image">
                ${item.image_url ? `<img src="${item.image_url}" alt="${item.style_number}" />` : ''}
              </div>
              <div class="style-number">${item.style_number}</div>
              <div class="style-category">${item.category || 'N/A'}</div>
              <div class="style-colors">
                ${Array.isArray(item.colors) ? item.colors.join(', ') : item.colors || 'N/A'}
              </div>
              ${item.wholesale_price ? `<div class="style-price">Wholesale: $${parseFloat(item.wholesale_price).toFixed(2)}</div>` : ''}
              ${item.notes ? `<div class="style-notes">${item.notes}</div>` : ''}
            </div>
          `
            )
            .join('')}
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }, [lineItems, toast]);

  /* Filter styles for display */
  const filteredStyles = useMemo(() => {
    return styles.filter(style => {
      const matchesSearch = !searchQuery.trim() ||
        style.style_number.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [styles, searchQuery]);

  return (
    <div className="fade-in">
      <PageHeader
        title="Line Sheet Builder"
      />

      {/* Main two-panel layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '60% 1fr',
          gap: 20,
          marginBottom: 20,
        }}
      >
        {/* LEFT PANEL: Catalog */}
        <div>
          {/* Search Bar */}
          <div className="card" style={{ marginBottom: 16, padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Search size={18} color="var(--text-muted)" />
              <input
                type="text"
                className="search-input"
                placeholder="Search by style number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ flex: 1 }}
              />
            </div>
          </div>

          {/* Category Filter Pills */}
          <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                className={`filter-pill ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Style Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 12,
            }}
          >
            {loading ? (
              <div style={{ gridColumn: '1 / -1', padding: 20, textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)' }}>Loading styles...</p>
              </div>
            ) : filteredStyles.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', padding: 20, textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)' }}>No styles found</p>
              </div>
            ) : (
              filteredStyles.map(style => (
                <StyleCard
                  key={style.id}
                  style={style}
                  onAdd={handleAddStyle}
                />
              ))
            )}
          </div>
        </div>

        {/* RIGHT PANEL: Your Line Sheet */}
        <div>
          <div className="card" style={{ padding: 16 }}>
            <h3
              style={{
                fontSize: 16,
                fontWeight: 700,
                marginBottom: 16,
                color: 'var(--text)',
              }}
            >
              Your Line Sheet
            </h3>

            {lineItems.length === 0 ? (
              <div
                style={{
                  padding: 20,
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                }}
              >
                <p>Add styles from the catalog to build your line sheet</p>
              </div>
            ) : (
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {lineItems.map((item, idx) => (
                  <LineItem
                    key={item.id}
                    item={item}
                    onUpdate={handleUpdateItem}
                    onRemove={handleRemoveItem}
                    onMoveUp={handleMoveUp}
                    onMoveDown={handleMoveDown}
                    isFirst={idx === 0}
                    isLast={idx === lineItems.length - 1}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Summary & Export */}
      <div
        className="card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 16,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
          {lineItems.length} style{lineItems.length !== 1 ? 's' : ''} selected
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setLineItems([]);
              toast.success('Line sheet cleared');
            }}
          >
            <Minus size={14} />
            Clear
          </button>
          <button className="btn btn-primary" onClick={handleExportPDF}>
            <FileDown size={14} />
            Export PDF
          </button>
        </div>
      </div>
    </div>
  );
}
