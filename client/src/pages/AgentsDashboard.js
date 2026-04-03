import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import PageHeader from '../components/shared/PageHeader';

const LARRY_COLOR = '#2D5A3D';
const JOHN_ANTHONY_COLOR = '#4A6FA5';
const GORDON_COLOR = '#8B6B2E';
const JAZZY_COLOR = '#9B5B8D';

const STATUS_COLORS = {
  'In Production': '#8B6B2E',
  'In Transit': '#4A6FA5',
  'In Warehouse': '#B58C3C',
  'Routed': '#2D5A3D',
  'Shipped': '#6B8F71',
  'Cancelled': '#AAAAAA',
};

function AgentCard({ name, role, color, status, lastAction, summaryItems, nextRun, children }) {
  const isActive = status === 'active';
  const statusDot = isActive ? '#4CAF50' : '#BDBDBD';
  const statusLabel = isActive ? 'Active' : 'Inactive';
  const [showSummary, setShowSummary] = React.useState(false);

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: 20,
      flex: '1 1 300px',
      minWidth: 280,
      opacity: isActive ? 1 : 0.75,
      transition: 'opacity 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: isActive ? color : '#BDBDBD',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, color: '#fff', fontWeight: 700,
              transition: 'background 0.2s',
            }}>
              {name[0]}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{role}</div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', background: statusDot,
          }} />
          <span style={{
            fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
            color: isActive ? '#4CAF50' : '#999',
          }}>{statusLabel}</span>
        </div>
      </div>

      {lastAction && (
        <div style={{
          fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, fontStyle: 'italic',
          padding: '6px 10px', background: 'var(--surface2)', borderRadius: 6,
        }}>
          Last activity: {lastAction}
        </div>
      )}

      {!isActive && !lastAction && (
        <div style={{
          fontSize: 11, color: '#999', marginBottom: 10, fontStyle: 'italic',
          padding: '6px 10px', background: 'var(--surface2)', borderRadius: 6,
        }}>
          No activity in the last 24 hours
        </div>
      )}

      {summaryItems && summaryItems.length > 0 && (
        <div
          onClick={() => setShowSummary(!showSummary)}
          style={{
            fontSize: 12, fontWeight: 600, color: color, cursor: 'pointer',
            padding: '8px 10px', borderRadius: 6,
            background: `${color}10`, border: `1px solid ${color}25`,
            marginBottom: showSummary ? 0 : 0,
            transition: 'all 0.15s',
          }}
        >
          {showSummary ? '▾' : '▸'} View 24hr Summary ({summaryItems.length} action{summaryItems.length !== 1 ? 's' : ''})
        </div>
      )}

      {showSummary && summaryItems && summaryItems.length > 0 && (
        <div style={{
          marginTop: 8, padding: '10px 12px', background: 'var(--surface2)',
          borderRadius: 6, maxHeight: 200, overflowY: 'auto',
          borderLeft: `3px solid ${color}`,
        }}>
          {summaryItems.map((item, i) => (
            <div key={i} style={{
              fontSize: 11, color: 'var(--text)', padding: '4px 0',
              borderBottom: i < summaryItems.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <div>{item.action}</div>
              {item.details && (
                <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 2 }}>{item.details}</div>
              )}
              <div style={{ color: 'var(--text-muted)', fontSize: 9, marginTop: 2 }}>
                {new Date(item.time).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>
      )}

      {isActive && (!summaryItems || summaryItems.length === 0) && (
        <div style={{
          fontSize: 12, color: color, padding: '8px 10px', borderRadius: 6,
          background: `${color}10`, border: `1px solid ${color}25`,
        }}>
          Active — no detailed logs available
        </div>
      )}

      {nextRun && (() => {
        const isPaused = nextRun.toLowerCase() === 'paused';
        return (
          <div style={{
            fontSize: 10, fontWeight: 600, marginTop: 10,
            padding: '6px 10px', borderRadius: 5,
            display: 'flex', alignItems: 'center', gap: 5,
            background: isPaused ? '#f0f0f0' : '#e8f5e9',
            color: isPaused ? '#999' : '#2e7d32',
          }}>
            <span style={{ fontSize: 12 }}>{isPaused ? '⏸' : '⏱'}</span> Next run: {nextRun}
          </div>
        );
      })()}

      {children}
    </div>
  );
}

function StatBadge({ label, value, color }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: `${color}12`, border: `1px solid ${color}30`,
      borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600,
    }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ color }}>{value}</span>
    </div>
  );
}

export default function AgentsDashboard() {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [poSearchQuery, setPoSearchQuery] = useState('');
  const [poSearchResults, setPoSearchResults] = useState([]);
  const [poSearching, setPoSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [logs, setLogs] = useState([]);
  const [poSummary, setPoSummary] = useState(null);
  const [financialSummary, setFinancialSummary] = useState(null);
  const [jazzyTrends, setJazzyTrends] = useState([]);
  const [jazzyStats, setJazzyStats] = useState(null);
  const useApiRef = useRef(false);

  // Load dashboard data
  useEffect(() => {
    Promise.all([
      api.get('/agents/dashboard').catch(() => null),
      api.get('/agents/logs?limit=30').catch(() => null),
      api.get('/agents/po-summary').catch(() => null),
      api.get('/agents/financial/summary').catch(() => null),
      api.get('/agents/jazzy/trends').catch(() => null),
      api.get('/agents/jazzy/stats').catch(() => null),
    ]).then(([dashRes, logsRes, poSumRes, finSumRes, jazzyRes, jazzyStatsRes]) => {
      useApiRef.current = !!dashRes;
      if (dashRes) setDashboard(dashRes.data);
      if (logsRes) setLogs(logsRes.data || []);
      if (poSumRes) setPoSummary(poSumRes.data);
      if (finSumRes) setFinancialSummary(finSumRes.data);
      if (jazzyRes) setJazzyTrends(jazzyRes.data || []);
      if (jazzyStatsRes) setJazzyStats(jazzyStatsRes.data);
    }).finally(() => setLoading(false));
  }, []);

  // PO Search
  const handlePoSearch = useCallback(async () => {
    if (!poSearchQuery.trim()) return;
    setPoSearching(true);
    try {
      const res = await api.get(`/agents/po-search?q=${encodeURIComponent(poSearchQuery)}`);
      setPoSearchResults(res.data || []);
    } catch (err) {
      setPoSearchResults([]);
    } finally {
      setPoSearching(false);
    }
  }, [poSearchQuery]);

  // Import data from files
  const handleImport = useCallback(async () => {
    setImporting(true);
    setImportResult(null);
    try {
      const res = await api.post('/agents/import');
      setImportResult(res.data);
      // Refresh dashboard
      const [dashRes, poSumRes, finSumRes, logsRes, jazzyRes, jazzyStatsRes] = await Promise.all([
        api.get('/agents/dashboard').catch(() => null),
        api.get('/agents/po-summary').catch(() => null),
        api.get('/agents/financial/summary').catch(() => null),
        api.get('/agents/logs?limit=30').catch(() => null),
        api.get('/agents/jazzy/trends').catch(() => null),
        api.get('/agents/jazzy/stats').catch(() => null),
      ]);
      if (dashRes) setDashboard(dashRes.data);
      if (poSumRes) setPoSummary(poSumRes.data);
      if (finSumRes) setFinancialSummary(finSumRes.data);
      if (logsRes) setLogs(logsRes.data || []);
      if (jazzyRes) setJazzyTrends(jazzyRes.data || []);
      if (jazzyStatsRes) setJazzyStats(jazzyStatsRes.data);
    } catch (err) {
      setImportResult({ error: err.message });
    } finally {
      setImporting(false);
    }
  }, []);

  // Compute agent statuses from logs — active if any activity in last 24 hours
  const agentStatuses = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const safeLog = Array.isArray(logs) ? logs : [];
    const statuses = {};

    ['Eddie', 'John Anthony', 'Gordon', 'Jazzy'].forEach(name => {
      const agentLogs = safeLog.filter(l => l.agent_name === name);
      const recentLogs = agentLogs.filter(l => new Date(l.created_at) > cutoff);
      const lastLog = agentLogs.length > 0 ? agentLogs[0] : null;
      statuses[name] = {
        active: recentLogs.length > 0,
        lastAction: lastLog ? new Date(lastLog.created_at).toLocaleString('en-US', {
          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
        }) : null,
        summaryItems: recentLogs.map(l => ({
          action: l.action,
          details: l.details,
          time: l.created_at,
        })),
      };
    });

    // Also check jazzyTrends for Jazzy activity
    const jazzyArr = Array.isArray(jazzyTrends) ? jazzyTrends : [];
    const recentTrends = jazzyArr.filter(t => {
      if (!t.found_date) return false;
      return new Date(t.found_date) > cutoff;
    });
    if (recentTrends.length > 0) {
      statuses['Jazzy'].active = true;
      if (!statuses['Jazzy'].lastAction) {
        statuses['Jazzy'].lastAction = new Date(recentTrends[0].found_date).toLocaleString('en-US', {
          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
        });
      }
      // Add trend finds to summary
      recentTrends.forEach(t => {
        statuses['Jazzy'].summaryItems.push({
          action: `Scouted: ${t.trend_name || t.style || 'New trend'}`,
          details: `${t.brand || ''} — ${t.category || ''}`.replace(/^ — $/, ''),
          time: t.found_date,
        });
      });
    }

    return statuses;
  }, [logs, jazzyTrends]);

  // Group Jazzy trends by found_date for nightly links (must be before early return)
  const jazzyDates = useMemo(() => {
    const groups = {};
    const trends = Array.isArray(jazzyTrends) ? jazzyTrends : [];
    trends.forEach(t => {
      const d = t.found_date ? t.found_date.slice(0, 10) : 'unknown';
      if (!groups[d]) groups[d] = 0;
      groups[d]++;
    });
    return Object.entries(groups)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, count]) => {
        const dt = new Date(date + 'T12:00:00');
        const label = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        return { date, count, label };
      });
  }, [jazzyTrends]);

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Loading agents...</div>;
  }

  const larryPOs = dashboard?.eddie?.po_count || 0;
  const larryATS = dashboard?.eddie?.ats_skus || 0;
  const atsUnits = dashboard?.eddie?.ats_total_units || 0;
  const gordonPL = dashboard?.gordon?.pl_line_items || 0;

  const fmt = (n) => {
    if (!n && n !== 0) return '—';
    return n.toLocaleString();
  };
  const fmtMoney = (n) => {
    if (!n && n !== 0) return '—';
    if (Math.abs(n) >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
    if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
  };

  return (
    <div className="fade-in">
      <PageHeader title="Monica" />
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div />
        <button
          onClick={handleImport}
          disabled={importing}
          style={{
            padding: '10px 22px', background: '#E8B4BC', color: '#fff', border: 'none',
            borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit', opacity: importing ? 0.6 : 1, transition: 'opacity 0.15s',
          }}
        >
          {importing ? 'Importing...' : 'Import Email Data'}
        </button>
      </div>

      {importResult && (
        <div style={{
          background: importResult.error ? 'rgba(180,60,60,0.08)' : 'rgba(45,74,52,0.08)',
          border: `1px solid ${importResult.error ? 'rgba(180,60,60,0.2)' : 'rgba(45,74,52,0.2)'}`,
          borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13,
          color: importResult.error ? '#8B3030' : 'var(--accent-dark)',
        }}>
          {importResult.error ? `Import failed: ${importResult.error}` :
            `Imported: ${importResult.imported?.po || 0} POs, ${importResult.imported?.ats || 0} ATS, ${importResult.imported?.pl || 0} P&L, ${importResult.imported?.model || 0} model entries`
          }
        </div>
      )}

      {/* Agent Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        {/* Eddie */}
        <AgentCard
          name="Eddie"
          role="Logistics Agent"
          color={LARRY_COLOR}
          status={agentStatuses['Eddie']?.active ? 'active' : 'idle'}
          lastAction={agentStatuses['Eddie']?.lastAction}
          summaryItems={agentStatuses['Eddie']?.summaryItems}
          nextRun="Tonight at 5:00 AM"
        />

        {/* John Anthony */}
        <AgentCard
          name="John Anthony"
          role="Sales/CRM Agent"
          color={JOHN_ANTHONY_COLOR}
          status={agentStatuses['John Anthony']?.active ? 'active' : 'idle'}
          lastAction={agentStatuses['John Anthony']?.lastAction}
          summaryItems={agentStatuses['John Anthony']?.summaryItems}
          nextRun="Paused"
        />

        {/* Gordon */}
        <AgentCard
          name="Gordon"
          role="Finance Agent"
          color={GORDON_COLOR}
          status={agentStatuses['Gordon']?.active ? 'active' : 'idle'}
          lastAction={agentStatuses['Gordon']?.lastAction}
          summaryItems={agentStatuses['Gordon']?.summaryItems}
          nextRun="Paused"
        />

        {/* Jazzy */}
        <AgentCard
          name="Jazzy"
          role="Trend Scout"
          color={JAZZY_COLOR}
          status={agentStatuses['Jazzy']?.active ? 'active' : 'idle'}
          lastAction={agentStatuses['Jazzy']?.lastAction}
          summaryItems={agentStatuses['Jazzy']?.summaryItems}
          nextRun="Tonight at 3:00 AM"
        />
      </div>

      {/* Nightly Reports */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 20, marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: '0 0 16px 0' }}>
          Nightly Reports
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Eddie Reports */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              Eddie — Logistics Reports
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div
                onClick={() => window.open('/api/agents/larry/report/pdf', '_blank')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  borderBottom: '1px solid var(--border)', cursor: 'pointer',
                  borderRadius: 6, transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: 6, background: LARRY_COLOR,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, color: '#fff', fontWeight: 700,
                }}>L</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: LARRY_COLOR }}>
                    {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Eddie's Logistics Report (PDF) — click to generate</div>
                </div>
                <span style={{ fontSize: 14, opacity: 0.4 }}>→</span>
              </div>
            </div>
          </div>

          {/* Jazzy Reports */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              Jazzy — Trend Scout Reports
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div
                style={{
                  padding: '10px 12px', borderBottom: '1px solid var(--border)', borderRadius: 6,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: JAZZY_COLOR }}>
                  March 23, 2026
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>
                  5 trends · Altar'd State, PacSun, Target, Revolve, Mango
                </div>
                <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.6 }}>
                  <div>1. <strong>Sheer Crochet Tunic</strong> — Altar'd State · Tops / Missy · ~$45–65</div>
                  <div>2. <strong>Eco Retro Flare Revival</strong> — PacSun · Bottoms / Juniors · ~$55–70</div>
                  <div>3. <strong>Linen Jumpsuit Ease</strong> — Target · Jumpsuits / Missy · ~$19–35</div>
                  <div>4. <strong>Crochet Cutout Maxi</strong> — Revolve (Tularosa) · Dresses / Juniors · ~$224–238</div>
                  <div>5. <strong>Openwork Embroidery Midi</strong> — Mango · Dresses / Missy · ~$79–120</div>
                </div>
              </div>
              {/* Previous Jazzy dates from DB */}
              {jazzyDates && jazzyDates.length > 0 && jazzyDates.map(jd => (
                <div key={jd.date} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 6, background: JAZZY_COLOR,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, color: '#fff', fontWeight: 700,
                  }}>J</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: JAZZY_COLOR }}>{jd.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{jd.count} trend{jd.count !== 1 ? 's' : ''} scouted</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Activity Feed */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 20,
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: '0 0 16px 0' }}>
          Activity Feed
        </h2>

        {logs.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No agent activity yet. Click "Import Email Data" to get started.
          </div>
        ) : (
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {logs.map((log, i) => (
              <div key={log.id || i} style={{
                padding: '10px 0',
                borderBottom: i < logs.length - 1 ? '1px solid var(--border)' : 'none',
                fontSize: 12,
              }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%', marginTop: 5, flexShrink: 0,
                    background: { 'Eddie': LARRY_COLOR, 'John Anthony': JOHN_ANTHONY_COLOR, 'Gordon': GORDON_COLOR }[log.agent_name] || '#999',
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ color: 'var(--text)' }}>
                      <strong>{log.agent_name}</strong> — {log.action}
                    </div>
                    {log.details && (
                      <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>{log.details}</div>
                    )}
                    <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 2 }}>
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
