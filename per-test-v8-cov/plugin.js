// @ts-check
const CDP = require("chrome-remote-interface");
const path = require("node:path");
const libCoverage = require("istanbul-lib-coverage");
const jetpack = require("fs-jetpack");
const v8toIstanbul = require("v8-to-istanbul");
const debug = require("debug")("heddendorp:v8-coverage");
let backend;
let frontend;
let frontendPort = 40500;
module.exports = (on, config) => {
  // debug("config", config);
  const repoRoot = config.repoRoot ?? config.projectRoot;
  const project = config.projectName ?? "n8n";
  on("before:browser:launch", (browser = {}, launchOptions) => {
    debug("browser is", browser.name);
    if (browser.name !== "chrome") {
      console.log(` Warning: An unsupported browser is used: ${browser.name}`);
      return launchOptions;
    }
    const rdpArgument = launchOptions.args.find((arg) =>
      arg.startsWith("--remote-debugging-port")
    );
    if (!rdpArgument) {
      console.log(
        "Could not find launch argument that starts with --remote-debugging-port"
      );
      return launchOptions;
    }
    frontendPort = parseInt(rdpArgument.split("=")[1]);
    debug("frontendPort", frontendPort);
    return launchOptions;
  });
  on("before:spec", async (spec) => {
    debug("V8_PER_TEST_COVERAGE_VERSION", require("./package.json").version);
    debug("starting coverage for", spec.fileName);
    try {
      backend = await CDP();
    } catch (e) {
      console.log(e);
    }
    try {
      frontend = await CDP({ port: frontendPort });
      debug("connected to frontend at port", frontendPort);
      frontend.Browser.getVersion().then((version) => {
        debug("frontend version", version);
      });
    } catch (e) {
      console.log(e);
    }
    if (backend && frontend) {
      await Promise.all([
        backend.Profiler.enable(),
        frontend.Profiler.enable(),
      ]);
      await Promise.all([
        backend.Profiler.startPreciseCoverage({ detailed: true }),
        frontend.Profiler.startPreciseCoverage({ detailed: true }),
      ]);
    } else {
      debug("no backend or frontend");
    }
  });
  on("after:spec", async (spec, results) => {
    if (!results.stats.failures) {
      debug("no failures, skipping coverage");
      await Promise.all([
        backend.Profiler.stopPreciseCoverage(),
        frontend.Profiler.stopPreciseCoverage(),
      ]);
      await Promise.all([
        backend.Profiler.disable(),
        frontend.Profiler.disable(),
      ]);
      await backend.close();
      await frontend.close();
      return;
    }
    if (backend && frontend) {
      debug("Taking coverage for", spec.fileName);
      const [backendCoverage, frontendCoverage] = await Promise.all([
        backend.Profiler.takePreciseCoverage(),
        frontend.Profiler.takePreciseCoverage(),
      ]);
      debug("stopping coverage for", spec.fileName);
      await Promise.all([
        backend.Profiler.stopPreciseCoverage(),
        frontend.Profiler.stopPreciseCoverage(),
      ]);
      await Promise.all([
        backend.Profiler.disable(),
        frontend.Profiler.disable(),
      ]);
      debug("closing inspectors for", spec.fileName);
      await backend.close();
      await frontend.close();
      debug("writing coverage for", spec.fileName);
      // jetpack.write(`coverage/${spec.fileName}.backend.json`, backendCoverage);
      // jetpack.write(
      //   `coverage/${spec.fileName}.frontend.json`,
      //   frontendCoverage
      // );
      // jetpack.write(
      //   `coverage/${spec.fileName}.backend-files.json`,
      //   backendCoverage.result.map((r) => r.url)
      // );
      // jetpack.write(
      //   `coverage/${spec.fileName}.frontend-files.json`,
      //   frontendCoverage.result.map((r) => r.url)
      // );

      const backendResults = backendCoverage.result
        .filter((r) => r.url.includes(".js"))
        .filter((r) => !r.url.includes("node_modules"))
        .map((r) => {
          if (project === "n8n") {
            return { ...r, url: r.url.slice(r.url.indexOf("n8n/n8n") + 8) };
          }
          return { ...r, url: r.url.slice(r.url.indexOf("Gladys") + 7) };
        });
      const frontendResults = frontendCoverage.result
        .filter((r) => r.url.includes(".js"))
        .filter((r) => !r.url.includes("node_modules"))
        .filter((r) => !r.url.includes("__"))
        .map((r) => {
          if (project === "n8n") {
            return {
              ...r,
              url: r.url.replace(
                "http://localhost:5678/",
                `packages/editor-ui/dist/`
              ),
            };
          }
          return {
            ...r,
            url: r.url.slice(r.url.indexOf("webpack-internal:///./") + 22),
          };
        });
      const map = libCoverage.createCoverageMap();

      for (const result of [...backendResults, ...frontendResults]) {
        const file = result.url;
        if (jetpack.exists(file)) {
          try {
            const converter = v8toIstanbul(file);
            await converter.load();
            converter.applyCoverage(result.functions);
            const fileCoverage = converter.toIstanbul();
            map.merge(fileCoverage);
          } catch (e) {
            debug("error", e);
            debug("file", file);
          }
        } else {
          debug("file not found", file);
        }
      }

      // jetpack.write(
      //   path.join(repoRoot, "coverage", `${spec.fileName}-merged.json`),
      //   map
      // );
      const filesWithLineCoverage = map
        .files()
        .map((file) => {
          const fileCoverage = map.fileCoverageFor(file);
          const lines = fileCoverage.getLineCoverage();
          const linesWithCoverage = Object.keys(lines)
            .filter((line) => lines[line] > 0)
            .map(Number);
          return {
            file: file.slice(repoRoot.length + 1),
            lines: linesWithCoverage,
          };
        })
        .filter((f) => f.lines.length > 0)
        .filter((f) => !f.file.includes("node_modules"));
      const coveredFiles = filesWithLineCoverage.map((f) => f.file);
      jetpack.write(
        path.join(repoRoot, "coverage", `${spec.fileName}.lines.json`),
        filesWithLineCoverage
      );
      jetpack.write(
        path.join(repoRoot, "coverage", `${spec.fileName}.files.json`),
        coveredFiles
      );
    } else {
      debug("no backend or frontend");
    }
  });
};
