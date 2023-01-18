import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, shareReplay } from 'rxjs';

export interface TestResult {
  testName: string;
  changedFiles: string[];
  coveredFiles: string[];
}

export interface Run {
  commit: string;
  commitNumber: string;
  changedFiles: string[];
  coverageFiles: string[];
  testResults: TestResult[];
  suspectedFlaky: boolean;
  exitCode: string;
  flag: string;
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
  analyzedTestcases: number;
  analyzedTests: number;
  confirmedFlaky: boolean;
  failedBuild: boolean;
  flakeCheckIssue: boolean;
  chromeIssue: boolean;
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

export interface IndexData {
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

@Injectable({
  providedIn: 'root',
})
export class DataService {
  constructor(private httpClient: HttpClient) {}

  public getIndexData() {
    return this.httpClient.get<IndexData[]>('./data/json/index.json').pipe(
      map((data) =>
        data.map((plan) => ({
          ...plan,
          runs: plan.informationFiles.map((file: string) =>
            this.httpClient
              .get<RunData>(file)
              .pipe(map((run) => ({ ...run, path: file })))
          ),
        }))
      ),
      shareReplay(1)
    );
  }

  public getRunData(file: string) {
    return this.httpClient.get<RunData>(file);
  }

  public getCofigData() {
    return this.httpClient.get('./data/data.json');
  }
}
