const github = require('@actions/github');

/**
 * Creates an Octokit REST client using the provided GITHUB_TOKEN or environment variable.
 */
function getOctokit(token) {
  const authToken = token || process.env.GITHUB_TOKEN;
  if (!authToken) {
    throw new Error('GITHUB_TOKEN is missing or empty.');
  }
  return github.getOctokit(authToken);
}

/**
 * Fetches all changed files for a pull request.
 * GET /repos/{owner}/{repo}/pulls/{pull_number}/files
 */
async function fetchPullRequestFiles({ owner, repo, pullNumber, token }) {
  const octokit = getOctokit(token);
  const files = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const response = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: pullNumber,
      per_page: perPage,
      page
    });

    files.push(...response.data);
    if (response.data.length < perPage) {
      break;
    }
    page++;
  }

  return files.map(file => ({
    filename: file.filename,
    status: file.status,
    patch: file.patch,
    additions: file.additions,
    deletions: file.deletions,
    changes: file.changes
  }));
}

/**
 * Fetches existing pull request review comments.
 * GET /repos/{owner}/{repo}/pulls/{pull_number}/comments
 */
async function fetchExistingComments({ owner, repo, pullNumber, token }) {
  const octokit = getOctokit(token);
  const comments = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const response = await octokit.rest.pulls.listReviewComments({
      owner,
      repo,
      pull_number: pullNumber,
      per_page: perPage,
      page
    });

    comments.push(...response.data);
    if (response.data.length < perPage) {
      break;
    }
    page++;
  }

  return comments.map(comment => ({
    id: comment.id,
    path: comment.path,
    line: comment.line || comment.original_line,
    body: comment.body,
    side: comment.side
  }));
}

/**
 * Posts a pull request review with inline comments.
 * POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews
 */
async function postReview({ owner, repo, pullNumber, token, body, comments }) {
  const octokit = getOctokit(token);

  const payload = {
    owner,
    repo,
    pull_number: pullNumber,
    event: 'COMMENT',
    body,
    comments
  };

  const response = await octokit.rest.pulls.createReview(payload);
  return response.data;
}

module.exports = {
  fetchPullRequestFiles,
  fetchExistingComments,
  postReview
};
