import React from 'react';

export default function PageHeader({ title, children }) {
  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <h1 style={styles.title}>{title}</h1>
      </div>
      {children && <div style={styles.children}>{children}</div>}
      <style>{`
        ${Object.entries(styles).map(([key, obj]) => {
          if (typeof obj === 'object' && !Array.isArray(obj)) {
            return '';
          }
        }).join('')}
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 16,
    marginBottom: 24,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: 700,
    fontFamily: 'inherit',
    color: 'var(--text)',
    margin: 0,
    letterSpacing: '-0.3px',
  },
  subtitle: {
    fontSize: 13,
    color: 'var(--text-muted)',
    margin: '8px 0 0 0',
    fontWeight: 400,
  },
  children: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
};
