import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NeedleLogo from './NeedleLogo';
import NotificationBell from './shared/NotificationBell';

const navItems = [
  { path: '/', label: 'Home' },
  {
    label: 'Logistics',
    children: [
      { header: 'Agent' },
      { path: '/logistics/larry', label: 'Eddie' },
      { divider: true },
      { header: 'Shipping' },
      { path: '/shipping', label: 'Routing' },
      { path: '/production', label: 'Production' },
      { path: '/containers', label: 'Containers' },
      { path: '/logistics/pick-ticket', label: 'Pick Ticket' },
      { divider: true },
      { header: 'By Buyer' },
      { path: '/buyer/burlington', label: 'Burlington' },
      { path: '/buyer/ross-missy', label: 'Ross Missy' },
      { path: '/buyer/ross-petite', label: 'Ross Petite' },
      { path: '/buyer/ross-plus', label: 'Ross Plus' },
      { path: '/buyer/bealls', label: 'Bealls' },
      { divider: true },
      { header: 'Compliance' },
      { path: '/logistics/compliance', label: 'Scorecard' },
      { path: '/logistics/chargebacks', label: 'Chargebacks' },
    ]
  },
  {
    label: 'Sales',
    children: [
      { header: 'Agent' },
      { path: '/crm/john-anthony', label: 'John Anthony' },
      { divider: true },
      { path: '/crm/contact-log', label: 'Contact Log' },
      { path: '/crm/line-sheets', label: 'Line Sheets' },
      { path: '/crm/new-customer-outreach', label: 'New Customer Outreach' },
    ]
  },
  {
    label: 'Showroom',
    children: [
      { header: 'Agent' },
      { path: '/showroom/jazzy', label: 'Woodcock' },
      { divider: true },
      { path: '/showroom', label: 'Showroom' },
      { path: '/showroom/samples', label: 'Sample Tracker' },
      { divider: true },
      { header: 'ATS' },
      { path: '/showroom/ats', label: 'Core' },
      { path: '/showroom/scrubs', label: 'Scrubs ATS' },
    ]
  },
  {
    label: 'Finance',
    children: [
      { header: 'Agent' },
      { path: '/internal/portfolio', label: 'Francisco' },
      { divider: true },
      { header: 'Unlimited Avenues' },
      { path: '/model', label: 'Model' },
      { path: '/finance/bookings', label: 'Bookings' },
    ]
  },
  {
    label: 'Office',
    children: [
      { path: '/office/team', label: 'Team' },
      { path: '/office/logos', label: 'Logos' },
      { path: '/finance/vendor-hub', label: 'Vendor Hub' },
      { path: '/vault', label: 'Document Vault' },
    ]
  },
  {
    label: 'Internal',
    pink: true,
    children: [
      { path: '/internal/monica', label: 'Monica' },
      { path: '/internal/todo', label: 'To Do' },
      { path: '/internal/walkthrough', label: 'App Walkthrough' },
      { path: '/internal/activity', label: 'Activity Log' },
    ]
  },
];

function NavDropdown({ item, location }) {
  const [open, setOpen] = useState(false);
  const isActive = item.children?.some(c => c.path && location.pathname === c.path);

  return (
    <div
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      style={{ position: 'relative' }}
    >
      <button className={`tab ${isActive ? 'active' : ''} ${item.pink ? 'tab-pink' : ''}`} onClick={() => setOpen(!open)}>
        {item.label} <span style={{ fontSize: 9, marginLeft: 2, opacity: 0.6 }}>&#9662;</span>
      </button>
      {open && (
        <div className="dropdown-bridge">
          <div className="dropdown-menu">
            {item.children.map((child, idx) => {
              if (child.divider) return <div key={`div-${idx}`} style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />;
              if (child.header) return <div key={`hdr-${idx}`} style={{ padding: '6px 14px 2px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{child.header}</div>;
              return (
                <Link
                  key={child.path}
                  to={child.path}
                  className={`dropdown-item ${location.pathname === child.path ? 'active' : ''}`}
                  onClick={() => setOpen(false)}
                >
                  {child.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Layout({ children }) {
  const { logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [theme, setTheme] = useState('light');

  React.useEffect(() => {
    // Load theme from localStorage on mount
    const savedTheme = localStorage.getItem('petal-theme') || 'light';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const handleThemeToggle = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('petal-theme', newTheme);
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="fade-in">
      <header className="header">
        <Link to="/" className="logo" style={{ textDecoration: 'none' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{
              position: 'absolute', width: 52, height: 52, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(212,160,160,0.25) 0%, transparent 70%)',
              filter: 'blur(6px)', pointerEvents: 'none',
            }} />
            <NeedleLogo size={36} color="var(--accent)" />
          </div>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{
              fontSize: 24, fontWeight: 700, letterSpacing: 0.3,
              background: 'linear-gradient(135deg, #3E2723 0%, #d4a0a0 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>Petal</div>
          </div>
        </Link>

        <div className="tabs">
          {navItems.map((item, i) =>
            item.children ? (
              <NavDropdown key={i} item={item} location={location} />
            ) : (
              <Link
                key={item.path}
                to={item.path}
                className={`tab ${location.pathname === item.path ? 'active' : ''} ${item.pink ? 'tab-pink' : ''}`}
              >
                {item.label}
              </Link>
            )
          )}
        </div>

        <div className="header-right">
          <NotificationBell />
          <button
            className="theme-toggle"
            onClick={handleThemeToggle}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            style={{ cursor: 'pointer' }}
          >
            {theme === 'light' ? '☽' : '☀'}
          </button>
          <button className="btn-ghost" onClick={handleLogout} style={{ cursor: 'pointer' }}>Sign Out</button>
        </div>
      </header>

      <main className="main fade-in">
        {children}
      </main>

      <style>{`
        .header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 32px;
          border-bottom: none;
          background: var(--header-bg);
          position: sticky; top: 0; z-index: 100;
        }
        .logo { display: flex; align-items: center; gap: 14px; cursor: pointer; }
        .tabs {
          display: flex; gap: 4px; background: var(--nav-bg); border-radius: 10px; padding: 4px;
        }
        .tab {
          padding: 10px 24px; border-radius: 7px; font-size: 15px; font-weight: 500;
          color: rgba(255,255,255,0.7); cursor: pointer; transition: all 0.2s;
          border: none; background: none; font-family: inherit; letter-spacing: 0.3px;
          text-decoration: none; display: inline-flex; align-items: center;
        }
        .tab:hover { color: #fff; background: rgba(255,255,255,0.12); }
        .tab.active {
          color: var(--nav-bg); background: #fff; font-weight: 600;
          box-shadow: inset 0 -2px 0 #d4a0a0;
        }
        .tab-pink { background: #E8B4BC; color: #000; }
        .tab-pink:hover { background: #dea3ac; color: #000; }
        .tab-pink.active { background: #E8B4BC; color: #000; font-weight: 600; }

        /* Dark mode nav overrides */
        [data-theme="dark"] .tab-pink { background: #E8B4BC; color: #000; }
        [data-theme="dark"] .tab-pink:hover { background: #dea3ac; color: #000; }
        [data-theme="dark"] .tab-pink.active { background: #E8B4BC; color: #000; font-weight: 600; }
        .header-right { display: flex; align-items: center; gap: 12px; }
        .theme-toggle {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: var(--surface2);
          border: 1px solid var(--border);
          color: var(--text-dim);
          font-size: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }
        .theme-toggle:hover {
          background: var(--surface3);
          color: var(--text);
          border-color: var(--border-hover);
        }
        .btn-ghost {
          background: none;
          color: var(--text-dim);
          border: 1px solid var(--border);
          padding: 6px 14px;
          font-size: 12px;
          border-radius: 6px;
          font-family: inherit;
          font-weight: 600;
          transition: all 0.15s;
        }
        .btn-ghost:hover { background: var(--surface2); color: var(--text); border-color: var(--border-hover); }
        .dropdown-bridge {
          position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
          padding-top: 4px;
          z-index: 200;
        }
        .dropdown-menu {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 10px; padding: 6px; min-width: 160px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.15);
        }
        .dropdown-item {
          display: block; padding: 9px 14px; font-size: 13px; color: var(--text-dim);
          border-radius: 6px; text-decoration: none; transition: all 0.15s;
        }
        .dropdown-item:hover { background: var(--surface2); color: var(--text); }
        .dropdown-item.active { color: var(--accent-dark); font-weight: 600; }
        .main { padding: 32px; max-width: 1400px; margin: 0 auto; }
      `}</style>
    </div>
  );
}
