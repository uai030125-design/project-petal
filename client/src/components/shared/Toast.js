import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext();

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();

    const newToast = { id, message, type };
    setToasts(prev => [...prev, newToast]);

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);

    return id;
  }, []);

  const toast = {
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error'),
    info: (msg) => addToast(msg, 'info'),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} setToasts={setToasts} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

function ToastContainer({ toasts, setToasts }) {
  const handleDismiss = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, pointerEvents: 'none' }}>
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          toast={toast}
          onDismiss={() => handleDismiss(toast.id)}
        />
      ))}
    </div>
  );
}

function Toast({ toast, onDismiss }) {
  const [isExiting, setIsExiting] = useState(false);

  const handleClick = () => {
    setIsExiting(true);
    setTimeout(() => onDismiss(), 200);
  };

  const getColors = () => {
    switch (toast.type) {
      case 'success':
        return {
          bg: 'rgba(94, 154, 108, 0.1)',
          border: 'var(--success)',
          text: 'var(--success)',
        };
      case 'error':
        return {
          bg: 'rgba(196, 80, 80, 0.1)',
          border: 'var(--danger)',
          text: 'var(--danger)',
        };
      case 'info':
      default:
        return {
          bg: 'rgba(45, 74, 52, 0.1)',
          border: 'var(--accent)',
          text: 'var(--accent)',
        };
    }
  };

  const colors = getColors();

  return (
    <div
      style={{
        pointerEvents: 'auto',
        marginTop: 12,
        animation: isExiting ? 'toastSlideOut 0.2s ease forwards' : 'toastSlideIn 0.3s ease forwards',
      }}
      onClick={handleClick}
    >
      <div
        style={{
          background: colors.bg,
          border: `1px solid ${colors.border}`,
          borderRadius: 'var(--radius-sm)',
          padding: '14px 16px',
          fontSize: 14,
          fontWeight: 500,
          color: colors.text,
          cursor: 'pointer',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          minWidth: 240,
          maxWidth: 360,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <span>{getIcon(toast.type)}</span>
        <span style={{ flex: 1 }}>{toast.message}</span>
      </div>

      <style>{`
        @keyframes toastSlideIn {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes toastSlideOut {
          from {
            opacity: 1;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            transform: translateY(16px);
          }
        }
      `}</style>
    </div>
  );
}

function getIcon(type) {
  switch (type) {
    case 'success':
      return '✓';
    case 'error':
      return '✕';
    case 'info':
    default:
      return 'ℹ';
  }
}
