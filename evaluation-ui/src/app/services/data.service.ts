import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  constructor(private httpClient: HttpClient) {}

  public getIndexData() {
    return this.httpClient.get('./data/json/index.json');
  }

  public getCofigData() {
    return this.httpClient.get('./data/data.json');
  }
}
