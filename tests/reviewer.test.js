const assert = require('assert');
const { reviewFile } = require('../src/reviewer');

function runReviewerTests() {
  console.log('--- Running reviewer Tests ---');

  // Test 5: async void detection
  const asyncVoidLines = [
    { newLine: 16, content: 'public async void SaveOrder()', hunkHeader: '@@ -15,4 +15,7 @@' },
    { newLine: 17, content: '    await repository.SaveAsync();', hunkHeader: '@@ -15,4 +15,7 @@' }
  ];
  const asyncVoidFindings = reviewFile('OrderProcessor.cs', asyncVoidLines);
  assert.strictEqual(asyncVoidFindings.length, 1, 'Should detect 1 async void issue');
  assert.strictEqual(asyncVoidFindings[0].category, 'async');
  assert(asyncVoidFindings[0].message.includes('async void'), 'Message should reference async void');
  console.log('✓ Test 5: async void detection passed.');

  // Test 6: .Result detection
  const resultLines = [
    { newLine: 22, content: 'var result = GetCustomerAsync().Result;', hunkHeader: '@@ -20,4 +20,7 @@' }
  ];
  const resultFindings = reviewFile('CustomerController.cs', resultLines);
  assert.strictEqual(resultFindings.length, 1, 'Should detect 1 .Result issue');
  assert.strictEqual(resultFindings[0].category, 'async');
  assert(resultFindings[0].message.includes('.Result'), 'Message should reference .Result');
  console.log('✓ Test 6: .Result detection passed.');

  // Test 7: .Wait() detection
  const waitLines = [
    { newLine: 13, content: 'SaveAsync().Wait();', hunkHeader: '@@ -12,4 +12,7 @@' }
  ];
  const waitFindings = reviewFile('SaveHandler.cs', waitLines);
  assert.strictEqual(waitFindings.length, 1, 'Should detect 1 .Wait() issue');
  assert.strictEqual(waitFindings[0].category, 'async');
  assert(waitFindings[0].message.includes('.Wait()'), 'Message should reference .Wait()');
  console.log('✓ Test 7: .Wait() detection passed.');

  // Test 8: null-handling detection
  const nullLines = [
    { newLine: 11, content: 'return customer.Name;', hunkHeader: '@@ -10,4 +10,7 @@' }
  ];
  const nullFindings = reviewFile('CustomerService.cs', nullLines);
  assert.strictEqual(nullFindings.length, 1, 'Should detect 1 null dereference issue');
  assert.strictEqual(nullFindings[0].category, 'null-handling');
  assert(nullFindings[0].message.includes('customer.Name'), 'Message should specify dereferenced property');
  console.log('✓ Test 8: null-handling dereference detection passed.');

  // Test 8b: Null-forgiving operator ! and .Value detection
  const nullForgivingLines = [
    { newLine: 25, content: 'var name = customer!.Name;', hunkHeader: '@@ -24,4 +24,7 @@' },
    { newLine: 26, content: 'int val = maybeInt.Value;', hunkHeader: '@@ -24,4 +24,7 @@' }
  ];
  const nullForgivingFindings = reviewFile('CustomerService.cs', nullForgivingLines);
  assert.strictEqual(nullForgivingFindings.length, 2, 'Should detect null-forgiving ! and .Value issues');
  console.log('✓ Test 8b: null-forgiving ! and .Value detection passed.');

  // Test 9: SOLID tight-coupling detection
  const solidLines = [
    { newLine: 6, content: 'private readonly EmailSender sender = new EmailSender();', hunkHeader: '@@ -5,4 +5,10 @@' }
  ];
  const solidFindings = reviewFile('OrderService.cs', solidLines);
  assert.strictEqual(solidFindings.length, 1, 'Should detect 1 SOLID tight-coupling issue');
  assert.strictEqual(solidFindings[0].category, 'SOLID');
  assert(solidFindings[0].message.includes('new EmailSender()'), 'Message should reference concrete dependency');
  console.log('✓ Test 9: SOLID tight-coupling detection passed.');

  // Clean C# example produces no findings
  const cleanLines = [
    { newLine: 5, content: 'private readonly IEmailSender _sender;', hunkHeader: '@@ -1,5 +1,12 @@' },
    { newLine: 7, content: 'public CleanService(IEmailSender sender)', hunkHeader: '@@ -1,5 +1,12 @@' },
    { newLine: 9, content: '_sender = sender ?? throw new ArgumentNullException(nameof(sender));', hunkHeader: '@@ -1,5 +1,12 @@' },
    { newLine: 12, content: 'await _sender.SendAsync(cancellationToken);', hunkHeader: '@@ -1,5 +1,12 @@' }
  ];
  const cleanFindings = reviewFile('CleanService.cs', cleanLines);
  assert.strictEqual(cleanFindings.length, 0, 'Clean code should produce 0 findings');
  console.log('✓ Clean C# code test passed.');

  console.log('All reviewer tests passed!\n');
}

module.exports = runReviewerTests;
