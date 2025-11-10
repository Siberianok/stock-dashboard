import React, { createContext, useContext, useMemo } from 'react';

const BasePathContext = createContext('/');

export const BrowserRouter = ({ basename = '/', children }) => {
  const normalizedBase = useMemo(() => {
    if (typeof basename !== 'string' || !basename) {
      return '/';
    }
    if (!basename.startsWith('/')) {
      return `/${basename}`;
    }
    return basename.endsWith('/') ? basename : `${basename}/`;
  }, [basename]);

  const value = useMemo(() => ({ basename: normalizedBase }), [normalizedBase]);

  return <BasePathContext.Provider value={value}>{children}</BasePathContext.Provider>;
};

export const useBasePath = () => {
  const context = useContext(BasePathContext);
  return context?.basename ?? '/';
};

export const withBasePath = (path) => {
  const base = import.meta.env.BASE_URL ?? '/';
  if (!path) return base;
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  return `${normalizedBase}${normalizedPath}`;
};
