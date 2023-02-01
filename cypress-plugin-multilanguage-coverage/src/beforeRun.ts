import {Config} from './index';
import * as Cypress from 'cypress';
import BeforeRunDetails = Cypress.BeforeRunDetails;
import jetpack from 'fs-jetpack';
import path from 'path';
import AdmZip from 'adm-zip';

export function handleBeforeRun(config: Config) {
  return async (details: BeforeRunDetails) => {
    const startTime = Date.now();
    if (config.cleanCoverageFolder) {
      console.log('Cleaning coverage folder');
      jetpack.dir(path.join(config.workingDirectory, config.coverageFolder), {
        empty: true,
      });
    }
    if (config.distributionFileDir && config.distributionFilePattern) {
      console.log('Extracting distribution file');
      const filesInDistributionDir = jetpack.find(
        path.join(config.workingDirectory, config.distributionFileDir),
        {
          matching: config.distributionFilePattern,
        }
      );
      if (filesInDistributionDir.length === 0) {
        throw new Error(
          `No distribution file found in ${path.join(
            config.workingDirectory,
            config.distributionFileDir
          )} matching ${config.distributionFilePattern}`
        );
      }
      const distributionFile = filesInDistributionDir[0];
      console.log('Distribution File', distributionFile);
      console.log(
        'Distribution file dir',
        path.join(config.workingDirectory, config.distributionFileDir)
      );
      console.log(
        'Distribution file extraction dir',
        path.join(
          config.workingDirectory,
          config.distributionFileDir,
          'extracted'
        )
      );
      jetpack.dir(
        path.join(
          config.workingDirectory,
          config.distributionFileDir,
          'extracted'
        ),
        {
          empty: true,
        }
      );
      console.log('Running extraction');
      const zip = new AdmZip(distributionFile);
      zip.extractAllTo(
        path.join(
          config.workingDirectory,
          config.distributionFileDir,
          'extracted'
        )
      );
      console.log('Distribution file extracted');
      const endTime = Date.now();
      jetpack.append('times.txt', (endTime - startTime).toString());
      console.log('TIME_PASSED', endTime - startTime);
    }
  };
}
