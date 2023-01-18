import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { switchMap, tap } from 'rxjs';
import { DataService } from '../../services/data.service';
import { MatButtonModule } from '@angular/material/button';
import { FlakeDataDisplayComponent } from '../../components/flake-data-display/flake-data-display.component';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-run-page',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    FlakeDataDisplayComponent,
  ],
  templateUrl: './run-page.component.html',
  styleUrls: ['./run-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RunPageComponent {
  private route = inject(ActivatedRoute);
  private dataService = inject(DataService);
  public runData$ = this.route.queryParams.pipe(
    switchMap((params) => this.dataService.getRunData(params['file'])),
    tap(console.log)
  );
}
