import jetpack from 'fs-jetpack';

const insertionMarker = `
dependencies {`;
const bambooUpdateMarker = `implementation "com.atlassian.bamboo:bamboo-specs:8.2.5"`;
const bambooUpdate = `implementation "com.atlassian.bamboo:bamboo-specs:9.2.1"
    implementation ("org.yaml:snakeyaml") {
        version {
            strictly "1.33" // needed for Bamboo-specs and to reduce the number of vulnerabilities, also see https://mvnrepository.com/artifact/org.yaml/snakeyaml
        }
    }

`;
export const updateGradleDependencies = () => {
  const buildGradleContent = jetpack.read('build.gradle', 'utf8');
  const dependenciesIndex =
    buildGradleContent.indexOf(insertionMarker) + insertionMarker.length;
  // add jacoco dependency in line after dependencies {
  const jacocoDependency = `
    implementation "org.jacoco:org.jacoco.agent:0.8.8"`;
  const newBuildGradleContent =
    buildGradleContent.slice(0, dependenciesIndex) +
    jacocoDependency +
    buildGradleContent.slice(dependenciesIndex);
  // add bamboo-specs dependency in line after jacoco dependency
  const bambooIndex = newBuildGradleContent.indexOf(bambooUpdateMarker);
  const newBuildGradleContent2 =
    newBuildGradleContent.slice(0, bambooIndex) +
    bambooUpdate +
    newBuildGradleContent.slice(bambooIndex + bambooUpdateMarker.length);
  jetpack.write('build.gradle', newBuildGradleContent2);
};
