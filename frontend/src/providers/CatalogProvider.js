'use client';
import { createContext, useContext, useMemo } from 'react';

const CatalogContext = createContext(null);

export function CatalogProvider({ catalog, children }) {
  const value = useMemo(() => ({
    ...catalog,
    featuredCities: catalog.cities.filter((city) => city.featured && city.crop),
    featuredStates: catalog.states.filter((state) => state.featured && state.crop),
    cityNames: catalog.cities.map((city) => city.name),
    stateNames: catalog.states.map((state) => state.name),
    findCourse: (id) => catalog.courses.find((course) => course.id === id),
  }), [catalog]);
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const value = useContext(CatalogContext);
  if (!value) throw new Error('useCatalog must be used inside CatalogProvider');
  return value;
}
