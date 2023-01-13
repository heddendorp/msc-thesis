import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [CommonModule, RouterOutlet],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private iconRegistry = inject(MatIconRegistry);
  private sanitizer = inject(DomSanitizer);
  constructor() {
    this.iconRegistry.addSvgIconSet(
      this.sanitizer.bypassSecurityTrustResourceUrl(
        './assets/svg/thesis.min.svg'
      )
    );
  }
}
