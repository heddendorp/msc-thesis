import { Routes } from '@angular/router';
import { OverviewPageComponent } from './pages/overview.page/overview.page.component';
import { RunPageComponent } from './pages/run-page/run-page.component';
import { LiveEvalPageComponent } from './pages/live-eval.page/live-eval.page.component';

export const appRoutes: Routes = [
  { path: '', redirectTo: 'overview', pathMatch: 'full' },
  { path: 'overview', component: OverviewPageComponent },
  { path: 'live', component: LiveEvalPageComponent },
  { path: 'run', component: RunPageComponent },
];
