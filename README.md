# Master's Thesis

This repository will contain all the tex files for the written part of the thesis as well as source code for projects that implement parts of the thesis.

## Topic
#### Automatically Detecting Flaky End-to-End Tests in Multi-Language Systems Using Code Coverage
The thesis follows an idea proposed by Jon Bell in [DeFlaker: Automatically Detecting Flaky Tests](https://www.jonbell.net/icse18-deflaker.pdf) and has the aim of extending the concept to cover both the server and the client of an application. The example used to test that concept is [Artemis](https://github.com/ls1intum/Artemis#readme) an interactive learning platform developed at TUM.    
Artemis uses [cypress](https://www.cypress.io/) to run End-to-End tests on their system. Those tests will be the focus of investigations.

## Packages
### Multi language coverage collection for cypress
The first package adds support to collect test coverage for e2e tests across the typescript client and java server of artemis.   
Please find out more in [cypress-plugin-multilanguage-coverage](cypress-plugin-multilanguage-coverage).

### CLI for comparing git changes with test coverage
The second package is a small CLI tool that allows comparing git changes with the files that are covered by tests.    
Find out more in [coverage-git-compare](coverage-git-compare)