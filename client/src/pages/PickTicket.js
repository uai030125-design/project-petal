import React from 'react';
import PageHeader from '../components/shared/PageHeader';

export default function PickTicket() {
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader title="Pick Ticket" subtitle="SUMMARY GENERATOR" />
      <div style={{ flex: 1, marginTop: 16, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
        <iframe
          src="/pick-ticket.html"
          title="Pick Ticket Summary Generator"
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            minHeight: 700,
          }}
        />
      </div>
    </div>
  );
}
