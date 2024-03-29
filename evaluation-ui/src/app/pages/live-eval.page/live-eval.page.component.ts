import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from '../../services/data.service';
import { map } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ChiSquaredComponent } from '../../components/chi-squared/chi-squared.component';

@Component({
  selector: 'app-live-eval.page',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, ChiSquaredComponent],
  templateUrl: './live-eval.page.component.html',
  styleUrls: ['./live-eval.page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiveEvalPageComponent {
  private dataService: DataService = inject(DataService);
  protected branches$ = this.dataService
    .getLiveData()
    .pipe(map((data) => data.branchData));
  protected testStats$ = this.dataService
    .getLiveData()
    .pipe(map((data) => data.flakyTestStats));

  protected regularRerunsOrFails$ = this.branches$.pipe(
    map((branches) =>
      branches.reduce(
        (acc, branch) =>
          acc +
          branch.results.filter((result) => {
            return !result.regularBuild.successful || result.regularBuild.label;
          }).length,
        0
      )
    )
  );

  protected flakyFails$ = this.branches$.pipe(
    map((branches) =>
      branches.reduce(
        (acc, branch) =>
          acc +
          branch.results.filter((result) => {
            return !result.flakyBuild.successful;
          }).length,
        0
      )
    )
  );

  protected totalBuilds$ = this.branches$.pipe(
    map((branches) =>
      branches.reduce((acc, branch) => acc + branch.results.length, 0)
    )
  );
  protected regularFailRate$ = this.branches$.pipe(
    map(
      (branches) =>
        (branches.reduce(
          (acc, branch) =>
            acc +
            branch.results.filter((result) => !result.regularBuild.successful)
              .length,
          0
        ) /
          branches.reduce((acc, branch) => acc + branch.results.length, 0)) *
        100
    )
  );
  protected flakyFailRate$ = this.branches$.pipe(
    map(
      (branches) =>
        (branches.reduce(
          (acc, branch) =>
            acc +
            branch.results.filter((result) => !result.flakyBuild.successful)
              .length,
          0
        ) /
          branches.reduce((acc, branch) => acc + branch.results.length, 0)) *
        100
    )
  );
  protected cypressRerunRate$ = this.branches$.pipe(
    map(
      (branches) =>
        (branches.reduce(
          (acc, branch) =>
            acc +
            branch.results.filter((result) => {
              return (
                result.regularBuild.successful && result.regularBuild.label
              );
            }).length,
          0
        ) /
          branches.reduce((acc, branch) => acc + branch.results.length, 0)) *
        100
    )
  );

  getFailMatch(result: {
    flakyTests: Array<{
      methodName: string;
      status: 'successful' | 'failed';
      successful: boolean;
    }>;
    regularTests: Array<{
      methodName: string;
      status: 'successful' | 'failed';
      successful: boolean;
    }>;
  }) {
    const regularFails = result.regularTests.filter((test) => !test.successful);
    const flakyFails = result.flakyTests.filter((test) => !test.successful);
    const regularMatchingFails = regularFails.filter((test) =>
      flakyFails.some((flakyTest) => flakyTest.methodName === test.methodName)
    );
    const flakyMatchingFails = flakyFails.filter((test) =>
      regularFails.some(
        (regularTest) => regularTest.methodName === test.methodName
      )
    );
    return (
      ((flakyMatchingFails.length + regularMatchingFails.length) /
        (regularFails.length + flakyFails.length)) *
      100
    );
  }
}
