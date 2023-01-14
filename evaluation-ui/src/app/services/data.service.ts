import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable, switchMap, tap } from 'rxjs';

export interface TestResult {
  testName: string;
  changedFiles: any[];
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

export interface RunData {
  commit: string;
  path: string;
  limit: string;
  runs: Run[];
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
            this.httpClient.get<RunData>(file)
          ),
        }))
      )
    );
  }

  public getCofigData() {
    return this.httpClient.get('./data/data.json');
  }
}
