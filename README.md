# Master's Thesis

This repository will contain all the tex files for the written part of the thesis as well as source code for projects that implement parts of the thesis.

# Detecting Flaky Failures of End-to-End Tests in Multi-Language Systems Using Code Coverage

This project aims to develop a tool that detects flaky failures in end-to-end tests for multi-language systems, with a focus on projects using Java and JavaScript. The primary objectives are to collect code coverage data for end-to-end tests and determine if failing tests are flaky based on the collected coverage information and code changes. The open-source projects Artemis and n8n serve as case studies for this research.

## Introduction

Flaky tests are those that fail inconsistently without any changes to the code under test or the test itself. This issue is particularly significant in User Interface (UI) tests due to their size and the highly asynchronous actions involved. The goal of this project is to build a tool that collects coverage information for end-to-end tests and decides if failing tests could be flaky based on the new information and changes.

## Methodology

1. Literature review on flaky tests and learning about Cypress.
2. Attempted local setup of Artemis and integration with Cypress tests (unsuccessful due to complexity).
3. Developed a solution for collecting coverage information for end-to-end tests.
4. Integrated the solution with the existing CI pipeline.
5. Compared coverage information with the latest git changes.
6. Evaluated the tool on relevant commits in Artemis and n8n.
7. Identified limitations of the approach and documented them.

## Findings

Initially, the approach was to collect file-level coverage and compare it to file-level changes. However, this approach was not effective, and the decision was made to switch to line-level coverage. Due to two errors, large parts of the evaluation had to be discarded, and the focus shifted from Artemis to the n8n project. After properly instrumenting the n8n project and resolving test execution issues, the evaluation was conducted using the latest commits from open pull requests.

## Evaluation

To assess the effectiveness of flaky failure detection, a ground truth of test results for n8n is being established. This involves running the latest five commits of the latest 30 open pull requests up to five times and collecting the results. The tests are executed with and without instrumentation on a dedicated runner to determine if instrumentation has a significant impact on the failure rate of tests and their execution time. Additionally, insights into the behavior of the Artemis project will be gained from running the instrumented version of the tests in regular development.

## Conclusion

This project presents an approach to detecting flaky failures of end-to-end tests in multi-language systems using code coverage. While challenges were encountered during the evaluation, particularly with the Artemis project, the focus on the n8n project provided valuable insights. The ongoing evaluation aims to establish a ground truth for n8n test results and understand the impact of instrumentation on test failure rates and execution times.


## Packages
### Multi language coverage collection for cypress
The first package adds support to collect test coverage for e2e tests across the typescript client and java server of artemis.   
Please find out more in [cypress-plugin-multilanguage-coverage](cypress-plugin-multilanguage-coverage).

### CLI for comparing git changes with test coverage
The second package is a small CLI tool that allows comparing git changes with the files that are covered by tests.    
Find out more in [coverage-git-compare](coverage-git-compare)