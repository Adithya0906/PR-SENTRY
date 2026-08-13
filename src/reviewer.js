/**
 * Module for reviewing added C# code lines against SOLID, null-handling, and async rules.
 */

/**
 * Reviews parsed added lines for a single C# file.
 * @param {string} filename - Path to the .cs file
 * @param {Array<{ newLine: number, content: string, hunkHeader: string }>} addedLines - List of added lines
 * @returns {Array<{ file: string, line: number, category: string, severity: string, message: string, hunk_ref: string }>}
 */
function reviewFile(filename, addedLines) {
  if (!Array.isArray(addedLines) || addedLines.length === 0) {
    return [];
  }

  const findings = [];

  for (const item of addedLines) {
    const { newLine, content, hunkHeader } = item;
    const trimmed = content.trim();

    // Skip empty lines or pure code comments
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      continue;
    }

    // --- 1. Async correctness rules ---
    checkAsyncRules(filename, newLine, content, hunkHeader, findings);

    // --- 2. Null-handling rules ---
    checkNullHandlingRules(filename, newLine, content, hunkHeader, findings);

    // --- 3. SOLID principle rules ---
    checkSolidRules(filename, newLine, content, hunkHeader, findings);
  }

  return findings;
}

/**
 * Checks for async correctness issues.
 */
function checkAsyncRules(filename, line, content, hunkHeader, findings) {
  const trimmed = content.trim();

  // Pattern 1: async void
  if (/\basync\s+void\b/i.test(trimmed)) {
    // Check if it's a typical event handler signature (e.g. object sender, EventArgs e or On... naming)
    const isEventHandler = /\b(EventArgs|sender|Object\s+sender|on[A-Z]\w*|_Click|_Event)\b/i.test(trimmed);
    if (!isEventHandler) {
      findings.push({
        file: filename,
        line,
        category: 'async',
        severity: 'warning',
        message: 'Avoid `async void`; prefer `async Task` unless it is an event handler.',
        hunk_ref: hunkHeader
      });
    }
  }

  // Pattern 2: .Result on Task
  if (/\b\w+Async\s*\([^)]*\)\s*\.Result\b|\bTask\b[^\n]*\.Result\b|\b\w+\.Result\b/i.test(trimmed)) {
    // Match explicit .Result calls
    const resultMatch = trimmed.match(/(\w+(?:\([^)]*\))?)\.Result\b/);
    const targetExpr = resultMatch ? resultMatch[1] : 'Task';
    if (!trimmed.startsWith('//') && (trimmed.includes('.Result') || trimmed.includes('Task'))) {
      findings.push({
        file: filename,
        line,
        category: 'async',
        severity: 'warning',
        message: `Avoid \`.Result\` on a Task (found \`${targetExpr}.Result\`) because it blocks asynchronous execution and may cause deadlocks.`,
        hunk_ref: hunkHeader
      });
    }
  }

  // Pattern 3: .Wait() on Task
  if (/\b\w+Async\s*\([^)]*\)\s*\.Wait\s*\(\s*\)|\b\w+\.Wait\s*\(\s*\)/i.test(trimmed)) {
    const waitMatch = trimmed.match(/(\w+(?:\([^)]*\))?)\.Wait\s*\(\s*\)/);
    const targetExpr = waitMatch ? waitMatch[1] : 'Task';
    findings.push({
      file: filename,
      line,
      category: 'async',
      severity: 'warning',
      message: `Avoid \`.Wait()\` on a Task (found \`${targetExpr}.Wait()\`) because it blocks asynchronous execution.`,
      hunk_ref: hunkHeader
    });
  }
}

/**
 * Checks for null-handling issues.
 */
function checkNullHandlingRules(filename, line, content, hunkHeader, findings) {
  const trimmed = content.trim();

  // Pattern 1: Direct unsafe .Value access on Nullable<T> without HasValue check on same line
  if (/\b\w+\.Value\b/.test(trimmed) && !trimmed.includes('.HasValue') && !trimmed.includes('GetValueOrDefault')) {
    const match = trimmed.match(/(\w+)\.Value\b/);
    if (match) {
      const varName = match[1];
      // Exclude standard System properties like KeyValuePair.Value
      if (!['KeyValuePair', 'entry', 'pair', 'kvp', 'item', 'match', 'group'].includes(varName.toLowerCase())) {
        findings.push({
          file: filename,
          line,
          category: 'null-handling',
          severity: 'warning',
          message: `\`${varName}.Value\` is accessed directly without verifying \`${varName}.HasValue\`.`,
          hunk_ref: hunkHeader
        });
      }
    }
  }

  // Pattern 2: Unsafe / unnecessary null-forgiving operator !
  // Matches identifier! or identifier!.Member (excluding != null or boolean logic)
  if (/\b[a-zA-Z_]\w*!\./.test(trimmed) || /\b[a-zA-Z_]\w*!\s*;/.test(trimmed)) {
    const match = trimmed.match(/([a-zA-Z_]\w*)!/);
    const target = match ? match[1] : 'expression';
    findings.push({
      file: filename,
      line,
      category: 'null-handling',
      severity: 'warning',
      message: `Unsafe use of null-forgiving operator \`!\` on \`${target}!\`. Ensure object is non-null or use null-conditional operator \`?.\`.`,
      hunk_ref: hunkHeader
    });
  }

  // Pattern 3: Unchecked parameter / variable property dereference in method body
  // e.g. return customer.Name; or customer.Address without null guard
  if (
    /return\s+([a-zA-Z_]\w*)\.([a-zA-Z_]\w*)\s*;/.test(trimmed) ||
    /^\s*([a-zA-Z_]\w*)\.([a-zA-Z_]\w*)\s*=/.test(trimmed)
  ) {
    const match = trimmed.match(/\b([a-zA-Z_]\w*)\.([a-zA-Z_]\w*)\b/);
    if (match) {
      const objName = match[1];
      const propName = match[2];

      // Filter out standard safe objects / keywords
      const safeKeywords = ['this', 'base', 'String', 'DateTime', 'Console', 'Task', 'Math', 'Convert', 'Array', 'List', 'Guid'];
      if (!safeKeywords.includes(objName)) {
        findings.push({
          file: filename,
          line,
          category: 'null-handling',
          severity: 'warning',
          message: `\`${objName}.${propName}\` is dereferenced without verifying that \`${objName}\` is non-null.`,
          hunk_ref: hunkHeader
        });
      }
    }
  }
}

/**
 * Checks for SOLID design issues.
 */
function checkSolidRules(filename, line, content, hunkHeader, findings) {
  const trimmed = content.trim();

  // Pattern 1: Direct instantiation of concrete dependency inside fields/services
  // e.g. private readonly EmailSender sender = new EmailSender();
  const tightCouplingRegex = /(?:private|protected|public)?\s*(?:readonly)?\s*([A-Z]\w+)\s+([a-zA-Z_]\w*)\s*=\s*new\s+([A-Z]\w+)\s*\(/;
  const match = trimmed.match(tightCouplingRegex);

  if (match) {
    const fieldType = match[1];
    const fieldName = match[2];
    const concreteType = match[3];

    // Exclude common data structures, DTOs, collections, StringBuilder, etc.
    const standardTypes = [
      'List', 'Dictionary', 'HashSet', 'Collection', 'Queue', 'Stack', 'Array',
      'StringBuilder', 'CancellationTokenSource', 'HttpClient', 'Random', 'Stopwatch',
      'MemoryStream', 'FileStream', 'TaskCompletionSource'
    ];

    if (!standardTypes.includes(concreteType)) {
      findings.push({
        file: filename,
        line,
        category: 'SOLID',
        severity: 'warning',
        message: `Directly creates concrete dependency \`new ${concreteType}()\` for field \`${fieldName}\`, tightly coupling the class. Consider dependency injection.`,
        hunk_ref: hunkHeader
      });
    }
  }

  // Pattern 2: SRP Violation - mixing operations in comments / code blocks (e.g. database + email + validation + formatting)
  const lower = trimmed.toLowerCase();
  if (
    (lower.includes('database') || lower.includes('repository')) &&
    (lower.includes('email') || lower.includes('notification')) &&
    (lower.includes('validation') || lower.includes('format'))
  ) {
    findings.push({
      file: filename,
      line,
      category: 'SOLID',
      severity: 'warning',
      message: 'Method or block contains mixed responsibilities (database, email, validation/formatting). Consider splitting into distinct single-responsibility classes.',
      hunk_ref: hunkHeader
    });
  }
}

/**
 * Reviews a collection of files and returns all structured findings.
 * @param {Array<{ filename: string, patch: string }>} files - List of PR file objects
 * @param {Function} parsePatchFn - Diff parser function
 * @returns {Array<Object>}
 */
function reviewPullRequest(files, parsePatchFn) {
  if (!Array.isArray(files)) return [];

  const allFindings = [];
  for (const file of files) {
    if (!file.patch) continue;
    const addedLines = parsePatchFn(file.patch);
    const fileFindings = reviewFile(file.filename, addedLines);
    allFindings.push(...fileFindings);
  }

  return allFindings;
}

module.exports = {
  reviewFile,
  reviewPullRequest,
  checkAsyncRules,
  checkNullHandlingRules,
  checkSolidRules
};
