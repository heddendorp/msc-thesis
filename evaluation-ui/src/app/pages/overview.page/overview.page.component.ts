import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  DataService,
  IndexData,
  PlanData,
  RunData,
} from '../../services/data.service';
import { map, Observable, tap } from 'rxjs';
import { groupBy, reduce } from 'lodash-es';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { MediaMatcher } from '@angular/cdk/layout';

@Component({
  selector: 'app-overview.page',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, RouterLink],
  templateUrl: './overview.page.component.html',
  styleUrls: ['./overview.page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverviewPageComponent implements OnDestroy {
  public data$: Observable<
    IndexData & {
      branches: {
        name: string;
        plans: Array<PlanData & { runs: Observable<RunData>[] }>;
      }[];
    }
  >;
  mobileQuery: MediaQueryList;
  private _mobileQueryListener: () => void;
  constructor(
    private dataService: DataService,
    changeDetectorRef: ChangeDetectorRef,
    media: MediaMatcher
  ) {
    this.data$ = dataService.getIndexData().pipe(
      map(
        (data) => ({
          ...data,
          branches: reduce(
            groupBy(data.plans, 'branch'),
            (result, value, key) => {
              result.push({ name: key, plans: value });
              return result;
            },
            [] as any[]
          ),
        }),
        tap(console.log)
      )
    );
    this.mobileQuery = media.matchMedia('(max-width: 600px)');
    this._mobileQueryListener = () => changeDetectorRef.detectChanges();
    this.mobileQuery.addListener(this._mobileQueryListener);
  }
  ngOnDestroy(): void {
    this.mobileQuery.removeListener(this._mobileQueryListener);
  }
}
