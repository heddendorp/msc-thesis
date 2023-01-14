import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService, RunData } from '../../services/data.service';
import { map, Observable, tap } from 'rxjs';
import { groupBy, reduce } from 'lodash-es';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-overview.page',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, RouterLink],
  templateUrl: './overview.page.component.html',
  styleUrls: ['./overview.page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverviewPageComponent {
  public branchData$: Observable<
    {
      name: string;
      plans: {
        averageTime: number;
        branch: string;
        confirmedFlakes: number;
        fails: number;
        informationFiles: string[];
        isFlakeCheck: boolean;
        planKey: string;
        runningGoal: number;
        runs: Observable<RunData & { path: string }>[];
        saveLogs: boolean;
      }[];
    }[]
  >;
  constructor(private dataService: DataService) {
    this.branchData$ = dataService.getIndexData().pipe(
      map((data) =>
        reduce(
          groupBy(data, 'branch'),
          (result, value, key) => {
            result.push({ name: key, plans: value });
            return result;
          },
          [] as any[]
        )
      ),
      tap(console.log)
    );
  }
}
