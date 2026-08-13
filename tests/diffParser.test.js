const assert = require('assert');
const { parsePatch, filterCSFiles, isReviewableCSFile } = require('../src/diffParser');

function runDiffParserTests() {
  console.log('--- Running diffParser Tests ---');

  // Test 1: Unified diff parsing and line mapping
  const samplePatch = `@@ -38,6 +38,9 @@
 context line 1
-deleted line 1
+added line 1
+added line 2
 context line 2`;

  const addedLines = parsePatch(samplePatch);
  assert.strictEqual(addedLines.length, 2, 'Should detect 2 added lines');

  // Verify new-line mapping (starts at 38, context line 1 is line 38, added line 1 is line 39)
  assert.strictEqual(addedLines[0].newLine, 39, 'First added line should map to line 39');
  assert.strictEqual(addedLines[0].content, 'added line 1');
  assert.strictEqual(addedLines[1].newLine, 40, 'Second added line should map to line 40');
  assert.strictEqual(addedLines[1].content, 'added line 2');
  console.log('✓ Test 1 & 2: Unified diff parsing and real new-line mapping passed.');

  // Test 3 & 4: Added lines recognized, deleted lines excluded
  const patchWithDeletions = `@@ -10,3 +10,2 @@
 context
-removed line
+new line`;

  const lines = parsePatch(patchWithDeletions);
  assert.strictEqual(lines.length, 1, 'Only added line should be returned');
  assert.strictEqual(lines[0].content, 'new line');
  assert.strictEqual(lines[0].newLine, 11);
  console.log('✓ Test 3 & 4: Added lines recognized and deleted lines excluded from review targets.');

  // Test File Filtering
  const files = [
    { filename: 'src/Service.cs', status: 'modified', patch: '@@ -1 +1 @@\n-old\n+new' },
    { filename: 'README.md', status: 'modified', patch: '@@ -1 +1 @@' },
    { filename: 'src/Service.g.cs', status: 'modified', patch: '@@ -1 +1 @@' },
    { filename: 'src/OldService.cs', status: 'removed', patch: '@@ -1 +0 @@' }
  ];

  const filtered = filterCSFiles(files, { info: () => {} });
  assert.strictEqual(filtered.length, 1, 'Should filter to only eligible C# files');
  assert.strictEqual(filtered[0].filename, 'src/Service.cs');
  console.log('✓ File filtering tests passed.');

  console.log('All diffParser tests passed!\n');
}

module.exports = runDiffParserTests;
