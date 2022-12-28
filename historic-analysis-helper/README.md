# Historic Analysis helper
This is a small CLI tool to set up branches with the [cypress-plugin-mulitlanguage-coverage](../cypress-plugin-multilanguage-coverage/README.md) plugin.   
It will create a new branch based on a bamboo build and add all dependencies for flaky test detection.

## Installation
```bash
npm install -D @heddendorp/historic-analysis-helper
```

You can find the releases of the package on [npm](https://www.npmjs.com/package/@heddendorp/historic-analysis-helper).


## Usage
Currently, this tool is only useful for [Artemis](https://github.com/ls1intum/Artemis) you can create a new branch for analysis like this: 
```bash
npx @heddendorp/historic-analysis-helper branch <planKey> <latestSuccess> <analyzedRun> -t <bambooToken>
```
## References
- Building a CLI tool by [Jeroen Ouwehand](https://itnext.io/how-to-create-your-own-typescript-cli-with-node-js-1faf7095ef89)
- Node.js with TypeScript in 2023 by [Beyond Fireship](https://www.youtube.com/watch?v=H91aqUHn8sE)
