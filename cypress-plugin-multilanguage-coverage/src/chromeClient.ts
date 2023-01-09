import CDP from 'chrome-remote-interface';

export class ChromeClient {
  /**
   * Holds the chrome remote interface client as a singleton.
   * @private
   */
  private static client?: CDP.Client;
  private static lastPort?: number;

  public static requestConnection(port: number) {
    let tries = 0;
    const maxTries = 100;
    const interval = 100;
    this.lastPort = port;
    if (this.client) {
      console.log('Chrome client already connected');
      return;
    }
    const intervalId = setInterval(async () => {
      try {
        await this.connect(port);
        clearInterval(intervalId);
      } catch (e) {
        console.log(`Could not connect to Chrome client: ${e}`);
        console.log(`Retrying in ${interval}ms`);
        console.log(`Tries: ${tries}`);
        if (tries >= maxTries) {
          clearInterval(intervalId);
          throw new Error(
            `Could not connect to Chrome Debugging Protocol on port ${port}`
          );
        }
        tries++;
      }
    }, interval);
  }

  public static restoreConnection() {
    if (this.lastPort) {
      this.requestConnection(this.lastPort);
    } else {
      throw new Error('No port to restore connection to');
    }
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
