import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable, switchMap, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  constructor(private httpClient: HttpClient) {}

  public getIndexData() {
    return this.httpClient.get('./data/json/index.json').pipe(
      map((data: any) =>
        data.map((plan: any) => ({
          ...plan,
          runs: plan.informationFiles.map((file: string) =>
            this.httpClient.get(file)
          ),
        }))
      )
    );
  }

  public getCofigData() {
    return this.httpClient.get('./data/data.json');
  }
}
