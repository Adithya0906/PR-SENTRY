/**
 * Module for fingerprinting PR findings and preventing duplicate inline comments.
 */

/**
 * Normalizes message string for consistent fingerprint comparison.
 */
function normalizeMessage(msg) {
  if (!msg || typeof msg !== 'string') return '';
  return msg
    .toLowerCase()
    .replace(/[`'"]/g, '') // remove quotes/backticks
    .replace(/\s+/g, ' ')  // normalize whitespace
    .replace(/[.,;!]$/, '') // trim trailing punctuation
    .trim();
}

/**
 * Computes a deterministic fingerprint for a finding.
 * Format: file + ":" + line + ":" + category + ":" + normalizedMessage
 */
function computeFingerprint(file, line, category, message) {
  const normFile = (file || '').trim();
  const normLine = line || 0;
  const normCat = (category || '').trim().toLowerCase();
  const normMsg = normalizeMessage(message);

  return `${normFile}:${normLine}:${normCat}:${normMsg}`;
}

/**
 * Parses an existing GitHub PR review comment to extract its fingerprint.
 * GitHub comment body is formatted as: **[category]** message
 */
function getCommentFingerprint(comment) {
  if (!comment || typeof comment !== 'object') return null;

  const file = comment.path || '';
  const line = comment.line || comment.original_line || 0;
  const body = comment.body || '';

  // Match **[category]** prefix in comment body
  const match = body.match(/^\*\*\[([^\]]+)\]\*\*\s*(.*)/s);
  let category = '';
  let message = body;

  if (match) {
    category = match[1];
    message = match[2];
  }

  return computeFingerprint(file, line, category, message);
}

/**
 * Filters findings against existing comments on the PR to prevent duplicates.
 * @param {Array<Object>} findings - List of newly detected findings
 * @param {Array<Object>} existingComments - List of existing PR review comments
 * @returns {{ uniqueFindings: Array<Object>, skippedCount: number }}
 */
function filterDuplicates(findings, existingComments) {
  if (!Array.isArray(findings) || findings.length === 0) {
    return { uniqueFindings: [], skippedCount: 0 };
  }

  if (!Array.isArray(existingComments) || existingComments.length === 0) {
    return { uniqueFindings: findings, skippedCount: 0 };
  }

  // Build set of existing fingerprints
  const existingFingerprints = new Set();
  for (const comment of existingComments) {
    const fp = getCommentFingerprint(comment);
    if (fp) {
      existingFingerprints.add(fp);
    }
  }

  const uniqueFindings = [];
  let skippedCount = 0;

  for (const finding of findings) {
    const fp = computeFingerprint(finding.file, finding.line, finding.category, finding.message);
    if (existingFingerprints.has(fp)) {
      skippedCount++;
    } else {
      uniqueFindings.push(finding);
      // Add to set to also avoid duplicates within the same run
      existingFingerprints.add(fp);
    }
  }

  return {
    uniqueFindings,
    skippedCount
  };
}

module.exports = {
  normalizeMessage,
  computeFingerprint,
  getCommentFingerprint,
  filterDuplicates
};
