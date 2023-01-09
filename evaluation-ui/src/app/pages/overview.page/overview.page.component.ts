import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from '../../services/data.service';
import { map, Observable, tap } from 'rxjs';
import { groupBy, reduce } from 'lodash-es';

@Component({
  selector: 'app-overview.page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './overview.page.component.html',
  styleUrls: ['./overview.page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverviewPageComponent {
  public branchData$: Observable<any[]>;
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
