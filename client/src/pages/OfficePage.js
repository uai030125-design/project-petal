import React from 'react';
import { useParams } from 'react-router-dom';
import { Monitor, Users, Scale, Building2 } from 'lucide-react';

const officeInfo = {
  it: { icon: Monitor, title: 'IT', desc: 'Technology infrastructure, systems, and support' },
  hr: { icon: Users, title: 'HR', desc: 'Human resources, hiring, and employee management' },
  legal: { icon: Scale, title: 'Legal', desc: 'Contracts, compliance, and legal documentation' },
};

export default function OfficePage() {
  const { dept } = useParams();
  const info = officeInfo[dept] || { icon: Building2, title: dept, desc: '' };
  const IconComp = info.icon;

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>Office — {info.title}</h1>
        <p>{info.desc}</p>
      </div>
      <div className="card" style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
          <IconComp size={32} strokeWidth={1.5} />
        </div>
        <div>{info.title} department workspace</div>
        <div style={{ fontSize: 12, marginTop: 8 }}>Documents and tools will be added here.</div>
      </div>
    </div>
  );
}
