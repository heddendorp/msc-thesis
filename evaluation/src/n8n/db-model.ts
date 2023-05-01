import lodash from "lodash";
import { Low } from "lowdb";

export type Data = {
    baseLine: {
      commits: {
        flaky: boolean;
        sha: string;
        parent: string;
        branch: string;
        successful: boolean;
        runs: {
          id: number;
          conclusion: string;
          installDuration: number;
          testDuration: number;
          installConclusion: string;
          testConclusion: string;
        }[];
      }[];
    };
    timings: {
      runs: {
        id: number;
        conclusion: string;
        installDuration: number;
        testDuration: number;
        installConclusion: string;
        testConclusion: string;
        sha: string;
        passed: boolean;
        passedInstrumented: boolean;
      }[];
      testcases: {
        name: string;
        averageDuration: number;
        averageDurationInstrumented: number;
        results: {
          passed: number;
          failed: number;
          skipped: number;
        };
        resultsInstrumented: {
          passed: number;
          failed: number;
          skipped: number;
        };
      }[];
    };
    candidates: {
      sha: string;
      branch: string;
      firstSuccessfulParent: string;
      failingTestcases: string[];
    }[];
    results: {}[];
    prs: {
      number: number;
      name: string;
      state: string;
      merged: boolean;
      commits: {
        sha: string;
        parent: string;
      }[];
    }[];
  };

  export class LowWithLodash<T> extends Low<T> {
    chain: lodash.ExpChain<this["data"]> = lodash.chain(this).get("data");
  }