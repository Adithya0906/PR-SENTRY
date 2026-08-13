/**
 * Module for publishing PR Sentry review comments via GitHub API.
 */

const { postReview } = require('./github');

/**
 * Builds the review summary markdown text based on findings.
 * @param {Array<Object>} findings - List of findings
 * @returns {string}
 */
function buildReviewSummary(findings) {
  const categoryCounts = {
    SOLID: 0,
    'null-handling': 0,
    async: 0
  };

  for (const finding of findings) {
    const cat = finding.category;
    if (categoryCounts[cat] !== undefined) {
      categoryCounts[cat]++;
    } else {
      categoryCounts[cat] = 1;
    }
  }

  const lines = [
    'PR Sentry reviewed the changed C# code.',
    '',
    `${findings.length} findings:`,
    `- SOLID: ${categoryCounts.SOLID || 0}`,
    `- Null-handling: ${categoryCounts['null-handling'] || 0}`,
    `- Async: ${categoryCounts.async || 0}`,
    '',
    'See inline comments for details.'
  ];

  return lines.join('\n');
}

/**
 * Formats structured findings into GitHub API comment payloads.
 * @param {Array<Object>} findings - List of findings
 * @returns {Array<{ path: string, line: number, side: string, body: string }>}
 */
function formatCommentsPayload(findings) {
  return findings.map(finding => ({
    path: finding.file,
    line: finding.line,
    side: 'RIGHT',
    body: `**[${finding.category}]** ${finding.message}`
  }));
}

/**
 * Publishes the code review containing inline comments.
 * @param {Object} params
 * @param {string} params.owner
 * @param {string} params.repo
 * @param {number} params.pullNumber
 * @param {string} params.token
 * @param {Array<Object>} params.findings
 * @param {Object} [logger=console]
 */
async function publishReview({ owner, repo, pullNumber, token, findings, logger = console }) {
  if (!Array.isArray(findings) || findings.length === 0) {
    logger.info('PR Sentry: 0 new findings to post. Skipping review submission.');
    return null;
  }

  const body = buildReviewSummary(findings);
  const comments = formatCommentsPayload(findings);

  logger.info(`PR Sentry: posting ${comments.length} new inline comments to PR #${pullNumber}.`);

  try {
    const reviewResult = await postReview({
      owner,
      repo,
      pullNumber,
      token,
      body,
      comments
    });
    logger.info('PR Sentry: review submitted successfully.');
    return reviewResult;
  } catch (error) {
    logger.error(`PR Sentry Error: Failed to publish GitHub review: ${error.message}`);
    throw error;
  }
}

module.exports = {
  buildReviewSummary,
  formatCommentsPayload,
  publishReview
};
