import React from 'react';
import PageHeader from '../components/shared/PageHeader';

export default function ComplianceScorecard() {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <PageHeader title="Compliance Scorecard" />
      <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
        No data yet.
      </div>
    </div>
  );
}
