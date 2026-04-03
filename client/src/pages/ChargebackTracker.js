import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../utils/api';
import PageHeader from '../components/shared/PageHeader';
import { useToast } from '../components/shared/Toast';

const REASON_CODES = [
  'Late Shipment',
  'Routing Violation',
  'ASN Error',
  'Labeling Non-Compliance',
  'Shortage',
  'Overage',
  'Wrong Store',
  'Carton Overage',
];

const STATUS_OPTIONS = ['Open', 'Disputed', 'Resolved', 'Written Off'];
const BUYERS = ['Burlington', 'Ross Missy', 'Ross Petite', 'Ross Plus', 'Bealls'];

export default function ChargebackTracker() {
  const toast = useToast();
  const [chargebacks, setChargebacks] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    buyer: '',
    status: '',
    reason: '',
    startDate: '',
    endDate: '',
  });
  const [sort, setSort] = useState({ col: 'dispute_date', dir: 'desc' });
  const [editingId, setEditingId] = useState(null);
  const [edits, setEdits] = useState({});

  // Load chargebacks and summary
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [chargeRes, summRes] = await Promise.all([
        api.get('/chargebacks', { params: filters }),
        api.get('/chargebacks/summary'),
      ]);
      setChargebacks(Array.isArray(chargeRes.data) ? chargeRes.data : []);
      setSummary(summRes.data && typeof summRes.data === 'object' ? summRes.data : null);
    } catch (err) {
      console.error('Load error:', err);
      setChargebacks([]);
    }
    setLoading(false);
  };

  // Reload when filters change
  useEffect(() => {
    loadData();
  }, [filters]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      const chargebackToUpdate = chargebacks.find(c => c.id === id);
      const resolution_date = newStatus === 'Resolved' || newStatus === 'Written Off'
        ? new Date().toISOString().split('T')[0]
        : null;

      await api.put(`/chargebacks/${id}`, {
        ...chargebackToUpdate,
        status: newStatus,
        resolution_date,
      });

      setChargebacks(prev => prev.map(c =>
        c.id === id ? { ...c, status: newStatus, resolution_date } : c
      ));
      setSummary(null); // Clear summary to trigger reload
      toast.success('Status updated');
    } catch (err) {
      console.error('Update error:', err);
      toast.error('Failed to update status');
    }
  };

  // Filtered and sorted data
  const displayRows = useMemo(() => {
    let rows = [...chargebacks];

    if (sort.col) {
      rows.sort((a, b) => {
        let av = a[sort.col];
        let bv = b[sort.col];

        // Handle null/undefined
        if (av == null) av = '';
        if (bv == null) bv = '';

        // Handle numeric values
        if (typeof av === 'number' && typeof bv === 'number') {
          return sort.dir === 'asc' ? av - bv : bv - av;
        }

        // String comparison
        av = String(av).toLowerCase();
        bv = String(bv).toLowerCase();
        if (av < bv) return sort.dir === 'asc' ? -1 : 1;
        if (av > bv) return sort.dir === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return rows;
  }, [chargebacks, sort]);

  const toggleSort = (col) => {
    if (sort.col === col) {
      setSort(prev => ({ col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }));
    } else {
      setSort({ col, dir: 'asc' });
    }
  };

  const sortArrow = (col) => {
    if (sort.col !== col) return '';
    return sort.dir === 'asc' ? ' ▲' : ' ▼';
  };

  // Format currency
  const formatCurrency = (amount) => {
    return `$${parseFloat(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="fade-in">
      <PageHeader title="Chargeback Tracker" />

      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="section-title">Chargeback Tracker</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {Object.values(filters).some(v => v) && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setFilters({ buyer: '', status: '', reason: '', startDate: '', endDate: '' })}
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: 16,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)' }}>
              {formatCurrency(summary.total_amount)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginTop: 6, letterSpacing: 0.5 }}>
              Total YTD
            </div>
          </div>

          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: 16,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--danger, #ef4444)' }}>
              {formatCurrency(summary.open_amount)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginTop: 6, letterSpacing: 0.5 }}>
              Open Disputes
            </div>
          </div>

          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: 16,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)' }}>
              {formatCurrency(summary.resolved_amount)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginTop: 6, letterSpacing: 0.5 }}>
              Resolved
            </div>
          </div>

          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: 16,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>
              {summary.by_reason && summary.by_reason.length > 0 ? summary.by_reason[0].reason_code : '—'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginTop: 6, letterSpacing: 0.5 }}>
              Top Reason
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: 16,
        marginBottom: 20,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 12,
      }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>Buyer</label>
          <select
            value={filters.buyer}
            onChange={e => handleFilterChange('buyer', e.target.value)}
            style={{
              width: '100%',
              padding: '6px 8px',
              border: '1px solid var(--border)',
              borderRadius: 4,
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: 12,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="">All Buyers</option>
            {BUYERS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>Status</label>
          <select
            value={filters.status}
            onChange={e => handleFilterChange('status', e.target.value)}
            style={{
              width: '100%',
              padding: '6px 8px',
              border: '1px solid var(--border)',
              borderRadius: 4,
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: 12,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>Reason Code</label>
          <select
            value={filters.reason}
            onChange={e => handleFilterChange('reason', e.target.value)}
            style={{
              width: '100%',
              padding: '6px 8px',
              border: '1px solid var(--border)',
              borderRadius: 4,
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: 12,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="">All Reasons</option>
            {REASON_CODES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>Start Date</label>
          <input
            type="date"
            value={filters.startDate}
            onChange={e => handleFilterChange('startDate', e.target.value)}
            style={{
              width: '100%',
              padding: '6px 8px',
              border: '1px solid var(--border)',
              borderRadius: 4,
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: 12,
              outline: 'none',
              cursor: 'pointer',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>End Date</label>
          <input
            type="date"
            value={filters.endDate}
            onChange={e => handleFilterChange('endDate', e.target.value)}
            style={{
              width: '100%',
              padding: '6px 8px',
              border: '1px solid var(--border)',
              borderRadius: 4,
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: 12,
              outline: 'none',
              cursor: 'pointer',
            }}
          />
        </div>
      </div>

      {/* Chargebacks Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading...</div>
      ) : displayRows.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: 48,
          color: 'var(--text-muted)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
        }}>
          No chargebacks found.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', marginBottom: 20 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                <th
                  onClick={() => toggleSort('po_number')}
                  style={{
                    padding: '10px 8px',
                    textAlign: 'left',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    cursor: 'pointer',
                    userSelect: 'none',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  PO #{sortArrow('po_number')}
                </th>
                <th
                  onClick={() => toggleSort('buyer')}
                  style={{
                    padding: '10px 8px',
                    textAlign: 'left',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    cursor: 'pointer',
                    userSelect: 'none',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  Buyer{sortArrow('buyer')}
                </th>
                <th
                  onClick={() => toggleSort('reason_code')}
                  style={{
                    padding: '10px 8px',
                    textAlign: 'left',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    cursor: 'pointer',
                    userSelect: 'none',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  Reason{sortArrow('reason_code')}
                </th>
                <th
                  onClick={() => toggleSort('amount')}
                  style={{
                    padding: '10px 8px',
                    textAlign: 'right',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    cursor: 'pointer',
                    userSelect: 'none',
                    borderBottom: '1px solid var(--border)',
                    minWidth: 90,
                  }}
                >
                  Amount{sortArrow('amount')}
                </th>
                <th
                  onClick={() => toggleSort('dispute_date')}
                  style={{
                    padding: '10px 8px',
                    textAlign: 'center',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    cursor: 'pointer',
                    userSelect: 'none',
                    borderBottom: '1px solid var(--border)',
                    minWidth: 100,
                  }}
                >
                  Dispute Date{sortArrow('dispute_date')}
                </th>
                <th
                  onClick={() => toggleSort('status')}
                  style={{
                    padding: '10px 8px',
                    textAlign: 'center',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    cursor: 'pointer',
                    userSelect: 'none',
                    borderBottom: '1px solid var(--border)',
                    minWidth: 110,
                  }}
                >
                  Status{sortArrow('status')}
                </th>
                <th
                  style={{
                    padding: '10px 8px',
                    textAlign: 'left',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    borderBottom: '1px solid var(--border)',
                    minWidth: 200,
                  }}
                >
                  Description
                </th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((chargeback, idx) => (
                <tr
                  key={chargeback.id}
                  style={{
                    background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)',
                    borderBottom: '1px solid var(--border)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2, rgba(0,0,0,0.04))'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)'; }}
                >
                  <td style={{ padding: '10px 8px', fontSize: 12, borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{chargeback.po_number}</span>
                  </td>
                  <td style={{ padding: '10px 8px', fontSize: 12, borderBottom: '1px solid var(--border)' }}>
                    {chargeback.buyer}
                  </td>
                  <td style={{ padding: '10px 8px', fontSize: 12, borderBottom: '1px solid var(--border)' }}>
                    <span style={{
                      display: 'inline-block',
                      background: 'rgba(107, 127, 94, 0.1)',
                      color: 'var(--text)',
                      padding: '2px 6px',
                      borderRadius: 3,
                      fontSize: 11,
                      fontWeight: 500,
                    }}>
                      {chargeback.reason_code}
                    </span>
                  </td>
                  <td style={{ padding: '10px 8px', fontSize: 12, textAlign: 'right', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>
                    {formatCurrency(chargeback.amount)}
                  </td>
                  <td style={{ padding: '10px 8px', fontSize: 12, textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                    {formatDate(chargeback.dispute_date)}
                  </td>
                  <td style={{ padding: '10px 8px', fontSize: 12, textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                    <select
                      value={chargeback.status}
                      onChange={e => handleStatusChange(chargeback.id, e.target.value)}
                      style={{
                        padding: '4px 6px',
                        border: '1px solid var(--border)',
                        borderRadius: 3,
                        background: 'var(--bg)',
                        color: chargeback.status === 'Open'
                          ? 'var(--danger, #ef4444)'
                          : chargeback.status === 'Disputed'
                          ? 'var(--warning, #f59e0b)'
                          : chargeback.status === 'Resolved'
                          ? 'var(--success)'
                          : 'var(--text-muted)',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        outline: 'none',
                      }}
                    >
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '10px 8px', fontSize: 12, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                    {chargeback.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary Statistics */}
      {summary && displayRows.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginTop: 24,
        }}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: 12,
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              By Status
            </div>
            <div style={{ marginTop: 8, fontSize: 12 }}>
              <div><span style={{ color: 'var(--danger, #ef4444)', fontWeight: 600 }}>Open:</span> {summary.open_count} ({formatCurrency(summary.open_amount)})</div>
              <div><span style={{ color: 'var(--warning, #f59e0b)', fontWeight: 600 }}>Disputed:</span> {summary.disputed_count}</div>
              <div><span style={{ color: 'var(--success)', fontWeight: 600 }}>Resolved:</span> {summary.resolved_count}</div>
              <div><span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Written Off:</span> {summary.written_off_count}</div>
            </div>
          </div>

          {summary.by_reason && summary.by_reason.length > 0 && (
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: 12,
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Top Reasons
              </div>
              <div style={{ marginTop: 8, fontSize: 12 }}>
                {summary.by_reason.slice(0, 4).map(r => (
                  <div key={r.reason_code}>
                    <span style={{ fontWeight: 500 }}>{r.reason_code}:</span> {formatCurrency(r.amount)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {summary.by_buyer && summary.by_buyer.length > 0 && (
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: 12,
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                By Buyer
              </div>
              <div style={{ marginTop: 8, fontSize: 12 }}>
                {summary.by_buyer.map(b => (
                  <div key={b.buyer}>
                    <span style={{ fontWeight: 500 }}>{b.buyer}:</span> {formatCurrency(b.amount)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
