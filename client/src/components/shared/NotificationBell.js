import React, { useState, useEffect, useRef } from 'react';
import { Bell, AlertTriangle, AlertCircle, Info, X, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const NotificationBell = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [alertsByPriority, setAlertsByPriority] = useState({
    critical: [],
    warning: [],
    info: [],
  });
  const panelRef = useRef(null);
  const bellRef = useRef(null);
  const pollIntervalRef = useRef(null);

  // Load alerts on mount and set up polling
  useEffect(() => {
    loadAlerts();
    // Poll for new alerts every 30 seconds
    pollIntervalRef.current = setInterval(loadAlerts, 30000);
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Handle click outside to close panel
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target) &&
        bellRef.current &&
        !bellRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/alerts', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('ua_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch alerts');
      }

      const data = await response.json();
      const allAlerts = data.alerts || [];

      setAlerts(allAlerts);
      setUnreadCount(data.unreadCount || 0);

      // Group alerts by priority
      const grouped = {
        critical: allAlerts.filter(a => a.priority === 'critical'),
        warning: allAlerts.filter(a => a.priority === 'warning'),
        info: allAlerts.filter(a => a.priority === 'info'),
      };
      setAlertsByPriority(grouped);
    } catch (error) {
      console.error('Failed to load alerts:', error);
      // Set empty alerts on error
      setAlerts([]);
      setAlertsByPriority({ critical: [], warning: [], info: [] });
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };

  const handleDismissAlert = async (alertId, e) => {
    e.stopPropagation();
    try {
      const response = await fetch(`/api/alerts/${alertId}/dismiss`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('ua_token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        // Remove alert from local state
        const updated = alerts.filter(a => a.id !== alertId);
        setAlerts(updated);

        // Update grouped alerts
        const grouped = {
          critical: updated.filter(a => a.priority === 'critical'),
          warning: updated.filter(a => a.priority === 'warning'),
          info: updated.filter(a => a.priority === 'info'),
        };
        setAlertsByPriority(grouped);
        setUnreadCount(updated.filter(a => !a.read).length);
      }
    } catch (error) {
      console.error('Error dismissing alert:', error);
    }
  };

  const handleSnoozeAlert = async (alertId, hours, e) => {
    e.stopPropagation();
    try {
      const response = await fetch(`/api/alerts/${alertId}/snooze`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('ua_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ hours }),
      });

      if (response.ok) {
        // Remove alert from local state (it's snoozed)
        const updated = alerts.filter(a => a.id !== alertId);
        setAlerts(updated);

        // Update grouped alerts
        const grouped = {
          critical: updated.filter(a => a.priority === 'critical'),
          warning: updated.filter(a => a.priority === 'warning'),
          info: updated.filter(a => a.priority === 'info'),
        };
        setAlertsByPriority(grouped);
        setUnreadCount(updated.filter(a => !a.read).length);
      }
    } catch (error) {
      console.error('Error snoozing alert:', error);
    }
  };

  const handleAlertClick = (alert) => {
    // Mark as read by navigating to the action link if available
    if (alert.actionLink) {
      navigate(alert.actionLink);
      setIsOpen(false);
    }
  };

  const getAlertIcon = (priority) => {
    switch (priority) {
      case 'critical':
        return AlertTriangle;
      case 'warning':
        return AlertCircle;
      case 'info':
      default:
        return Info;
    }
  };

  const getPriorityColors = (priority) => {
    switch (priority) {
      case 'critical':
        return {
          bg: '#fef2f2',
          border: '#fee2e2',
          icon: '#dc2626',
          dot: '#dc2626',
          label: 'Critical',
        };
      case 'warning':
        return {
          bg: '#fffbeb',
          border: '#fef3c7',
          icon: '#f59e0b',
          dot: '#f59e0b',
          label: 'Warning',
        };
      case 'info':
      default:
        return {
          bg: '#eff6ff',
          border: '#dbeafe',
          icon: '#3b82f6',
          dot: '#3b82f6',
          label: 'Info',
        };
    }
  };

  const getRelativeTime = (date) => {
    const now = new Date();
    const diffMs = now - new Date(date);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(date).toLocaleDateString();
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Bell Button */}
      <button
        ref={bellRef}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          padding: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text)',
          transition: 'transform 0.2s, color 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--accent)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--text)';
        }}
        aria-label="Alerts"
        title={unreadCount > 0 ? `${unreadCount} unread alert${unreadCount !== 1 ? 's' : ''}` : 'No alerts'}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '-0.5rem',
              right: '-0.5rem',
              minWidth: '1.25rem',
              height: '1.25rem',
              borderRadius: '50%',
              backgroundColor: '#dc2626',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.7rem',
              fontWeight: 'bold',
              border: '2px solid white',
              padding: '0 0.25rem',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </div>
        )}
      </button>

      {/* Alert Panel */}
      {isOpen && (
        <div
          ref={panelRef}
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            width: '420px',
            maxHeight: '650px',
            backgroundColor: 'var(--surface)',
            border: `1px solid var(--border)`,
            borderRadius: '0.75rem',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            marginTop: '0.5rem',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '1rem 1.25rem',
              borderBottom: `1px solid var(--border)`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>
                Alerts
              </h3>
              <p
                style={{
                  margin: '0.25rem 0 0 0',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                }}
              >
                {alerts.length === 0 ? 'All caught up' : `${alerts.length} active alert${alerts.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '0.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Close alerts panel"
            >
              <X size={18} />
            </button>
          </div>

          {/* Alerts Container */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
            }}
          >
            {alerts.length === 0 ? (
              <div
                style={{
                  padding: '3rem 1.25rem',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                }}
              >
                <Bell size={32} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                <p style={{ margin: 0, fontSize: '0.9rem' }}>
                  No active alerts
                </p>
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', opacity: 0.7 }}>
                  You're all caught up!
                </p>
              </div>
            ) : (
              <div>
                {/* Critical Alerts */}
                {alertsByPriority.critical.length > 0 && (
                  <div style={{ borderBottom: `1px solid var(--border)` }}>
                    <div
                      style={{
                        padding: '0.75rem 1.25rem',
                        backgroundColor: 'rgba(220, 38, 38, 0.05)',
                        borderBottom: `1px solid var(--border)`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <AlertTriangle size={14} color="#dc2626" />
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: '#dc2626',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}
                      >
                        Critical
                      </span>
                      <span
                        style={{
                          marginLeft: 'auto',
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                          fontWeight: 500,
                        }}
                      >
                        {alertsByPriority.critical.length}
                      </span>
                    </div>
                    {alertsByPriority.critical.map(alert => renderAlertItem(alert))}
                  </div>
                )}

                {/* Warning Alerts */}
                {alertsByPriority.warning.length > 0 && (
                  <div style={{ borderBottom: `1px solid var(--border)` }}>
                    <div
                      style={{
                        padding: '0.75rem 1.25rem',
                        backgroundColor: 'rgba(245, 158, 11, 0.05)',
                        borderBottom: `1px solid var(--border)`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <AlertCircle size={14} color="#f59e0b" />
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: '#f59e0b',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}
                      >
                        Warning
                      </span>
                      <span
                        style={{
                          marginLeft: 'auto',
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                          fontWeight: 500,
                        }}
                      >
                        {alertsByPriority.warning.length}
                      </span>
                    </div>
                    {alertsByPriority.warning.map(alert => renderAlertItem(alert))}
                  </div>
                )}

                {/* Info Alerts */}
                {alertsByPriority.info.length > 0 && (
                  <div>
                    <div
                      style={{
                        padding: '0.75rem 1.25rem',
                        backgroundColor: 'rgba(59, 130, 246, 0.05)',
                        borderBottom: `1px solid var(--border)`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <Info size={14} color="#3b82f6" />
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: '#3b82f6',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}
                      >
                        Info
                      </span>
                      <span
                        style={{
                          marginLeft: 'auto',
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                          fontWeight: 500,
                        }}
                      >
                        {alertsByPriority.info.length}
                      </span>
                    </div>
                    {alertsByPriority.info.map(alert => renderAlertItem(alert))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {alerts.length > 0 && (
            <div
              style={{
                padding: '0.75rem 1.25rem',
                borderTop: `1px solid var(--border)`,
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                textAlign: 'center',
              }}
            >
              Polling every 30 seconds
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Helper function to render individual alert items
  function renderAlertItem(alert) {
    const colors = getPriorityColors(alert.priority);
    const IconComponent = getAlertIcon(alert.priority);

    return (
      <div
        key={alert.id}
        style={{
          padding: '1rem 1.25rem',
          borderBottom: `1px solid var(--border)`,
          cursor: alert.actionLink ? 'pointer' : 'default',
          transition: 'background-color 0.2s',
          display: 'flex',
          gap: '0.875rem',
          alignItems: 'flex-start',
        }}
        onMouseEnter={(e) => {
          if (alert.actionLink) {
            e.currentTarget.style.backgroundColor = 'var(--hover-bg)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: '2.25rem',
            height: '2.25rem',
            minWidth: '2.25rem',
            borderRadius: '0.5rem',
            backgroundColor: colors.bg,
            border: `1px solid ${colors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconComponent size={16} color={colors.icon} strokeWidth={2} />
        </div>

        {/* Content */}
        <div
          style={{ flex: 1, minWidth: 0 }}
          onClick={() => handleAlertClick(alert)}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <p
              style={{
                margin: 0,
                fontSize: '0.9rem',
                fontWeight: 600,
                color: 'var(--text)',
              }}
            >
              {alert.title}
            </p>
            {!alert.read && (
              <div
                style={{
                  width: '0.5rem',
                  height: '0.5rem',
                  borderRadius: '50%',
                  backgroundColor: colors.dot,
                  flexShrink: 0,
                  marginTop: '0.5rem',
                }}
              />
            )}
          </div>

          <p
            style={{
              margin: '0 0 0.5rem 0',
              fontSize: '0.825rem',
              color: 'var(--text-muted)',
              lineHeight: '1.4',
            }}
          >
            {alert.description}
          </p>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
              }}
            >
              <Clock size={12} />
              {getRelativeTime(alert.timestamp)}
            </div>
          </div>

          {/* Action and Snooze Buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {alert.actionLink && (
              <button
                onClick={() => handleAlertClick(alert)}
                style={{
                  background: 'none',
                  border: `1px solid var(--border)`,
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  borderRadius: '0.375rem',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--accent)';
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--accent)';
                }}
              >
                {alert.actionLabel || 'View'}
              </button>
            )}

            {/* Snooze dropdown */}
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <button
                onClick={(e) => {
                  e.currentTarget.parentElement.querySelector('[data-snooze-menu]').style.display =
                    e.currentTarget.parentElement.querySelector('[data-snooze-menu]').style.display === 'none'
                      ? 'block'
                      : 'none';
                }}
                style={{
                  background: 'none',
                  border: `1px solid var(--border)`,
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  borderRadius: '0.375rem',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--hover-bg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                Snooze
              </button>
              <div
                data-snooze-menu
                style={{
                  display: 'none',
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  backgroundColor: 'var(--surface)',
                  border: `1px solid var(--border)`,
                  borderRadius: '0.375rem',
                  marginTop: '0.25rem',
                  minWidth: '100px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                  zIndex: 10,
                }}
              >
                {[1, 4, 8].map(hours => (
                  <button
                    key={hours}
                    onClick={(e) => {
                      handleSnoozeAlert(alert.id, hours, e);
                      e.currentTarget.parentElement.parentElement.querySelector('button').click();
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      border: 'none',
                      background: 'none',
                      color: 'var(--text)',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      textAlign: 'left',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--hover-bg)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {hours}h
                  </button>
                ))}
              </div>
            </div>

            {/* Dismiss button */}
            <button
              onClick={(e) => handleDismissAlert(alert.id, e)}
              style={{
                background: 'none',
                border: `1px solid var(--border)`,
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '0.375rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: 500,
                borderRadius: '0.375rem',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#fef2f2';
                e.currentTarget.style.borderColor = '#fee2e2';
                e.currentTarget.style.color = '#dc2626';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
              title="Dismiss this alert"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    );
  }
};

export default NotificationBell;
