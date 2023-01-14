import CDP from 'chrome-remote-interface';

export class ChromeClient {
  /**
   * Holds the chrome remote interface client as a singleton.
   * @private
   */
  private static client?: CDP.Client;
  private static chromePort?: number;

  public static setPort(port: number) {
    this.chromePort = port;
  }

  public static async startCoverage() {
    if (!this.chromePort) {
      console.log('No port to start coverage on');
      throw new Error('No port to start coverage on');
    }
    let tries = 0;
    const maxTries = 100;
    const interval = 100;
    if (this.client) {
      console.log('Chrome client already connected');
      return;
    }
    while (tries < maxTries) {
      try {
        await this.connect(this.chromePort);
        break;
      } catch (e) {
        console.log(`Connection to Chrome failed, retrying in ${interval}ms`);
        tries++;
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
    if (tries >= maxTries) {
      console.log('Could not connect to Chrome');
      throw new Error('Could not connect to Chrome');
    }
    console.log('Chrome client coverage started');
  }

  public static async connect(port: number): Promise<void> {
    this.client = await CDP({port});
    console.log(`Connected to Chrome Debugging Protocol on port ${port}`);
    this.client.on('disconnect', () => {
      console.log('Chrome client disconnected');
      this.client = undefined;
    });
    await this.client.Profiler.enable();
    await this.client.Profiler.startPreciseCoverage({
      callCount: true,
      detailed: true,
    });
  }

  public static async get(): Promise<CDP.Client> {
    if (!this.client) {
      throw new Error('Chrome client not connected');
    }
    return this.client;
  }
}
