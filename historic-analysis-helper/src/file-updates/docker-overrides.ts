import jetpack from 'fs-jetpack';

const coverageDockerfile = `
FROM artemis:coverage-latest

RUN echo "Installing needed dependencies" \\
  && apt-get update && apt-get install -y --no-install-recommends unzip \\
  && apt-get clean \\
  && rm -rf /var/lib/apt/lists/*

COPY src/main/docker/cypress/bootstrap-coverage.sh /bootstrap.sh

RUN chmod +x /bootstrap.sh
`;
const cypressDockerfile = `
ARG CYPRESS_BROWSER=node18.6.0-chrome105-ff104
FROM cypress/browsers:\${CYPRESS_BROWSER}
RUN apt-get update
RUN apt-get -y install default-jre
`;
const bootstrapFile = `#!/bin/bash

# Entrypoint file for Docker Images of Artemis. The deployment of the application is set to /opt/artemis

cd /opt/artemis || exit 1

if [ -z "$(ls -A config)" ]; then
   echo "Config is Empty .. copying default ones .."
   cp -n -a /defaults/artemis/. config/
else
   echo "Config is not empty .. not copying default configs .."
fi

# Ensure at least the directories are owned by artemis. "-R" takes too long
chown artemis:artemis config data

unzip Artemis*.war "*.jacoco.agent*.jar" -d .
unzip WEB-INF/lib/org.jacoco.agent*.jar jacocoagent.jar

echo "Starting application..."
exec gosu artemis java \\
  -Djdk.tls.ephemeralDHKeySize=2048 \\
  -DLC_CTYPE=UTF-8 \\
  -Dfile.encoding=UTF-8 \\
  -Dsun.jnu.encoding=UTF-8 \\
  -Djava.security.egd=file:/dev/./urandom \\
  -Xmx2048m \\
  --add-modules java.se \\
  --add-exports java.base/jdk.internal.ref=ALL-UNNAMED \\
  --add-exports java.naming/com.sun.jndi.ldap=ALL-UNNAMED \\
  --add-opens java.base/java.lang=ALL-UNNAMED \\
  --add-opens java.base/java.nio=ALL-UNNAMED \\
  --add-opens java.base/sun.nio.ch=ALL-UNNAMED \\
  --add-opens java.management/sun.management=ALL-UNNAMED \\
  --add-opens jdk.management/com.sun.management.internal=ALL-UNNAMED \\
  -javaagent:jacocoagent.jar=output=tcpserver,address=* \\
  -jar Artemis.war
`;
const dockerComposeFile = (cypressTag:string) => `
version: '2.4'
services:
    artemis-app:
        build:
            dockerfile: src/main/docker/cypress/Coverage-Dockerfile
        ports:
            - "6300:6300" # JaCoCo agent port

    artemis-cypress:
        build:
            context: .
            dockerfile: Cypress-Dockerfile
            args:
                - CYPRESS_BROWSER=${cypressTag}
        environment:
            - BAMBOO_PLAN_KEY
            - BAMBOO_TOKEN
            - CYPRESS_COLLECT_COVERAGE=true
        # Wait up to 5 minutes until Artemis has booted
        command: sh -c "cd /app/artemis/src/test/cypress && chmod 777 /root && npm ci && npm exec -- wait-on -i 1000 -t 300000 http://artemis-app:\${SERVER_PORT} && npm run cypress:run || npm run detect:flakies"
`;
export const addDockerOverrides = (cypressImage:string) => {
  const dockerFilesPath = 'src/main/docker/cypress';
  jetpack.write(`${dockerFilesPath}/Coverage-Dockerfile`, coverageDockerfile);
  jetpack.write(`${dockerFilesPath}/Cypress-Dockerfile`, cypressDockerfile);
  jetpack.write(`${dockerFilesPath}/bootstrap-coverage.sh`, bootstrapFile);
  jetpack.write(`${dockerFilesPath}/docker-compose.coverage.yml`, dockerComposeFile(cypressImage));
}
