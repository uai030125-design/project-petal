import React, { createContext, useContext, useState, useCallback } from 'react';

const CRMContext = createContext();

export function CRMProvider({ children }) {
  // Shared reads state keyed by "company::po::style"
  const [readsData, setReadsData] = useState({});

  const updateReads = useCallback((key, value) => {
    setReadsData(prev => ({ ...prev, [key]: value }));
  }, []);

  return (
    <CRMContext.Provider value={{ readsData, updateReads }}>
      {children}
    </CRMContext.Provider>
  );
}

export function useCRM() {
  const ctx = useContext(CRMContext);
  if (!ctx) throw new Error('useCRM must be inside CRMProvider');
  return ctx;
}
