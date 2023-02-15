import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, shareReplay } from 'rxjs';

export interface LiveDataBranch {
  name: string;
  flakyKey: string;
  regularKey: string;
  results: Array<{
    regularBuild: {
      key: string;
      label: string;
      state: string;
      startTime: string;
      completeTime: string;
      duration: number;
      queuedDuration: number;
      buildNumber: number;
      successful: boolean;
    };
    flakyBuild: {
      key: string;
      label: string;
      state: string;
      startTime: string;
      completeTime: string;
      duration: number;
      queuedDuration: number;
      buildNumber: number;
      successful: boolean;
    };
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
    combinedTests: Array<{
      methodName: string;
      flakyStatus: 'successful' | 'failed';
      regularStatus: 'successful' | 'failed';
      flakySuccessful: boolean;
      regularSuccessful: boolean;
    }>;
    flakyFailed: number[];
    regularFailed: number[];
    onlyRunInFlaky: number[];
    onlyRunInRegular: number[];
  }>;
}
export interface TestStat {
  test: string;
  total: number;
  successful: number;
  failed: number;
  flaky: number;
}
export interface LiveData {
  branchData: LiveDataBranch[];
  flakyTestStats: TestStat[];
}
export interface TestResult {
  testName: string;
  changedFiles: string[];
  coveredFileNum: number;
}

export interface Run {
  commit: string;
  commitNumber: string;
  changedFileNum: number;
  coverageFiles: string[];
  testResults: TestResult[];
  suspectedFlaky: boolean;
  exitCode: string;
  flag: string;
  lineCheck?: Omit<Run, 'changedFiles' | 'testResults'> & {
    changedFiles: { file: string; lines: number[] }[];
    testResults: Array<{
      testName: string;
      coveredFileNum: number;
      changedFiles: { file: string; lines: number[] }[];
      coveredLineNum: number;
    }>;
  };
}

export interface FlakeData {
  commit: string;
  path: string;
  limit: string;
  positiveRuns: number;
  allRunsPositive: boolean;
  runs: Run[];
}

export interface RunData {
  path: string;
  analyzedTestcases: number;
  analyzedTests: number;
  confirmedFlaky: boolean;
  failedBuild: boolean;
  flakeCheckIssue: boolean;
  chromeIssue: boolean;
  unshallowError: boolean;
  cypressMissing: boolean;
  coverageCompareVersion: string;
  cypressPluginVersion: string;
  flakeData?: FlakeData;
  hasRerun: boolean;
  runNumber: number;
  suspectedFlaky: boolean;
  testcases: string[];
  tests: string[];
  totalTime: number;
}

export interface PlanData {
  planKey: string;
  isFlakeCheck: boolean;
  runningGoal: number;
  saveLogs: boolean;
  branch: string;
  averageTime: number;
  confirmedFlakes: number;
  suspectedFlakes: number;
  reruns: number;
  fails: number;
  informationFiles: string[];
  buildConfig: {
    planKey: string;
    target: number;
    originalState: 'Failed' | 'Successful';
    lastSuccess: number;
  };
}

export interface IndexData {
  plans: PlanData[];
  branchConfig: any[];
  flakeCheckRuns: number;
  cypressRuns: number;
  flakyFails: number;
  regularFails: number;
  regularRerunsOrFails: number;
}

@Injectable({
  providedIn: 'root',
})
export class DataService {
  constructor(private httpClient: HttpClient) {}

  public getIndexData() {
    return this.httpClient.get<IndexData>('./data/json/index.json').pipe(
      map((data) => ({
        ...data,
        plans: data.plans.map((plan) => ({
          ...plan,
          runs: plan.informationFiles.map((file: string) =>
            this.httpClient
              .get<RunData>(file)
              .pipe(map((run) => ({ ...run, path: file })))
          ),
        })),
      }))
    );
  }

  public getRunData(file: string) {
    return this.httpClient.get<RunData>(file);
  }

  public getLiveData() {
    return this.httpClient
      .get<LiveData>('./data/live-data.json')
      .pipe(shareReplay(1));
  }
  public getCofigData() {
    return this.httpClient.get('./data/data.json');
  }
}
