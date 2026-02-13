import React from 'react';

export function Alert({ type = 'info', children }) {
  const styles = {
    info: {
      backgroundColor: '#e3f2fd',
      border: '1px solid #90caf9',
      borderRadius: '4px',
      padding: '12px 16px',
      marginBottom: '16px',
      color: '#1565c0',
    },
    success: {
      backgroundColor: '#e8f5e9',
      border: '1px solid #a5d6a7',
      borderRadius: '4px',
      padding: '12px 16px',
      marginBottom: '16px',
      color: '#2e7d32',
    },
    warning: {
      backgroundColor: '#fff3e0',
      border: '1px solid #ffcc80',
      borderRadius: '4px',
      padding: '12px 16px',
      marginBottom: '16px',
      color: '#ef6c00',
    },
    error: {
      backgroundColor: '#ffebee',
      border: '1px solid #ef9a9a',
      borderRadius: '4px',
      padding: '12px 16px',
      marginBottom: '16px',
      color: '#c62828',
    },
  };

  return <div style={styles[type] || styles.info}>{children}</div>;
}

export default Alert;
