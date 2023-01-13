import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from '../../services/data.service';
import { map, Observable, tap } from 'rxjs';
import { groupBy, reduce } from 'lodash-es';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-overview.page',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
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
        runs: Observable<{
          runNumber: number;
          analyzedTestcases: number;
          failedBuild: boolean;
          hasRerun: boolean;
          suspectedFlaky: boolean;
          confirmedFlaky: boolean;
          flakeCheckIssue: boolean;
          totalTime: number;
        }>[];
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
