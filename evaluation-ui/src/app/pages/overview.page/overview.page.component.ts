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
import { combineLatest, map, Observable, startWith, tap } from 'rxjs';
import { groupBy, reduce } from 'lodash-es';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import {
  ActivatedRoute,
  ActivatedRouteSnapshot,
  Router,
  RouterLink,
} from '@angular/router';
import { MediaMatcher } from '@angular/cdk/layout';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ChiSquaredComponent } from '../../components/chi-squared/chi-squared.component';
@Component({
  selector: 'app-overview.page',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    RouterLink,
    ReactiveFormsModule,
    ChiSquaredComponent,
  ],
  templateUrl: './overview.page.component.html',
  styleUrls: ['./overview.page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverviewPageComponent implements OnDestroy {
  public branchFilterControl = new FormControl<string>('', {
    nonNullable: true,
  });
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
  private _filterSubscription;
  constructor(
    private dataService: DataService,
    changeDetectorRef: ChangeDetectorRef,
    media: MediaMatcher,
    route: ActivatedRoute,
    router: Router
  ) {
    this.data$ = combineLatest([
      dataService.getIndexData().pipe(
        map((data) => ({
          ...data,
          branches: reduce(
            groupBy(data.plans, 'branch'),
            (result, value, key) => {
              result.push({ name: key, plans: value });
              return result;
            },
            [] as any[]
          ),
        }))
      ),
      this.branchFilterControl.valueChanges.pipe(
        startWith(route.snapshot.queryParams['branch'] || ''),
        map((branch) => branch.toLowerCase())
      ),
    ]).pipe(
      map(([data, branchFilter]) => ({
        ...data,
        branches: data.branches.filter((branch: any) =>
          branch.name.toLowerCase().includes(branchFilter)
        ),
      }))
    );
    this.branchFilterControl.setValue(
      route.snapshot.queryParams['branch'] || ''
    );
    this._filterSubscription = this.branchFilterControl.valueChanges.subscribe(
      (value) => {
        void router.navigate([], {
          relativeTo: route,
          queryParams: { branch: value },
          queryParamsHandling: 'merge',
        });
      }
    );
    this.mobileQuery = media.matchMedia('(max-width: 600px)');
    this._mobileQueryListener = () => changeDetectorRef.detectChanges();
    this.mobileQuery.addListener(this._mobileQueryListener);
  }
  ngOnDestroy(): void {
    this.mobileQuery.removeListener(this._mobileQueryListener);
    this._filterSubscription.unsubscribe();
  }
}
