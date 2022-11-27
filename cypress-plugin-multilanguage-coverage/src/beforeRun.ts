import {Config} from "./index";
import * as Cypress from "cypress";
import BeforeRunDetails = Cypress.BeforeRunDetails;
import jetpack from 'fs-jetpack';
import path from 'path';

export function handleBeforeRun(config: Config){
  return async(details: BeforeRunDetails)=>{
    if(config.cleanCoverageFolder){
      console.log('Cleaning coverage folder');
      jetpack.dir(
        path.join(config.workingDirectory, config.coverageFolder),
        {empty: true}
      );
    }
  }
}
