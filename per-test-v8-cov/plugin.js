// @ts-check
const CDP = require("chrome-remote-interface");
const path = require("node:path");
const libCoverage = require("istanbul-lib-coverage");
const jetpack = require("fs-jetpack");
const v8toIstanbul = require("v8-to-istanbul");
const debug = require("debug")("heddendorp:v8-coverage");
let backend;
let frontend;
module.exports = (on, config) => {
  debug(config);
  const repoRoot = config.repoRoot;
  on("before:spec", async (spec) => {
    console.log("starting coverage for", spec.fileName);
    try {
      backend = await CDP();
    } catch (e) {
      console.log(e);
    }
    try {
      frontend = await CDP({ port: 40500 });
    } catch (e) {
      console.log(e);
    }
    if (backend && frontend) {
      await Promise.all([
        backend.Profiler.enable(),
        backend.Profiler.startPreciseCoverage({
          callCount: true,
          detailed: true,
        }),
        frontend.Profiler.enable(),
        frontend.Profiler.startPreciseCoverage({
          callCount: true,
          detailed: true,
        }),
      ]);
    } else {
      console.log("no backend or frontend");
    }
  });
  on("after:spec", async (spec,results) => {
    if(!results.stats.failures){
        console.log("no failures, skipping coverage");
        await Promise.all([
            backend.Profiler.stopPreciseCoverage(),
            backend.Profiler.disable(),
            frontend.Profiler.stopPreciseCoverage(),
            frontend.Profiler.disable(),
          ]);
          await backend.close();
          await frontend.close();
        return;
    }
    if (backend && frontend) {
      const [backendCoverage, frontendCoverage] = await Promise.all([
        backend.Profiler.takePreciseCoverage(),
        frontend.Profiler.takePreciseCoverage(),
      ]);
      await Promise.all([
        backend.Profiler.stopPreciseCoverage(),
        backend.Profiler.disable(),
        frontend.Profiler.stopPreciseCoverage(),
        frontend.Profiler.disable(),
      ]);
      await backend.close();
      await frontend.close();
      const backendResults = backendCoverage.result
        .filter((r) => r.url.includes(".js"))
        .filter((r) => !r.url.includes("node_modules"))
        .map((r) => ({ ...r, url: r.url.slice(r.url.indexOf("Gladys") + 7) }));
      const frontendResults = frontendCoverage.result
        .filter((r) => r.url.includes(".js"))
        .filter((r) => !r.url.includes("node_modules"))
        .filter((r) => !r.url.includes("__"))
        .map((r) => ({
          ...r,
          url: r.url.slice(r.url.indexOf("webpack-internal:///./") + 22),
        }));
      debug(config);
      const map = libCoverage.createCoverageMap();
      const backendInfo = await Promise.all(
        backendResults.map(async (r) => {
          const file = path.join(repoRoot, r.url);

          if (jetpack.exists(file)) {
            const converter = v8toIstanbul(file);
            await converter.load();
            converter.applyCoverage(r.functions);
            const fileCoverage = converter.toIstanbul();
            map.merge(fileCoverage);
            return fileCoverage;
          } else {
            console.log("file not found", file);
          }
        })
      );
      const frontendInfo = await Promise.all(
        frontendResults.map(async (r) => {
          const file = path.join(repoRoot, "front", r.url.includes('server')?'':'src', r.url);
          if (jetpack.exists(file)) {
            const converter = v8toIstanbul(file);
            await converter.load();
            converter.applyCoverage(r.functions);
            const fileCoverage = converter.toIstanbul();
            map.merge(fileCoverage);
            return fileCoverage;
          } else {
            console.log("file not found", file);
          }
        })
      );
      const filesWithLineCoverage = map.files().map((file) => {
        const fileCoverage = map.fileCoverageFor(file);
        const lines = fileCoverage.getLineCoverage();
        const linesWithCoverage = Object.keys(lines).filter(
          (line) => lines[line] > 0
        ).map(Number);
        return {
          file: file.slice(repoRoot.length + 1),
          lines: linesWithCoverage,
        };
      });
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
      console.log("no backend or frontend");
    }
  });
};
