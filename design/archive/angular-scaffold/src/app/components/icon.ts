import { Component, input } from '@angular/core';

const paths: Record<string, string> = {
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  search: 'M21 21l-5-5M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
  location: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
  book: 'M12 5v16M3 3h5a4 4 0 0 1 4 2 4 4 0 0 1 4-2h5v17h-5a4 4 0 0 0-4 1 4 4 0 0 0-4-1H3Z',
  cap: 'm2 8 10-5 10 5-10 5-10-5Zm4 2v7c4 3 8 3 12 0v-7m4-2v8',
  compare: 'M5 20V10m7 10V4m7 16v-8',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'm6 6 12 12M18 6 6 18',
  check: 'm5 12 4 4L19 6',
  chevron: 'm6 9 6 6 6-6',
  calendar: 'M8 2v4m8-4v4M3 10h18M3 4h18v17H3Z',
  spark: 'm12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z',
  compass: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-5-4-3 5-5 3 3-5 5-3Z',
  leaf: 'M20 3C7 2 3 7 4 15c9 8 17-1 16-12ZM4 21 16 8',
};

@Component({
  selector: 'ns-icon',
  template: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path [attr.d]="path" /></svg>',
  styles: [':host { display: inline-flex; width: 20px; height: 20px; flex-shrink: 0; } svg { width: 100%; height: 100%; }'],
})
export class IconComponent {
  name = input('arrow');
  get path() { return paths[this.name()] ?? paths['arrow']; }
}
