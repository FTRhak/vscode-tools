import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./shell/editor-page').then((m) => m.EditorPage),
  },
];
