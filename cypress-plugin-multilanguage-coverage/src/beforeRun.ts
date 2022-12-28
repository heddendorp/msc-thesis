import {Config} from './index';
import * as Cypress from 'cypress';
import BeforeRunDetails = Cypress.BeforeRunDetails;
import jetpack from 'fs-jetpack';
import path from 'path';
import AdmZip from 'adm-zip';

export function handleBeforeRun(config: Config) {
  return async (details: BeforeRunDetails) => {
    if (config.cleanCoverageFolder) {
      console.log('Cleaning coverage folder');
      jetpack.dir(path.join(config.workingDirectory, config.coverageFolder), {
        empty: true,
      });
    }
    if (config.distributionFile) {
      console.log('Extracting distribution file');
      console.log(
        'Distribution File',
        path.join(config.workingDirectory, config.distributionFile)
      );
      console.log(
        'Distribution file dir',
        path.join(config.workingDirectory, config.distributionFile, '..')
      );
      console.log(
        'Distribution file extraction dir',
        path.join(
          config.workingDirectory,
          config.distributionFile,
          '..',
          'extracted'
        )
      );
      jetpack.dir(
        path.join(
          config.workingDirectory,
          config.distributionFile,
          '..',
          'extracted'
        ),
        {
          empty: true,
        }
      );
      console.log('Extracting distribution file');
      const zip = new AdmZip(
        path.join(config.workingDirectory, config.distributionFile)
      );
      zip.extractAllTo(
        path.join(
          config.workingDirectory,
          config.distributionFile,
          '..',
          'extracted'
        )
      );
      console.log('Distribution file extracted');
    }
  };
}
