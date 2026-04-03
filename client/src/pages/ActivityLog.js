import React, { useState, useMemo } from 'react';
import PageHeader from '../components/shared/PageHeader';
import { useToast } from '../components/shared/Toast';
import {
  Truck,
  Package,
  Users,
  BarChart3,
  DollarSign,
  Settings,
  Clock,
  Filter,
  Calendar,
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Edit3,
} from 'lucide-react';

// Sample activity data covering the past 7 days
const SAMPLE_ACTIVITIES = [
  {
    id: 1,
    type: 'system',
    icon: 'Settings',
    description: 'Removed Reports tab from navigation bar',
    category: 'System',
    timestamp: new Date(Date.now() - 10 * 60 * 1000),
    user: { name: 'Jazzy', initials: 'JZ' },
  },
  {
    id: 2,
    type: 'system',
    icon: 'Settings',
    description: 'Todo list: In Process items now display with blue shading; Enter key adds new item',
    category: 'System',
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
    user: { name: 'Jazzy', initials: 'JZ' },
  },
  {
    id: 3,
    type: 'system',
    icon: 'Settings',
    description: 'Finance nav: Renamed "Thomas" to "Francisco", added Agent header section',
    category: 'Finance',
    timestamp: new Date(Date.now() - 20 * 60 * 1000),
    user: { name: 'Jazzy', initials: 'JZ' },
  },
  {
    id: 4,
    type: 'system',
    icon: 'Settings',
    description: 'Showroom nav: Added "Agent" header section with Woodcock',
    category: 'System',
    timestamp: new Date(Date.now() - 25 * 60 * 1000),
    user: { name: 'Jazzy', initials: 'JZ' },
  },
  {
    id: 5,
    type: 'system',
    icon: 'Settings',
    description: 'Home page: Moved Monica section to left column with expandable agent activity cards',
    category: 'System',
    timestamp: new Date(Date.now() - 35 * 60 * 1000),
    user: { name: 'Jazzy', initials: 'JZ' },
  },
  {
    id: 6,
    type: 'crm',
    icon: 'Users',
    description: 'Created John Anthony CRM agent page with quad matrix: Meetings, Outreach, Line Sheets, Latest Reads',
    category: 'CRM',
    timestamp: new Date(Date.now() - 45 * 60 * 1000),
    user: { name: 'Jazzy', initials: 'JZ' },
  },
  {
    id: 7,
    type: 'crm',
    icon: 'Users',
    description: 'CRM nav: Added "Agent" header section with John Anthony page link',
    category: 'CRM',
    timestamp: new Date(Date.now() - 50 * 60 * 1000),
    user: { name: 'Jazzy', initials: 'JZ' },
  },
  {
    id: 8,
    type: 'system',
    icon: 'Settings',
    description: 'Home Library: Converted all links to download buttons (Logistics Report PDF, ATS PDF, Line Sheet Excel)',
    category: 'System',
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
    user: { name: 'Jazzy', initials: 'JZ' },
  },
  {
    id: 9,
    type: 'crm',
    icon: 'Users',
    description: 'Added Grace Umiker / Burlington Caftan buyer card with 7/30 caftans email data',
    category: 'CRM',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    user: { name: 'Jazzy', initials: 'JZ' },
  },
  {
    id: 10,
    type: 'crm',
    icon: 'Users',
    description: 'Contact Log: Added email drop box for quick entry creation from pasted emails',
    category: 'CRM',
    timestamp: new Date(Date.now() - 2.5 * 60 * 60 * 1000),
    user: { name: 'Jazzy', initials: 'JZ' },
  },
  {
    id: 11,
    type: 'system',
    icon: 'Settings',
    description: 'Showroom: Added PPTX parser to extract images and styles from dropped presentations',
    category: 'System',
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
    user: { name: 'Jazzy', initials: 'JZ' },
  },
  {
    id: 12,
    type: 'shipping',
    icon: 'Truck',
    description: 'Logistics Report: Restructured to Unrouted POs + Routed POs for 2-week window with Chocolate Brown headers',
    category: 'Shipping',
    timestamp: new Date(Date.now() - 3.5 * 60 * 60 * 1000),
    user: { name: 'Jazzy', initials: 'JZ' },
  },
  {
    id: 13,
    type: 'shipping',
    icon: 'Truck',
    description: 'Burlington BuyerPage: Added Start Date and Route By columns to Weekly Order Listing',
    category: 'Shipping',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
    user: { name: 'Jazzy', initials: 'JZ' },
  },
  {
    id: 14,
    type: 'system',
    icon: 'Settings',
    description: 'Home page: Fixed Library links that were not clicking (converted from broken API calls to navigation)',
    category: 'System',
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
    user: { name: 'Jazzy', initials: 'JZ' },
  },
  {
    id: 15,
    type: 'system',
    icon: 'Settings',
    description: 'Layout: Renamed ATS nav labels from "ATS | Core" / "ATS | Scrubs" to "Core" / "Scrubs"',
    category: 'System',
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
    user: { name: 'Jazzy', initials: 'JZ' },
  },
];

const CATEGORIES = ['All', 'Shipping', 'Production', 'CRM', 'Inventory', 'Finance', 'System'];
const DATE_FILTERS = ['Today', 'This Week', 'This Month', 'All Time'];

const getIconComponent = (iconName) => {
  const icons = {
    Truck,
    Package,
    Users,
    BarChart3,
    DollarSign,
    Settings,
    Clock,
    CheckCircle2,
    AlertTriangle,
    Upload,
    FileText,
    Edit3,
  };
  return icons[iconName] || Clock;
};

const getRelativeTime = (date) => {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays === 1) {
    return `Yesterday at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  }
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const getDateFilterRange = (filter) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (filter) {
    case 'Today':
      return { start: startOfToday, end: now };
    case 'This Week': {
      const weekStart = new Date(startOfToday);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      return { start: weekStart, end: now };
    }
    case 'This Month': {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: monthStart, end: now };
    }
    case 'All Time':
    default:
      return { start: new Date(0), end: now };
  }
};

const getCategoryColor = (category) => {
  const colors = {
    Shipping: 'badge-blue',
    Production: 'badge-success',
    CRM: 'badge-accent',
    Inventory: 'badge-warning',
    Finance: 'badge-danger',
    System: 'badge-secondary',
  };
  return colors[category] || 'badge-secondary';
};

export default function ActivityLog() {
  const { showToast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedDateFilter, setSelectedDateFilter] = useState('All Time');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredActivities = useMemo(() => {
    const dateRange = getDateFilterRange(selectedDateFilter);

    return SAMPLE_ACTIVITIES.filter((activity) => {
      // Category filter
      if (selectedCategory !== 'All' && activity.category !== selectedCategory) {
        return false;
      }

      // Date filter
      if (activity.timestamp < dateRange.start || activity.timestamp > dateRange.end) {
        return false;
      }

      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          activity.description.toLowerCase().includes(searchLower) ||
          activity.category.toLowerCase().includes(searchLower) ||
          activity.user.name.toLowerCase().includes(searchLower)
        );
      }

      return true;
    }).sort((a, b) => b.timestamp - a.timestamp);
  }, [selectedCategory, selectedDateFilter, searchTerm]);

  const handleExport = () => {
    showToast('Activity log exported successfully', 'success');
  };

  return (
    <div className="fade-in" style={{ padding: '2rem' }}>
      <PageHeader
        title="Activity Log"
      />

      {/* Filter Section */}
      <div className="card" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
        {/* Search */}
        <div style={{ marginBottom: '1.5rem' }}>
          <input
            type="text"
            className="search-input"
            placeholder="Search activities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              maxWidth: '400px',
            }}
          />
        </div>

        {/* Category Filters */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Category
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                className={`filter-pill ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  backgroundColor: selectedCategory === cat ? 'var(--accent)' : 'var(--surface2)',
                  color: selectedCategory === cat ? 'white' : 'var(--text)',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '1.5rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Date Filters */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Date Range
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {DATE_FILTERS.map((date) => (
              <button
                key={date}
                className={`filter-pill ${selectedDateFilter === date ? 'active' : ''}`}
                onClick={() => setSelectedDateFilter(date)}
                style={{
                  backgroundColor: selectedDateFilter === date ? 'var(--accent)' : 'var(--surface2)',
                  color: selectedDateFilter === date ? 'white' : 'var(--text)',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '1.5rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                {date}
              </button>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <div>
          <button className="btn btn-secondary btn-sm" onClick={handleExport}>
            Export Log
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div style={{ position: 'relative' }}>
        {filteredActivities.length === 0 ? (
          <div
            className="card"
            style={{
              padding: '3rem',
              textAlign: 'center',
              color: 'var(--text-muted)',
            }}
          >
            No activities found. Try adjusting your filters.
          </div>
        ) : (
          <div className="stagger-in">
            {filteredActivities.map((activity, index) => {
              const IconComponent = getIconComponent(activity.icon);
              const categoryColor = getCategoryColor(activity.category);

              return (
                <div
                  key={activity.id}
                  style={{
                    display: 'flex',
                    gap: '1.5rem',
                    marginBottom: '2rem',
                    animation: `fadeInUp 0.3s ease-out ${index * 0.05}s both`,
                  }}
                >
                  {/* Timeline dot and line */}
                  <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
                    <div
                      style={{
                        width: '2.5rem',
                        height: '2.5rem',
                        borderRadius: '50%',
                        background: 'var(--accent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        marginTop: '0.125rem',
                        flexShrink: 0,
                      }}
                    >
                      <IconComponent size={18} />
                    </div>
                    {index < filteredActivities.length - 1 && (
                      <div
                        style={{
                          position: 'absolute',
                          left: '1.25rem',
                          top: '2.5rem',
                          width: '0.125rem',
                          height: '2rem',
                          background: 'var(--border)',
                        }}
                      />
                    )}
                  </div>

                  {/* Activity content */}
                  <div
                    className="card"
                    style={{
                      flex: 1,
                      padding: '1rem',
                      marginTop: '0.25rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                      <div>
                        <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text)', fontWeight: 500 }}>
                          {activity.description}
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span className={`badge-${categoryColor.split('-')[1]}`} style={{ fontSize: '0.75rem' }}>
                            {activity.category}
                          </span>
                          <span
                            style={{
                              fontSize: '0.875rem',
                              color: 'var(--text-muted)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                          >
                            <Clock size={14} />
                            {getRelativeTime(activity.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* User info */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginTop: '0.75rem',
                        paddingTop: '0.75rem',
                        borderTop: '1px solid var(--border)',
                      }}
                    >
                      <div
                        style={{
                          width: '1.75rem',
                          height: '1.75rem',
                          borderRadius: '50%',
                          background: 'var(--accent)',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                        }}
                      >
                        {activity.user.initials}
                      </div>
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-dim)' }}>
                        {activity.user.name}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
