'use client';
import { createContext, useContext, useMemo } from 'react';

const ContentContext = createContext({});

// Site content loaded on the server (lib/api/content.js). Nested providers add page-specific
// keys on top of the shared ones from the (site) layout. A null value means "unavailable".
export function ContentProvider({ content, children }) {
  const parent = useContext(ContentContext);
  const value = useMemo(() => ({ ...parent, ...content }), [parent, content]);
  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

export function useContent(key) {
  return useContext(ContentContext)[key] ?? null;
}
