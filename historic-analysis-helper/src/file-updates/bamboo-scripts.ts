import jetpack from "fs-jetpack"

const envSetup = `adminUser=$bamboo_artemis_admin_username
adminPassword=$bamboo_artemis_admin_password
artemisPort=54321
# Export environmental variables to configure Cypress and Artemis.
export CYPRESS_baseUrl="http://artemis-app:$artemisPort"
export CYPRESS_adminUsername=$adminUser
export CYPRESS_adminPassword=$adminPassword
export CYPRESS_username=$bamboo_cypress_username_template
export CYPRESS_password=$bamboo_cypress_password_template
export CYPRESS_allowGroupCustomization=true
export CYPRESS_studentGroupName=artemis-e2etest-students
export CYPRESS_tutorGroupName=artemis-e2etest-tutors
export CYPRESS_editorGroupName=artemis-e2etest-editors
export CYPRESS_instructorGroupName=artemis-e2etest-instructors
export BAMBOO_PLAN_KEY=$bamboo_planKey
export BAMBOO_BUILD_NUMBER=$bamboo_buildNumber
export BAMBOO_TOKEN=$bamboo_BAMBOO_PERSONAL_SECRET
export CYPRESS_COLLECT_COVERAGE="true"
export DATASOURCE_URL="jdbc:mysql://artemis-mysql:3306/Artemis?createDatabaseIfNotExist=true&allowPublicKeyRetrieval=true&useUnicode=true&characterEncoding=utf8&useSSL=false&useLegacyDatetimeCode=false&serverTimezone=UTC"
export UM_URL="https://jira-prelive.ase.in.tum.de"
export CI_URL="https://bamboo-prelive.ase.in.tum.de"
export SCM_URL="https://bitbucket-prelive.ase.in.tum.de"
export SCM_USER=$bamboo_jira_prelive_admin_user
export SCM_PASSWORD=$bamboo_jira_prelive_admin_password
export UM_USER=$bamboo_jira_prelive_admin_user
export UM_PASSWORD=$bamboo_jira_prelive_admin_password
export CI_USER=$bamboo_jira_prelive_admin_user
export CI_PASSWORD=$bamboo_jira_prelive_admin_password
export CI_AUTH_TOKEN=$bamboo_ARTEMIS_CONTINUOUS_INTEGRATION_ARTEMIS_AUTHENTICATION_TOKEN_VALUE_SECRET
export CI_TOKEN=$bamboo_ARTEMIS_CONTINUOUS_INTEGRATION_TOKEN_SECRET
export SERVER_URL="http://$(hostname):$artemisPort"
export SERVER_PORT=$artemisPort
export ADMIN_USERNAME=$adminUser
export ADMIN_PASSWORD=$adminPassword
export GH_REGISTRY_TOKEN=$bamboo_GH_REGISTRY_TOKEN`

const e2eCleanupFile = `
#!/bin/sh

cd src/main/docker/cypress

# HOST_HOSTNAME not really necessary for shutdown but otherwise docker-compose complains
export HOST_HOSTNAME=$(hostname)

${envSetup}

docker-compose -f docker-compose.yml down -v`
const flakyCleanupFile = `#!/bin/sh

cd src/main/docker/cypress

# HOST_HOSTNAME not really necessary for shutdown but otherwise docker-compose complains
export HOST_HOSTNAME=$(hostname)

${envSetup}

docker-compose -f docker-compose.yml -f docker-compose.coverage.yml down -v`

const e2eExecuteFile = `#!/bin/sh

# Create libs folder because the Artemis docker compose file expects the .war file there
mkdir -p build/libs
mv ./*.war build/libs/

# Start Artemis docker containers with docker-compose
cd src/main/docker/cypress

# pass current host's hostname to the docker container for server.url (see docker compose config file)
export HOST_HOSTNAME=$(hostname)

${envSetup}

docker-compose -f docker-compose.yml pull
docker-compose -f docker-compose.yml build --no-cache --pull
docker-compose -f docker-compose.yml up --exit-code-from artemis-cypress
exitCode=$?
echo "Cypress container exit code: $exitCode"
if [ $exitCode -eq 0 ]
then
    touch ../../../../.successful
else
    echo "Not creating success file because the tests failed"
fi`


const flakyExecuteFile = `#!/bin/sh

# Create libs folder because the Artemis docker compose file expects the .war file there
mkdir -p build/libs
mv ./*.war build/libs/

# Load git history needed for analysis
git config remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*"

git fetch --unshallow || git fetch --all

${envSetup}

docker build . -f ./src/main/docker/Dockerfile -t artemis:coverage-latest

# Start Artemis docker containers with docker-compose
cd src/main/docker/cypress

# pass current host's hostname to the docker container for server.url (see docker compose config file)
export HOST_HOSTNAME=$(hostname)

export GH_REGISTRY_TOKEN=$bamboo_GH_REGISTRY_TOKEN

docker-compose -f docker-compose.yml -f docker-compose.coverage.yml pull
docker-compose -f docker-compose.yml -f docker-compose.coverage.yml build --no-cache --pull artemis-cypress
#do not pull the base image artemis:coverage-latest for artemis-app as it's stored locally and built above
docker-compose -f docker-compose.yml -f docker-compose.coverage.yml build --no-cache artemis-app
docker-compose -f docker-compose.yml -f docker-compose.coverage.yml up --exit-code-from artemis-cypress
exitCode=$?
echo "Cypress container exit code: $exitCode"
if [ $exitCode -eq 0 ]
then
    touch ../../../../.successful
else
    echo "Not creating success file because the tests failed"
fi`

export const addBambooScripts = () => {
    jetpack.write(".bamboo/E2E-tests/cleanup.sh", e2eCleanupFile);
    jetpack.write(".bamboo/E2E-tests/execute.sh", e2eExecuteFile);
    jetpack.write(".bamboo/E2E-tests-with-flake-detection/cleanup.sh", flakyCleanupFile);
    jetpack.write(".bamboo/E2E-tests-with-flake-detection/execute.sh", flakyExecuteFile);
}
