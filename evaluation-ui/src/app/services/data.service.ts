import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, shareReplay, tap } from 'rxjs';

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
  fails: number;
  informationFiles: string[];
}

export interface IndexData {
  plans: PlanData[];
  branchConfig: any[];
  flakeCheckRuns: number;
  cypressRuns: number;
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

  public getCofigData() {
    return this.httpClient.get('./data/data.json');
  }
}
