const fs = require('fs');
const path = require('path');
const assert = require('assert');

const runDiffParserTests = require('./diffParser.test');
const runReviewerTests = require('./reviewer.test');
const runDuplicateCheckerTests = require('./duplicateChecker.test');

const { parsePatch } = require('../src/diffParser');
const { reviewFile } = require('../src/reviewer');

function runFixtureTests() {
  console.log('--- Running Sample Patch Fixture Tests ---');
  const fixturesDir = path.join(__dirname, '..', 'fixtures', 'sample-patches');

  const fixtureCases = [
    { file: 'null-dereference.patch', expectedCategory: 'null-handling', minFindings: 1 },
    { file: 'async-void.patch', expectedCategory: 'async', minFindings: 1 },
    { file: 'blocking-async-result.patch', expectedCategory: 'async', minFindings: 1 },
    { file: 'blocking-async-wait.patch', expectedCategory: 'async', minFindings: 1 },
    { file: 'solid-tight-coupling.patch', expectedCategory: 'SOLID', minFindings: 1 },
    { file: 'clean-code.patch', expectedCategory: null, minFindings: 0 }
  ];

  for (const item of fixtureCases) {
    const filePath = path.join(fixturesDir, item.file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Fixture file missing: ${filePath}`);
    }

    const patchText = fs.readFileSync(filePath, 'utf8');
    const addedLines = parsePatch(patchText);
    const findings = reviewFile(item.file, addedLines);

    if (item.expectedCategory === null) {
      assert.strictEqual(findings.length, 0, `Clean fixture ${item.file} should yield 0 findings`);
      console.log(`✓ Fixture ${item.file}: 0 findings as expected.`);
    } else {
      assert(findings.length >= item.minFindings, `Fixture ${item.file} should yield at least ${item.minFindings} finding`);
      const hasCategory = findings.some(f => f.category === item.expectedCategory);
      assert(hasCategory, `Fixture ${item.file} should yield category ${item.expectedCategory}`);
      console.log(`✓ Fixture ${item.file}: detected ${findings.length} finding(s) under category '${item.expectedCategory}'.`);
    }
  }

  console.log('All sample patch fixture tests passed!\n');
}

function main() {
  console.log('==================================================');
  console.log('       PR SENTRY - AUTOMATED TEST SUITE          ');
  console.log('==================================================\n');

  try {
    runDiffParserTests();
    runReviewerTests();
    runDuplicateCheckerTests();
    runFixtureTests();

    console.log('==================================================');
    console.log(' SUCCESS: All 10 test scenarios passed cleanly!');
    console.log('==================================================');
    process.exit(0);
  } catch (error) {
    console.error('\n==================================================');
    console.error(' FAILURE: Test suite failed!');
    console.error(error);
    console.error('==================================================');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
