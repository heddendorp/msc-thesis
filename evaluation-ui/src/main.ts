import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { provideRouter } from '@angular/router';
import { appRoutes } from './app/app-routes';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { DataService } from './app/services/data.service';

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(appRoutes),
    provideHttpClient(),
    { provide: DataService, useClass: DataService },
  ],
});
