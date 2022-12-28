# Coverage Git compare CLI
This is a small CLI tool to make use of the files generated by the [cypress-plugin-mulitlanguage-coverage](../cypress-plugin-multilanguage-coverage/README.md) plugin.   
It will compare the collected coverage with the git changes specified and show if changed files are covered by tests.

## Installation
```bash
npm install -D @heddendorp/coverage-git-compare
```

You can find the releases of the package on [GitHub](https://github.com/heddendorp/msc-thesis/pkgs/npm/coverage-git-compare).


## Usage
Make sure you have collected coverage data with the [cypress-plugin-mulitlanguage-coverage](../cypress-plugin-multilanguage-coverage/README.md) plugin before getting started.   
You can run the plugin with the following command:
```bash
npx coverage-git-compare compare
```
You can also specify a commit from which changes should be compared to the current state:
```bash
npx coverage-git-compare compare -c <commit>
```
_Ideally this is the commit where tests last passed_

## Limitations
There is currently no support for finind the last passing commit for a test automatically by checking build logs. Future versions of this package or additional packages could help with this issue.

## References
- TypeScript project setup by [DigitalOcean](https://www.digitalocean.com/community/tutorials/typescript-new-project)
- Building a CLI tool by [Jeroen Ouwehand](https://itnext.io/how-to-create-your-own-typescript-cli-with-node-js-1faf7095ef89)
- [gitlog library](https://www.npmjs.com/package/gitlog)
- Node.js with TypeScript in 2023 by [Beyond Fireship](https://www.youtube.com/watch?v=H91aqUHn8sE)