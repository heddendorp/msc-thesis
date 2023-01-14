import { Routes } from '@angular/router';
import { OverviewPageComponent } from './pages/overview.page/overview.page.component';
import { RunPageComponent } from './pages/run-page/run-page.component';

export const appRoutes: Routes = [
  { path: '', component: OverviewPageComponent },
  { path: 'run', component: RunPageComponent },
];
