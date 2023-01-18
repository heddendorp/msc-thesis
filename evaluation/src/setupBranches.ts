import * as dotenv from "dotenv";
dotenv.config();
import { execSync } from "child_process";
import { resolve } from "path";
import jetpack from "fs-jetpack";

const branchPrefix = "historic";
const helperVersion = "latest";

async function branchExists(branchName: string): Promise<boolean> {
  try {
    execSync(`cd ../../Artemis && git rev-parse --verify ${branchName}`, {
      stdio: "ignore",
    });
    return true;
  } catch (error) {
    return false;
  }
}

async function run() {
  const data = jetpack.read("./data/data.json", "json");
  const branches = data.branches;
  for (const buildConfig of data.analyzedBuilds) {
    console.log(`Checking branch for ${buildConfig.target}...`);
    const branchName = `${branchPrefix}/build-${buildConfig.target}`;
    const branch = await branchExists(branchName);
    if (branch) {
      console.log(`Branch ${branchName} exists`);
      continue;
    }
    console.log(`Branch ${branchName} does not exist`);
    const artemisDir = resolve("../../Artemis");
    console.log(`Running historic-analysis-helper in ${artemisDir}`);
    // console.log(
    //   `npx -y @heddendorp/historic-analysis-helper@${helperVersion} branch ${buildConfig.planKey} ${buildConfig.lastSuccess} ${buildConfig.target} -t ${process.env.BAMBOO_TOKEN} -p ${branchPrefix}`
    // );
    execSync(
      `npx -y @heddendorp/historic-analysis-helper@${helperVersion} branch ${buildConfig.planKey} ${buildConfig.lastSuccess} ${buildConfig.target} -t ${process.env.BAMBOO_TOKEN} -p ${branchPrefix} -l`,
      { cwd: artemisDir }
    );
    console.log(`Branch ${branchName} created`);
    branches.push({
      branchName,
    });
  }
  // sort analyzedBuilds by target
  const analyzedBuilds = data.analyzedBuilds;
  analyzedBuilds.sort((a, b) => {
    return Number(a.target) - Number(b.target);
  });
  // sort branches by branchName
  branches.sort((a, b) => {
    return a.branchName.localeCompare(b.branchName);
  });
  jetpack.write("./data/data.json", { ...data, branches, analyzedBuilds });
}

run();
