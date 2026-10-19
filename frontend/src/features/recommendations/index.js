// Public surface of the recommendations feature.
//   <RecommendedUniversities />  the card rail (client component; safe inside a server page)
//   <TrackEvent event={…} />     fire one activity event from a server page
//   useTracking()                the hook for interactive tracking (re-exported from the provider)
export { default as RecommendedUniversities } from './RecommendedUniversities';
export { default as TrackEvent } from './TrackEvent';
export { TrackingProvider, useTracking } from '@/providers/TrackingProvider';
