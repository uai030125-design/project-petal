import React from 'react';
import PageHeader from '../components/shared/PageHeader';

export default function ChargebackTracker() {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <PageHeader title="Chargebacks" />
      <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
        No data yet.
      </div>
    </div>
  );
}
