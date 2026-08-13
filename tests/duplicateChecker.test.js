const assert = require('assert');
const { computeFingerprint, filterDuplicates } = require('../src/duplicateChecker');

function runDuplicateCheckerTests() {
  console.log('--- Running duplicateChecker Tests ---');

  // Test 10: Duplicate comment fingerprinting
  const fp1 = computeFingerprint('src/Invoice.cs', 42, 'null-handling', 'customer.Address is dereferenced.');
  const fp2 = computeFingerprint('src/Invoice.cs', 42, 'null-handling', '`customer.Address` is dereferenced.');

  assert.strictEqual(fp1, fp2, 'Fingerprints should match despite slight formatting differences');

  const newFindings = [
    {
      file: 'src/Billing/InvoiceService.cs',
      line: 42,
      category: 'null-handling',
      message: 'customer.Address is dereferenced without verifying customer is non-null.'
    },
    {
      file: 'src/Billing/InvoiceService.cs',
      line: 55,
      category: 'async',
      message: 'Avoid .Result on a Task because it blocks asynchronous execution.'
    }
  ];

  const existingComments = [
    {
      path: 'src/Billing/InvoiceService.cs',
      line: 42,
      body: '**[null-handling]** customer.Address is dereferenced without verifying customer is non-null.'
    }
  ];

  const result = filterDuplicates(newFindings, existingComments);

  assert.strictEqual(result.skippedCount, 1, 'Should skip 1 existing duplicate comment');
  assert.strictEqual(result.uniqueFindings.length, 1, 'Should retain 1 unique finding');
  assert.strictEqual(result.uniqueFindings[0].line, 55, 'Retained finding should be line 55');

  console.log('✓ Test 10: Duplicate comment fingerprinting & filtering passed.');

  // Re-run with all comments existing -> zero duplicates posted
  const existingCommentsAll = [
    ...existingComments,
    {
      path: 'src/Billing/InvoiceService.cs',
      line: 55,
      body: '**[async]** Avoid .Result on a Task because it blocks asynchronous execution.'
    }
  ];

  const reRunResult = filterDuplicates(newFindings, existingCommentsAll);
  assert.strictEqual(reRunResult.skippedCount, 2, 'Should skip all 2 findings on re-run');
  assert.strictEqual(reRunResult.uniqueFindings.length, 0, 'Re-run should return 0 new findings');
  console.log('✓ Re-running workflow on unchanged PR adds zero duplicate comments.');

  console.log('All duplicateChecker tests passed!\n');
}

module.exports = runDuplicateCheckerTests;
