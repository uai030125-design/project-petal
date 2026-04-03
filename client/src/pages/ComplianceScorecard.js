import React, { useState, useEffect, useMemo } from 'react';
import api from '../utils/api';
import PageHeader from '../components/shared/PageHeader';
import { useToast } from '../components/shared/Toast';

export default function ComplianceScorecard() {
  const toast = useToast();
  const [scorecard, setScorecard] = useState([]);
  const [atRiskPOs, setAtRiskPOs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedBuyer, setExpandedBuyer] = useState(null);
  const [filter, setFilter] = useState({ buyer: '', severity: '' });

  // Load compliance data on mount
  useEffect(() => {
    loadComplianceData();
  }, []);

  const loadComplianceData = async () => {
    setLoading(true);
    try {
      const [scoreRes, atRiskRes] = await Promise.all([
        api.get('/compliance/scorecard'),
        api.get('/compliance/at-risk'),
      ]);
      setScorecard(scoreRes.data?.data || []);
      setAtRiskPOs(atRiskRes.data?.data || []);
    } catch (err) {
      console.error('Error loading compliance data:', err);
      toast.error('Failed to load compliance data');
    }
    setLoading(false);
  };

  // Filter at-risk POs
  const filteredAtRisk = useMemo(() => {
    let filtered = atRiskPOs;
    if (filter.buyer) {
      filtered = filtered.filter(po => po.buyer.toLowerCase().includes(filter.buyer.toLowerCase()));
    }
    if (filter.severity) {
      filtered = filtered.filter(po => po.severity === filter.severity);
    }
    return filtered.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2 };
      return (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3);
    });
  }, [atRiskPOs, filter]);

  // Get color for compliance score
  const getScoreColor = (score) => {
    if (score >= 90) return 'var(--success)';
    if (score >= 75) return 'var(--warning)';
    return 'var(--danger)';
  };

  // Get trend icon
  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'improving':
        return '↗';
      case 'declining':
        return '↘';
      default:
        return '→';
    }
  };

  // Get severity badge color
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical':
        return { bg: 'rgba(196,80,80,0.1)', text: 'var(--danger)', border: 'rgba(196,80,80,0.2)' };
      case 'high':
        return { bg: 'rgba(196,154,64,0.1)', text: 'var(--warning)', border: 'rgba(196,154,64,0.2)' };
      case 'medium':
        return { bg: 'rgba(95,143,170,0.1)', text: 'var(--blue)', border: 'rgba(95,143,170,0.2)' };
      default:
        return { bg: 'var(--surface2)', text: 'var(--text)', border: '1px solid var(--border)' };
    }
  };

  if (loading) {
    return (
      <div className="fade-in" style={{ padding: 24 }}>
        <PageHeader title="Compliance Scorecard" />
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 48 }}>
          Loading compliance data...
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <PageHeader title="Compliance Scorecard" />

      {/* Summary Section */}
      <div style={{ marginBottom: 32 }}>
        <div style={{
          fontSize: 14,
          fontWeight: 700,
          color: 'var(--text)',
          marginBottom: 12,
          letterSpacing: 0.3,
          textTransform: 'uppercase',
        }}>
          Buyer Performance Overview
        </div>

        {/* Scorecard Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}>
          {scorecard.map(buyer => (
            <div
              key={buyer.buyer}
              onClick={() => setExpandedBuyer(expandedBuyer === buyer.buyer ? null : buyer.buyer)}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: 16,
                cursor: 'pointer',
                transition: 'all 0.2s',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.boxShadow = 'var(--shadow)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Buyer name */}
              <div style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 8,
              }}>
                {buyer.buyer}
              </div>

              {/* Overall score */}
              <div style={{
                fontSize: 32,
                fontWeight: 700,
                color: getScoreColor(buyer.overall_score),
                marginBottom: 4,
              }}>
                {buyer.overall_score.toFixed(1)}%
              </div>

              {/* Trend indicator */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 12,
                fontSize: 13,
              }}>
                <span style={{ fontSize: 18 }}>
                  {getTrendIcon(buyer.trend)}
                </span>
                <span style={{
                  color: buyer.trend === 'improving' ? 'var(--success)' : buyer.trend === 'declining' ? 'var(--danger)' : 'var(--text-dim)',
                  fontWeight: 600,
                }}>
                  {buyer.trend_change}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  {buyer.trend}
                </span>
              </div>

              {/* Order progress */}
              <div style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                marginBottom: 8,
              }}>
                {buyer.completed_orders}/{buyer.total_orders} orders
              </div>

              {/* Progress bar */}
              <div style={{
                height: 4,
                background: 'var(--surface2)',
                borderRadius: 2,
                overflow: 'hidden',
              }}>
                <div
                  style={{
                    height: '100%',
                    background: getScoreColor(buyer.overall_score),
                    width: `${(buyer.completed_orders / buyer.total_orders) * 100}%`,
                    transition: 'width 0.3s',
                  }}
                />
              </div>

              {/* Expand indicator */}
              <div style={{
                position: 'absolute',
                top: 12,
                right: 12,
                fontSize: 14,
                color: 'var(--text-muted)',
                opacity: expandedBuyer === buyer.buyer ? 1 : 0.6,
              }}>
                {expandedBuyer === buyer.buyer ? '▼' : '▶'}
              </div>
            </div>
          ))}
        </div>

        {/* Expanded Details Table */}
        {expandedBuyer && (
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
            marginBottom: 24,
          }}>
            <div style={{
              padding: 16,
              borderBottom: '1px solid var(--border)',
              background: 'var(--surface2)',
            }}>
              <div style={{
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--text)',
              }}>
                {expandedBuyer} — Detailed Metrics
              </div>
            </div>

            <div style={{ padding: 16 }}>
              {scorecard.find(b => b.buyer === expandedBuyer) && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 16,
                }}>
                  {[
                    { label: 'On-Time Shipping', value: scorecard.find(b => b.buyer === expandedBuyer).on_time_shipping },
                    { label: 'Routing Compliance', value: scorecard.find(b => b.buyer === expandedBuyer).routing_compliance },
                    { label: 'ASN Accuracy', value: scorecard.find(b => b.buyer === expandedBuyer).asn_accuracy },
                    { label: 'Labeling Compliance', value: scorecard.find(b => b.buyer === expandedBuyer).labeling_compliance },
                  ].map(metric => (
                    <div key={metric.label}>
                      <div style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        marginBottom: 6,
                      }}>
                        {metric.label}
                      </div>
                      <div style={{
                        fontSize: 24,
                        fontWeight: 700,
                        color: getScoreColor(metric.value),
                        marginBottom: 6,
                      }}>
                        {metric.value}%
                      </div>
                      <div style={{
                        height: 6,
                        background: 'var(--surface2)',
                        borderRadius: 3,
                        overflow: 'hidden',
                      }}>
                        <div
                          style={{
                            height: '100%',
                            background: getScoreColor(metric.value),
                            width: `${metric.value}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* At-Risk POs Section */}
      <div style={{ marginBottom: 32 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}>
          <div style={{
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--text)',
            letterSpacing: 0.3,
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--danger)',
            }} />
            At-Risk POs
            {filteredAtRisk.length > 0 && (
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                background: 'rgba(196,80,80,0.15)',
                color: 'var(--danger)',
                padding: '2px 8px',
                borderRadius: 12,
              }}>
                {filteredAtRisk.length}
              </span>
            )}
          </div>

          {/* Filters */}
          <div style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
          }}>
            <input
              type="text"
              placeholder="Filter by buyer..."
              value={filter.buyer}
              onChange={e => setFilter(prev => ({ ...prev, buyer: e.target.value }))}
              style={{
                padding: '6px 10px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12,
                background: 'var(--surface)',
                color: 'var(--text)',
                outline: 'none',
              }}
              onFocus={e => { e.target.style.borderColor = 'var(--accent)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
            />
            <select
              value={filter.severity}
              onChange={e => setFilter(prev => ({ ...prev, severity: e.target.value }))}
              style={{
                padding: '6px 10px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12,
                background: 'var(--surface)',
                color: 'var(--text)',
                cursor: 'pointer',
                outline: 'none',
              }}
              onFocus={e => { e.target.style.borderColor = 'var(--accent)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
            >
              <option value="">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
            </select>
          </div>
        </div>

        {/* At-Risk Table */}
        {filteredAtRisk.length > 0 ? (
          <div style={{
            overflowX: 'auto',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
          }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 13,
            }}>
              <thead>
                <tr style={{
                  background: 'var(--surface2)',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Severity</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>PO #</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Buyer</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Style</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>Units</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Ship Window</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>Days Until</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredAtRisk.map((po, idx) => {
                  const colors = getSeverityColor(po.severity);
                  return (
                    <tr key={po.id} style={{
                      borderBottom: idx < filteredAtRisk.length - 1 ? '1px solid var(--border)' : 'none',
                      background: idx % 2 === 0 ? 'transparent' : 'var(--surface2)',
                    }}>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 11,
                          fontWeight: 600,
                          background: colors.bg,
                          color: colors.text,
                          textTransform: 'uppercase',
                          border: `1px solid ${colors.border}`,
                        }}>
                          {po.severity}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--accent)' }}>
                        {po.po_number}
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--text)' }}>
                        {po.buyer}
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-dim)', fontSize: 12 }}>
                        {po.style}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', color: 'var(--text)' }}>
                        {(po.units || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-dim)', fontSize: 12 }}>
                        {po.ship_window_start} to {po.ship_window_end}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <div style={{
                          display: 'inline-block',
                          padding: '4px 12px',
                          borderRadius: 'var(--radius-sm)',
                          background: po.days_until_ship <= 5 ? 'rgba(196,80,80,0.1)' : 'var(--surface2)',
                          color: po.days_until_ship <= 5 ? 'var(--danger)' : 'var(--text)',
                          fontWeight: 600,
                        }}>
                          {po.days_until_ship}d
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-dim)', fontSize: 12 }}>
                        {po.notes}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: 32,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            color: 'var(--text-muted)',
          }}>
            No at-risk POs {filter.buyer || filter.severity ? 'matching filters' : ''}
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {atRiskPOs.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
        }}>
          {[
            { label: 'Critical', value: atRiskPOs.filter(p => p.severity === 'critical').length, color: 'var(--danger)' },
            { label: 'High', value: atRiskPOs.filter(p => p.severity === 'high').length, color: 'var(--warning)' },
            { label: 'Medium', value: atRiskPOs.filter(p => p.severity === 'medium').length, color: 'var(--blue)' },
            { label: 'Total', value: atRiskPOs.length, color: 'var(--text)' },
          ].map(stat => (
            <div key={stat.label} style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: 14,
              textAlign: 'center',
            }}>
              <div style={{
                fontSize: 20,
                fontWeight: 700,
                color: stat.color,
                marginBottom: 4,
              }}>
                {stat.value}
              </div>
              <div style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {scorecard.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: 48,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          color: 'var(--text-muted)',
        }}>
          No compliance data available
        </div>
      )}
    </div>
  );
}
