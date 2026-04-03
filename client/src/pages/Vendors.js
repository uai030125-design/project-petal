import React, { useState } from 'react';

const VENDOR_SYSTEMS = [
  {
    name: 'Street Account',
    description: 'Factoring and accounts receivable management',
    status: 'Active',
    color: 'var(--success)',
    features: ['Invoice factoring', 'AR tracking', 'Payment processing', 'Credit monitoring'],
  },
  {
    name: 'WinFashion',
    description: 'Apparel ERP — production, inventory, and order management',
    status: 'Active',
    color: 'var(--success)',
    features: ['Purchase orders', 'Style management', 'Inventory tracking', 'Costing & pricing'],
  },
  {
    name: 'Microsoft',
    description: 'Microsoft 365 — email, documents, and productivity suite',
    status: 'Active',
    color: 'var(--success)',
    features: ['Outlook email', 'Teams', 'Excel & Word', 'OneDrive storage'],
  },
  {
    name: 'Health Insurance',
    description: 'Employee health insurance plan and benefits administration',
    status: 'Active',
    color: 'var(--success)',
    features: ['Medical coverage', 'Dental & vision', 'Claims management', 'Open enrollment'],
  },
  {
    name: '401(k)',
    description: 'Retirement savings plan and employer matching contributions',
    status: 'Active',
    color: 'var(--success)',
    features: ['Employee contributions', 'Employer match', 'Fund selection', 'Retirement planning'],
  },
];

export default function Vendors() {
  const [expanded, setExpanded] = useState(null);

  return (
    <div className="fade-in">
      <div className="section-header">
        <div className="section-title">Vendors</div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 20,
        marginBottom: 24,
      }}>
        {VENDOR_SYSTEMS.map((v, i) => {
          const isExpanded = expanded === i;
          return (
            <div
              key={v.name}
              onClick={() => setExpanded(isExpanded ? null : i)}
              style={{
                background: 'var(--surface)',
                border: isExpanded ? '2px solid var(--accent)' : '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '24px 28px',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{v.name}</div>
                <span style={{
                  fontSize: 11, fontWeight: 600, color: v.color,
                  background: v.color === 'var(--success)' ? 'rgba(94,154,108,0.12)' : 'rgba(196,80,80,0.12)',
                  padding: '3px 10px', borderRadius: 20,
                }}>{v.status}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 12 }}>{v.description}</div>

              {isExpanded && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>
                    Key Features
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {v.features.map(f => (
                      <span key={f} style={{
                        fontSize: 12, padding: '4px 12px', borderRadius: 20,
                        background: 'var(--surface2)', color: 'var(--text-dim)',
                        border: '1px solid var(--border)',
                      }}>{f}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
