import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import PageHeader from '../components/shared/PageHeader';
import { useToast } from '../components/shared/Toast';

const LARRY_COLOR = '#2D5A3D';

const STATUS_COLORS = {
  'In Production': '#8B6B2E',
  'In Transit': '#4A6FA5',
  'In Warehouse': '#B58C3C',
  'Routed': '#2D5A3D',
  'Shipped': '#6B8F71',
  'Cancelled': '#AAAAAA',
  'Not Routed': '#888888',
};

function StatusPill({ status }) {
  const color = STATUS_COLORS[status] || '#888';
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 600, color: '#fff', background: color,
      whiteSpace: 'nowrap',
    }}>
      {status}
    </span>
  );
}

function SourceBadge({ source }) {
  const isProd = source === 'production';
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 20,
      fontSize: 10, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase',
      color: isProd ? '#6B4C1E' : '#1E4D6B',
      background: isProd ? 'rgba(181,140,60,0.12)' : 'rgba(74,111,165,0.10)',
      whiteSpace: 'nowrap',
    }}>
      {isProd ? 'Production' : 'PO Tracking'}
    </span>
  );
}

function ProductionCard({ row }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 8 }}>
        {row.ct && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Cut Ticket</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{row.ct}</div>
          </div>
        )}
        {row.customer && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Customer</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{row.customer}</div>
          </div>
        )}
        {row.customer_po && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Customer PO</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{row.customer_po}</div>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-dim)' }}>
        {row.vendor && <span>Vendor: <strong style={{ color: 'var(--text)' }}>{row.vendor}</strong></span>}
        {row.style && <span>Style: <strong style={{ color: 'var(--text)' }}>{row.style}</strong></span>}
        {row.color && <span>Color: <strong style={{ color: 'var(--text)' }}>{row.color}</strong></span>}
        {row.units > 0 && <span>Units: <strong style={{ color: 'var(--text)' }}>{(row.units || 0).toLocaleString()}</strong></span>}
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
        {row.due_date && <span>Due: {new Date(row.due_date).toLocaleDateString()}</span>}
        {row.notes && <span style={{ fontStyle: 'italic' }}>Notes: {row.notes}</span>}
      </div>
    </div>
  );
}

export default function LarryLogistics() {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchType, setSearchType] = useState('all');
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [multiMode, setMultiMode] = useState(false);

  const handleGeneratePDF = useCallback(async () => {
    setGeneratingPDF(true);
    try {
      const res = await api.get('/agents/larry/report/pdf', { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Logistics_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success('Logistics Report downloaded.');
    } catch (err) {
      console.error('Larry PDF error, falling back to HTML:', err);
      try {
        const res = await api.get('/agents/larry/report/html');
        const html = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Logistics_Report_${new Date().toISOString().split('T')[0]}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        toast.success('Logistics Report downloaded (HTML format).');
      } catch (htmlErr) {
        console.error('HTML fallback also failed:', htmlErr);
        toast.error('Failed to generate Logistics Report.');
      }
    }
    setGeneratingPDF(false);
  }, [toast]);

  const fmt = (n) => (n || n === 0) ? n.toLocaleString() : '—';

  // Parse pasted text into individual PO numbers
  const parseMultiQuery = (text) => {
    return text
      .split(/[\n,;\t]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  };

  // Detect multi-mode when user types/pastes content with separators
  const handleQueryChange = (val) => {
    setQuery(val);
    const hasMulti = /[\n,;\t]/.test(val) && parseMultiQuery(val).length > 1;
    if (hasMulti && !multiMode) setMultiMode(true);
  };

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const typeParam = searchType !== 'all' ? `&type=${searchType}` : '';
      const queries = multiMode ? parseMultiQuery(query) : [query.trim()];

      if (queries.length <= 1) {
        // Single search
        const res = await api.get(`/agents/po-search?q=${encodeURIComponent(queries[0])}${typeParam}`);
        setResults(res.data || []);
      } else {
        // Multi-PO: fire parallel searches, tag results with the query they came from
        const allResults = await Promise.all(
          queries.map(async (q) => {
            try {
              const res = await api.get(`/agents/po-search?q=${encodeURIComponent(q)}${typeParam}`);
              return (res.data || []).map(r => ({ ...r, _searchQuery: q }));
            } catch {
              return [{ _searchQuery: q, _notFound: true }];
            }
          })
        );
        // Flatten but keep grouping info
        const flat = allResults.flat();
        setResults(flat);
      }
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [query, searchType, multiMode]);

  const handleClear = () => {
    setQuery('');
    setResults(null);
    setMultiMode(false);
  };

  // Group results by _searchQuery when in multi-mode
  const displayResults = results ? results.filter(r => !r._notFound) : null;
  const notFoundQueries = results ? [...new Set(
    results.filter(r => r._notFound).map(r => r._searchQuery)
  )] : [];
  // Build grouped map for multi-mode display
  const groupedResults = (multiMode && displayResults) ? (() => {
    const groups = {};
    displayResults.forEach(r => {
      const key = r._searchQuery || query.trim();
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });
    return groups;
  })() : null;

  return (
    <div className="fade-in">
      <PageHeader title="Eddie" />
      {/* Logistics Report PDF */}
      <div style={{ maxWidth: 800, margin: '0 auto 24px' }}>
        <button
          onClick={handleGeneratePDF}
          disabled={generatingPDF}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 10, border: 'none',
            background: LARRY_COLOR, color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: generatingPDF ? 'wait' : 'pointer', fontFamily: 'inherit',
            opacity: generatingPDF ? 0.7 : 1, transition: 'opacity 0.15s',
          }}
        >
          <span style={{ fontSize: 16 }}>{generatingPDF ? '\u23F3' : '\uD83D\uDCC4'}</span>
          {generatingPDF ? 'Generating Report...' : 'Logistics Report (PDF)'}
        </button>
      </div>

      {/* Search Box */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, padding: '28px 32px', maxWidth: 800, margin: '0 auto',
      }}>
        {/* Search type pills */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {[
            { key: 'all', label: 'All' },
            { key: 'po', label: 'PO #' },
            { key: 'cut_ticket', label: 'Cut Ticket' },
            { key: 'pick_ticket', label: 'Pick Ticket' },
            { key: 'so', label: 'Sales Order' },
          ].map(t => (
            <button key={t.key} onClick={() => setSearchType(t.key)}
              style={{
                padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', border: 'none', transition: 'all 0.15s',
                background: searchType === t.key ? LARRY_COLOR : 'var(--surface2)',
                color: searchType === t.key ? '#fff' : 'var(--text-dim)',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Multi-PO toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <button onClick={() => setMultiMode(!multiMode)}
            style={{
              padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', border: 'none', transition: 'all 0.15s',
              background: multiMode ? LARRY_COLOR : 'var(--surface2)',
              color: multiMode ? '#fff' : 'var(--text-dim)',
            }}>
            {multiMode ? '✓ Multi-PO Mode' : 'Multi-PO'}
          </button>
          {multiMode && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Paste multiple PO #s separated by commas, new lines, or tabs
            </span>
          )}
        </div>

        {/* Input + Button */}
        <div style={{ display: 'flex', gap: 10, alignItems: multiMode ? 'flex-start' : 'center' }}>
          {multiMode ? (
            <textarea
              placeholder={"Paste multiple PO numbers...\ne.g.:\n50430\n50431\n50432"}
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSearch(); }}
              rows={5}
              style={{
                flex: 1, padding: '12px 18px', border: '1px solid var(--border)',
                borderRadius: 10, fontSize: 14, background: 'var(--surface2)',
                color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace", outline: 'none',
                resize: 'vertical', lineHeight: 1.6,
              }}
            />
          ) : (
            <input
              type="text"
              placeholder="Enter PO number, cut ticket, pick ticket, or sales order..."
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              style={{
                flex: 1, padding: '12px 18px', border: '1px solid var(--border)',
                borderRadius: 10, fontSize: 15, background: 'var(--surface2)',
                color: 'var(--text)', fontFamily: 'inherit', outline: 'none',
              }}
            />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={handleSearch} disabled={searching}
              style={{
                padding: '12px 28px', background: LARRY_COLOR, color: '#fff',
                border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', opacity: searching ? 0.6 : 1,
                whiteSpace: 'nowrap',
              }}>
              {searching ? 'Searching...' : multiMode ? `Search ${parseMultiQuery(query).length} POs` : 'Search'}
            </button>
            {results !== null && (
              <button onClick={handleClear}
                style={{
                  padding: '12px 18px', background: 'var(--surface2)', color: 'var(--text-dim)',
                  border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      {displayResults !== null && (
        <div style={{ maxWidth: 800, margin: '24px auto 0' }}>
          {/* Not-found POs banner */}
          {notFoundQueries.length > 0 && (
            <div style={{
              padding: '12px 20px', marginBottom: 12, borderRadius: 10,
              background: 'rgba(180,60,60,0.06)', border: '1px solid rgba(180,60,60,0.15)',
              fontSize: 13, color: '#8B3030',
            }}>
              <strong>Not found:</strong> {notFoundQueries.join(', ')}
            </div>
          )}

          {displayResults.length === 0 && notFoundQueries.length === 0 ? (
            <div style={{
              padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14,
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
            }}>
              No results found for "{query}"
            </div>
          ) : multiMode && groupedResults ? (
            /* ─── Multi-PO grouped view ─── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Summary bar */}
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
                padding: '14px 20px', display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap',
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                  {Object.keys(groupedResults).length} PO{Object.keys(groupedResults).length !== 1 ? 's' : ''} found
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {displayResults.length} total record{displayResults.length !== 1 ? 's' : ''}
                </span>
                {notFoundQueries.length > 0 && (
                  <span style={{ fontSize: 12, color: '#8B3030', fontWeight: 600 }}>
                    {notFoundQueries.length} not found
                  </span>
                )}
              </div>

              {Object.entries(groupedResults).map(([poQuery, rows]) => (
                <div key={poQuery} style={{
                  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
                  overflow: 'hidden',
                }}>
                  {/* Group header */}
                  <div style={{
                    padding: '12px 20px', borderBottom: '1px solid var(--border)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: `${LARRY_COLOR}08`,
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: LARRY_COLOR, fontFamily: "'JetBrains Mono', monospace" }}>
                      {poQuery}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {rows.length} record{rows.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {rows.map((po, i) => (
                    <div key={i} style={{
                      padding: '14px 20px', borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none',
                      display: 'flex', gap: 20, alignItems: 'flex-start',
                    }}>
                      <div style={{ flexShrink: 0, paddingTop: 2, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {po._source === 'production' ? (
                          <SourceBadge source="production" />
                        ) : (
                          <>
                            <StatusPill status={po.routing_status} />
                            {po._source && <SourceBadge source={po._source} />}
                          </>
                        )}
                      </div>
                      {po._source === 'production' ? (
                        <ProductionCard row={po} />
                      ) : (
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 8 }}>
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>PO #</div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{po.po_number}</div>
                            </div>
                            {po.cut_ticket && (
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Cut Ticket</div>
                                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{po.cut_ticket}</div>
                              </div>
                            )}
                            {po.pick_ticket && (
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Pick Ticket</div>
                                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{po.pick_ticket}</div>
                              </div>
                            )}
                            {po.so_number && (
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Sales Order</div>
                                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{po.so_number}</div>
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-dim)' }}>
                            {po.style && <span>Style: <strong style={{ color: 'var(--text)' }}>{po.style}</strong></span>}
                            {po.units > 0 && <span>Units: <strong style={{ color: 'var(--text)' }}>{fmt(po.units)}</strong></span>}
                            {po.cartons > 0 && <span>Cartons: <strong style={{ color: 'var(--text)' }}>{fmt(po.cartons)}</strong></span>}
                            {po.warehouse && <span>Warehouse: <strong style={{ color: 'var(--text)' }}>{po.warehouse}</strong></span>}
                            {po.lot && <span>Lot: <strong style={{ color: 'var(--text)' }}>{po.lot}</strong></span>}
                          </div>
                          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                            {po.ship_window_start && <span>Ship Start: {new Date(po.ship_window_start).toLocaleDateString()}</span>}
                            {po.ship_window_end && <span>Cancel: {new Date(po.ship_window_end).toLocaleDateString()}</span>}
                            {po.date_shipped && <span style={{ color: '#6B8F71', fontWeight: 600 }}>Shipped: {new Date(po.date_shipped).toLocaleDateString()}</span>}
                            {po.routing_id && <span>Routing ID: {po.routing_id}</span>}
                            {po.carrier && <span>Carrier: {po.carrier}</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : displayResults.length > 0 ? (
            /* ─── Single PO view (original) ─── */
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
              overflow: 'hidden',
            }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  {displayResults.length} result{displayResults.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                {displayResults.map((po, i) => (
                  <div key={i} style={{
                    padding: '16px 20px', borderBottom: i < displayResults.length - 1 ? '1px solid var(--border)' : 'none',
                    display: 'flex', gap: 20, alignItems: 'flex-start',
                  }}>
                    <div style={{ flexShrink: 0, paddingTop: 2, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {po._source === 'production' ? (
                        <SourceBadge source="production" />
                      ) : (
                        <>
                          <StatusPill status={po.routing_status} />
                          {po._source && <SourceBadge source={po._source} />}
                        </>
                      )}
                    </div>
                    {po._source === 'production' ? (
                      <ProductionCard row={po} />
                    ) : (
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 8 }}>
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>PO #</div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{po.po_number}</div>
                          </div>
                          {po.cut_ticket && (
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Cut Ticket</div>
                              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{po.cut_ticket}</div>
                            </div>
                          )}
                          {po.pick_ticket && (
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Pick Ticket</div>
                              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{po.pick_ticket}</div>
                            </div>
                          )}
                          {po.so_number && (
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Sales Order</div>
                              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{po.so_number}</div>
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-dim)' }}>
                          {po.style && <span>Style: <strong style={{ color: 'var(--text)' }}>{po.style}</strong></span>}
                          {po.units > 0 && <span>Units: <strong style={{ color: 'var(--text)' }}>{fmt(po.units)}</strong></span>}
                          {po.cartons > 0 && <span>Cartons: <strong style={{ color: 'var(--text)' }}>{fmt(po.cartons)}</strong></span>}
                          {po.warehouse && <span>Warehouse: <strong style={{ color: 'var(--text)' }}>{po.warehouse}</strong></span>}
                          {po.lot && <span>Lot: <strong style={{ color: 'var(--text)' }}>{po.lot}</strong></span>}
                        </div>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                          {po.ship_window_start && <span>Ship Start: {new Date(po.ship_window_start).toLocaleDateString()}</span>}
                          {po.ship_window_end && <span>Cancel: {new Date(po.ship_window_end).toLocaleDateString()}</span>}
                          {po.date_shipped && <span style={{ color: '#6B8F71', fontWeight: 600 }}>Shipped: {new Date(po.date_shipped).toLocaleDateString()}</span>}
                          {po.routing_id && <span>Routing ID: {po.routing_id}</span>}
                          {po.carrier && <span>Carrier: {po.carrier}</span>}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
