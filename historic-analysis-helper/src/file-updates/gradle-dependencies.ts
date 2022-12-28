import jetpack from 'fs-jetpack';

const insertionMarker = `
dependencies {`;
export const updateGradleDependencies = () => {
  const buildGradleContent = jetpack.read('build.gradle', 'utf8');
  const dependenciesIndex = buildGradleContent.indexOf(insertionMarker)+ insertionMarker.length;
  // add jacoco dependency in line after dependencies {
  const jacocoDependency = `
    implementation "org.jacoco:org.jacoco.agent:0.8.8"`;
  const newBuildGradleContent = buildGradleContent.slice(0, dependenciesIndex) + jacocoDependency + buildGradleContent.slice(dependenciesIndex);
  jetpack.write('build.gradle', newBuildGradleContent);
}
