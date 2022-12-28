import jetpack from 'fs-jetpack';

export const updatePackageScripts = (commit:string) => {
  const testPath = 'src/test/cypress';
  const packageContent = jetpack.read(`${testPath}/package.json`, 'json');
  const scripts = packageContent.scripts;
  const newScripts = {
    ...scripts,
    "detect:flakies": `coverage-git-compare compare -c ${commit}`
  }
  const newPackageContent = {
    ...packageContent,
    scripts: newScripts
  }
  jetpack.write(`${testPath}/package.json`, newPackageContent,{jsonIndent:4});
}
