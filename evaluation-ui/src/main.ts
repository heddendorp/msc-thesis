import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { provideRouter } from '@angular/router';
import { appRoutes } from './app/app-routes';
import { provideHttpClient } from '@angular/common/http';
import { DataService } from './app/services/data.service';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { importProvidersFrom } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(appRoutes),
    provideHttpClient(),
    { provide: DataService, useClass: DataService },
    importProvidersFrom(BrowserAnimationsModule),
    importProvidersFrom(MatIconModule),
  ],
});
