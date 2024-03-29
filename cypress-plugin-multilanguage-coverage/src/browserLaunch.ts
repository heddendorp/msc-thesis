import * as Cypress from 'cypress';
import {Config} from './index';
import {ChromeClient} from './chromeClient';
import BrowserLaunchOptions = Cypress.BrowserLaunchOptions;
import PluginConfigOptions = Cypress.PluginConfigOptions;
import jetpack from 'fs-jetpack';

export function handleBeforeBrowserLaunch(
  config: Config,
  cypressConfig: PluginConfigOptions
) {
  return async (
    browser: Cypress.Browser,
    launchOptions: Cypress.BrowserLaunchOptions
  ): Promise<BrowserLaunchOptions> => {
    const startTime = Date.now();
    console.log('browser is', browser.name);
    if (browser.name !== 'chrome') {
      console.log(
        ` Warning: An unsupported browser is used, output will not be logged to console: ${browser.name}`
      );
      return launchOptions;
    }
    // find the port cypress will use to control the browser
    const rdpArgument = launchOptions.args.find((arg: string) =>
      arg.startsWith('--remote-debugging-port')
    );
    if (!rdpArgument) {
      console.log(
        'Could not find launch argument that starts with --remote-debugging-port'
      );
      return launchOptions;
    }
    const rdp = parseInt(rdpArgument.split('=')[1]);
    ChromeClient.setPort(rdp);
    const cypressVersion = Number(cypressConfig.version.split('.')[0]);
    if (cypressVersion < 10) {
      console.log('Starting chrome coverage for cypress version <10');
      void ChromeClient.startCoverage();
    }
    const endTime = Date.now();
    jetpack.append('times.txt', (endTime - startTime).toString());
    console.log('TIME_PASSED', endTime - startTime);
    launchOptions.args.push('--lang=en');
    return launchOptions;
  };
}
