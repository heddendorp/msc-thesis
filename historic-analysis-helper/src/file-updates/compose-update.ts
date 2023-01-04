import jetpack from 'fs-jetpack';

const insertionMarker = `npm run cypress:run`;
export const updateComposeFile = () => {
  const composeContent = jetpack.read(
    'src/main/docker/cypress/docker-compose.yml',
    'utf8'
  );
  const cypressRunIndex =
    composeContent.indexOf(insertionMarker) + insertionMarker.length;
  const rerunConfig = ` -- --config retries=2`;
  const newComposeContent =
    composeContent.slice(0, cypressRunIndex) +
    rerunConfig +
    composeContent.slice(cypressRunIndex);
  jetpack.write(
    'src/main/docker/cypress/docker-compose.yml',
    newComposeContent
  );
};
