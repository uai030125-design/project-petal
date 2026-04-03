import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Save, CheckCircle2 } from 'lucide-react';
import api from '../utils/api';

const STORAGE_KEY = 'petal_consolidated_notes';

const SECTIONS = [
  {
    id: 'home',
    title: 'Home',
    path: '/',
    icon: '\u{1F3E0}',
    color: '#2A1F1A',
    summary: 'Command center with Library panel and AI chat assistant.',
    details: [
      'Dark Library panel on the left with quick-access reports and line sheet exports',
      'AI-powered chat assistant that answers questions about orders, routing, and warehouse data',
      'Quick-action chips for common queries like unrouted orders or Burlington summaries',
      'Line sheet export generates Excel files with embedded product images in a 3-column grid layout',
    ],
    tech: 'React, SheetJS (CDN), base64 image embedding for Excel exports',
  },
  {
    id: 'shipping',
    title: 'Shipping',
    path: '/shipping',
    icon: '\u{1F69A}',
    color: '#2D5A3D',
    summary: 'Track shipments with a rolling 14-day window showing real date ranges.',
    details: [
      'Dynamic "Next 14 Days" label that displays actual date range (e.g. Mar 20 \u2014 Apr 3)',
      'Shipment tracking with status updates and carrier information',
      'STAR vs CSM warehouse breakdown',
    ],
    tech: 'React, Express API, PostgreSQL',
  },
  {
    id: 'production',
    title: 'Production',
    path: '/production',
    icon: '\u{1F3ED}',
    color: '#3D6B4F',
    summary: 'Monitor production pipeline and manufacturing status.',
    details: [
      'Production order tracking from placement through completion',
      'Status monitoring for active production runs',
    ],
    tech: 'React, Express API, PostgreSQL',
  },
  {
    id: 'containers',
    title: 'Containers',
    path: '/containers',
    icon: '\u{1F4E6}',
    color: '#4A7D61',
    summary: 'Container shipment management and port tracking.',
    details: [
      'Track inbound containers and estimated arrival dates',
      'Container contents and order allocation',
    ],
    tech: 'React, Express API, PostgreSQL',
  },
  {
    id: 'burlington',
    title: 'Burlington',
    path: '/buyer/burlington',
    icon: '\u{1F3EC}',
    color: '#5A8E73',
    summary: 'Dedicated buyer portal for Burlington account management.',
    details: [
      'Burlington-specific order views and status tracking',
      'Buyer-level reporting and analytics',
    ],
    tech: 'React, Express API, PostgreSQL',
  },
  {
    id: 'ats',
    title: 'ATS',
    path: '/ats',
    icon: '\u{1F4CA}',
    color: '#3D2E24',
    summary: 'Available-to-Sell inventory tracking across all styles.',
    details: [
      'Real-time ATS unit counts per style',
      'Category filtering and search',
    ],
    tech: 'React, Express API, PostgreSQL',
  },
  {
    id: 'contact-log',
    title: 'Contact Log',
    path: '/crm/contact-log',
    icon: '\u{1F4C7}',
    color: '#3A5A45',
    summary: 'CRM contact management with editable buyer cards.',
    details: [
      'Buyer cards showing company, division, buyer name, and current month activity',
      'Inline editing via pencil icon \u2014 edit company, division, buyer name, and notes',
      'Session-level state overlay so edits persist during your session without modifying source data',
      'Feedback tracking per buyer account',
    ],
    tech: 'React, static data with session overlay pattern, modal editing UI',
  },
  {
    id: 'line-sheets',
    title: 'Line Sheets',
    path: '/crm/line-sheets',
    icon: '\u{1F4CB}',
    color: '#4B6B56',
    summary: 'Line sheet management and distribution.',
    details: [
      'View and manage generated line sheets',
      'Export line sheets in Excel format with embedded product images',
    ],
    tech: 'React, SheetJS',
  },
  {
    id: 'showroom',
    title: 'Showroom',
    path: '/showroom',
    icon: '\u{1F457}',
    color: '#2A1F1A',
    summary: 'Product catalog with custom line sheet builder and AI model generation.',
    details: [
      'Full style catalog with category tabs, search, and grid view',
      'Custom Line Sheet Builder \u2014 select styles, then build a professional line sheet',
      'Account selection from CRM dropdown or create new entries',
      'Per-style pricing input for each line sheet',
      'AI Model Image Generation \u2014 generates editorial fashion photos of models wearing each style using DALL-E 3',
      'Approve/reject flow for AI-generated images before including in exports',
      'Excel export with embedded product and AI model images',
      'Local image map for caftan styles with base64 conversion for exports',
    ],
    tech: 'React, OpenAI DALL-E 3 API, SheetJS, HTML-based Excel with images',
  },
  {
    id: 'vendors',
    title: 'Vendors',
    path: '/finance/vendors',
    icon: '\u{1F91D}',
    color: '#2D5A3D',
    summary: 'Vendor relationship and payment management.',
    details: [
      'Vendor directory and contact information',
      'Payment tracking and terms management',
    ],
    tech: 'React, Express API, PostgreSQL',
  },
  {
    id: 'model',
    title: 'Model',
    path: '/model',
    icon: '\u{1F4C8}',
    color: '#3D6B4F',
    summary: 'Financial modeling and forecasting.',
    details: [
      'Revenue modeling and margin analysis',
      'Scenario planning tools',
    ],
    tech: 'React, Express API, PostgreSQL',
  },
  {
    id: 'time-off',
    title: 'Time Off (HR)',
    path: '/office/hr',
    icon: '\u{1F3D6}\uFE0F',
    color: '#4A7D61',
    summary: 'Team PTO tracker split into historical and anticipated periods.',
    details: [
      'Monthly grid showing time off across the full year',
      'Historical vs Anticipated split \u2014 months before current are "Historical", current month onward is "Anticipated"',
      'Color-coded columns: warm tones for historical, blue tint for anticipated',
      'Visual divider column between the two periods',
      'Three subtotal columns: Historical total, Anticipated total, and Year total',
      'Section labels row spanning historical and anticipated month groups',
    ],
    tech: 'React, dynamic month detection via Date API',
  },
  {
    id: 'team',
    title: 'Team',
    path: '/office/team',
    icon: '\u{1F465}',
    color: '#5A8E73',
    summary: 'Team directory with clean card-based layout.',
    details: [
      'Card grid showing each team member with avatar, name, title, and department',
      'Clean minimal design \u2014 removed time off calculator per user request',
    ],
    tech: 'React, static team data',
  },
  {
    id: 'internal-todo',
    title: 'To Do (Internal)',
    path: '/internal/todo',
    icon: '\u2705',
    color: '#E8B4BC',
    summary: 'Internal task tracker with page assignment and filtering.',
    details: [
      'Add tasks with checkbox, title, page assignment, status, and comments',
      'Status options: Not Started, In Process, Completed \u2014 color-coded badges',
      'Checkbox auto-syncs with status (checking = Completed)',
      'Page dropdown to assign tasks to any app section',
      'Filter pills to view tasks by page \u2014 click a page name to filter',
      'Sorted alphabetically by page for easy grouping',
      'Dual persistence: tries database API first, falls back to localStorage',
      'Inline comment editing \u2014 click to type, press Enter or click away to save',
    ],
    tech: 'React, localStorage fallback, Express API + PostgreSQL when available',
  },
];

const ARCHITECTURE = [
  { label: 'Frontend', value: 'React (Create React App)', icon: '\u269B\uFE0F' },
  { label: 'Backend', value: 'Express.js on Node', icon: '\u{1F7E2}' },
  { label: 'Database', value: 'PostgreSQL', icon: '\u{1F418}' },
  { label: 'Styling', value: 'CSS-in-JS + CSS custom properties', icon: '\u{1F3A8}' },
  { label: 'Theme', value: 'Ivory ground, espresso accents, Inter font', icon: '\u2615' },
  { label: 'Auth', value: 'JWT-based authentication', icon: '\u{1F510}' },
  { label: 'AI', value: 'OpenAI DALL-E 3 for model image generation', icon: '\u{1F916}' },
  { label: 'Excel', value: 'SheetJS (CDN) + HTML-based Excel for images', icon: '\u{1F4CA}' },
];

export default function AppWalkthrough() {
  const [expanded, setExpanded] = useState(null);
  const [activeTab, setActiveTab] = useState('pages');
  const [notes, setNotes] = useState('');
  const [saveStatus, setSaveStatus] = useState(null); // 'saving' | 'saved' | null
  const saveTimeout = useRef(null);

  // Load notes on mount
  useEffect(() => {
    const loadNotes = async () => {
      // Try API first
      try {
        const res = await api.get('/api/notes/consolidated');
        if (res.data && res.data.content !== undefined) {
          setNotes(res.data.content);
          return;
        }
      } catch (e) { /* fall through */ }
      // Fallback to localStorage
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setNotes(saved);
    };
    loadNotes();
  }, []);

  // Auto-save with debounce
  const saveNotes = useCallback((value) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    setSaveStatus('saving');
    saveTimeout.current = setTimeout(async () => {
      // Save to localStorage immediately
      localStorage.setItem(STORAGE_KEY, value);
      // Try API
      try {
        await api.put('/api/notes/consolidated', { content: value });
      } catch (e) { /* localStorage is enough */ }
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2000);
    }, 800);
  }, []);

  const handleNotesChange = (e) => {
    const value = e.target.value;
    setNotes(value);
    saveNotes(value);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: 0.2 }}>
          App Walkthrough
        </h1>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.6 }}>
          Interactive guide to everything built in Project Petal — Unlimited Avenues' business operations platform.
        </div>
      </div>

      {/* Tab toggle */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28, background: 'var(--surface2)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {[
          { key: 'notes', label: 'Consolidated Notes', icon: FileText },
          { key: 'pages', label: 'Pages & Features' },
          { key: 'arch', label: 'Tech Stack' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: '8px 20px', borderRadius: 7, fontSize: 13, fontWeight: activeTab === t.key ? 600 : 400,
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: activeTab === t.key ? 'var(--accent)' : 'transparent',
              color: activeTab === t.key ? '#fff' : 'var(--text-dim)',
              transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {t.icon && <t.icon size={14} />}
            {t.label}
          </button>
        ))}
      </div>

      {/* Consolidated Notes tab */}
      {activeTab === 'notes' && (
        <div style={{ maxWidth: 900 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1.2 }}>
              Consolidated Notes
            </div>
            <div style={{
              fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5,
              opacity: saveStatus ? 1 : 0, transition: 'opacity 0.3s',
            }}>
              {saveStatus === 'saving' && (
                <>
                  <Save size={12} />
                  Saving...
                </>
              )}
              {saveStatus === 'saved' && (
                <>
                  <CheckCircle2 size={12} style={{ color: 'var(--success)' }} />
                  <span style={{ color: 'var(--success)' }}>Saved</span>
                </>
              )}
            </div>
          </div>
          <textarea
            value={notes}
            onChange={handleNotesChange}
            placeholder="Start typing your notes here... This is your consolidated space for app-wide observations, decisions, and reminders."
            style={{
              width: '100%',
              minHeight: 500,
              padding: 24,
              fontSize: 14,
              lineHeight: 1.8,
              fontFamily: "'Inter', Arial, sans-serif",
              color: 'var(--text)',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              outline: 'none',
              resize: 'vertical',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
          />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, letterSpacing: 0.3 }}>
            Auto-saves as you type
          </div>
        </div>
      )}

      {activeTab === 'arch' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {ARCHITECTURE.map(a => (
            <div key={a.label} style={{
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
              padding: '20px 22px', display: 'flex', alignItems: 'flex-start', gap: 14,
            }}>
              <div style={{ fontSize: 28, lineHeight: 1 }}>{a.icon}</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>{a.label}</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{a.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'pages' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SECTIONS.map((s) => {
            const isOpen = expanded === s.id;
            return (
              <div key={s.id} style={{
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
                overflow: 'hidden', transition: 'box-shadow 0.2s',
                boxShadow: isOpen ? '0 4px 20px rgba(0,0,0,0.06)' : 'none',
              }}>
                {/* Collapsed header */}
                <button
                  onClick={() => setExpanded(isOpen ? null : s.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 16,
                    padding: '16px 22px', background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: 'inherit', textAlign: 'left',
                  }}
                >
                  {/* Color dot */}
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, background: s.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, flexShrink: 0,
                  }}>
                    {s.icon}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{s.title}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.summary}
                    </div>
                  </div>

                  {/* Arrow */}
                  <div style={{
                    fontSize: 14, color: 'var(--text-muted)', transition: 'transform 0.2s',
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0,
                  }}>
                    {'\u25BE'}
                  </div>
                </button>

                {/* Expanded details */}
                {isOpen && (
                  <div style={{ padding: '0 22px 20px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ paddingTop: 16 }}>
                      {/* Feature list */}
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                        Features
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                        {s.details.map((d, i) => (
                          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            <div style={{
                              width: 6, height: 6, borderRadius: '50%', background: s.color,
                              marginTop: 6, flexShrink: 0,
                            }} />
                            <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5 }}>{d}</div>
                          </div>
                        ))}
                      </div>

                      {/* Tech badge */}
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        flexWrap: 'wrap', gap: 12,
                      }}>
                        <div style={{
                          fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface2)',
                          padding: '5px 12px', borderRadius: 6, fontWeight: 500,
                        }}>
                          {'\u{1F6E0}'} {s.tech}
                        </div>

                        <Link to={s.path} style={{
                          fontSize: 12, fontWeight: 600, color: 'var(--accent)',
                          textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4,
                        }}>
                          Open page {'\u2192'}
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
