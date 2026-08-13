const core = require('@actions/core');
const github = require('@actions/github');
const { fetchPullRequestFiles, fetchExistingComments } = require('./github');
const { filterCSFiles, parsePatch } = require('./diffParser');
const { reviewFile } = require('./reviewer');
const { filterDuplicates } = require('./duplicateChecker');
const { publishReview } = require('./publisher');

async function run() {
  try {
    const token = core.getInput('github-token') || process.env.GITHUB_TOKEN;
    if (!token) {
      core.setFailed('PR Sentry: GITHUB_TOKEN is required.');
      return;
    }

    const context = github.context;
    if (!context.payload || !context.payload.pull_request) {
      core.info('PR Sentry: Action was not triggered by a pull_request event. Exiting safely.');
      return;
    }

    const pullNumber = context.payload.pull_request.number;
    const { owner, repo } = context.repo;

    core.info(`PR Sentry: Starting review for ${owner}/${repo} PR #${pullNumber}...`);

    // Step 1: Fetch PR files
    const allFiles = await fetchPullRequestFiles({ owner, repo, pullNumber, token });
    core.info(`PR Sentry: ${allFiles.length} files changed.`);

    // Step 2: Filter C# files
    const csFiles = filterCSFiles(allFiles, { info: (msg) => core.info(msg) });
    core.info(`PR Sentry: reviewing ${csFiles.length} C# files.`);

    if (csFiles.length === 0) {
      core.info('PR Sentry: No reviewable C# files found in diff. Exiting.');
      return;
    }

    // Step 3: Parse diff hunks & review added lines
    const allFindings = [];
    for (const file of csFiles) {
      const addedLines = parsePatch(file.patch);
      const findings = reviewFile(file.filename, addedLines);
      allFindings.push(...findings);
    }

    core.info(`PR Sentry: detected ${allFindings.length} findings.`);

    // Step 4: Fetch existing PR comments and filter duplicates
    const existingComments = await fetchExistingComments({ owner, repo, pullNumber, token });
    const { uniqueFindings, skippedCount } = filterDuplicates(allFindings, existingComments);

    if (skippedCount > 0) {
      core.info(`PR Sentry: ${skippedCount} existing findings skipped as duplicates.`);
    }

    // Step 5: Publish review comments
    await publishReview({
      owner,
      repo,
      pullNumber,
      token,
      findings: uniqueFindings,
      logger: {
        info: (msg) => core.info(msg),
        error: (msg) => core.error(msg)
      }
    });

    core.info('PR Sentry execution completed.');
  } catch (error) {
    core.setFailed(`PR Sentry failed: ${error.message}`);
  }
}

if (require.main === module) {
  run();
}

module.exports = { run };
