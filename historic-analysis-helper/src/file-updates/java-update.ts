import jetpack from 'fs-jetpack';

const insertionMarker = `return Math.toIntExact(ChronoUnit.SECONDS.between(from, to));`;
const replacement = `int durationInSecond = Math.toIntExact(ChronoUnit.SECONDS.between(from, to));
      // limit the data type to avoid database exceptions
      return Math.max(0, Math.min(durationInSecond, 65535));`;
const file = `src/main/java/de/tum/in/www1/artemis/domain/statistics/BuildLogStatisticsEntry.java`;

export const updateJavaFile = () => {
  const fileContent = jetpack.read(file, 'utf8');
  const newFileContent = fileContent.replace(insertionMarker, replacement);
  jetpack.write(file, newFileContent);
};
