'use client';
import { createContext, useContext, useMemo } from 'react';
import { busiestPlaces } from '@/features/home/placeCounts';

const CatalogContext = createContext(null);
// The landing city and state grids are six tiles wide.
const HOME_TILES = 6;

export function CatalogProvider({ catalog, children }) {
  const value = useMemo(() => ({
    ...catalog,
    // Tiles without a photo or artwork get a designed fallback, so only the count decides who shows.
    featuredCities: busiestPlaces(catalog.cities, HOME_TILES),
    featuredStates: busiestPlaces(catalog.states, HOME_TILES),
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
