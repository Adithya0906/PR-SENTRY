# PR Sentry – Sentry on the Diff 🛡️

**PR Sentry** is an automated, high-precision GitHub Action designed to perform inline code reviews on C# pull requests. It focuses strictly on changed code hunks (`.cs` files) to catch high-impact architectural and safety defects without noisy full-repository scanning or LLM dependencies.

---

## Key Features

- **Diff-Only Analysis**: Scans only added lines in modified `.cs` files. Unchanged code and non-C# files are safely skipped.
- **Real-Line Anchoring**: Maps unified diff hunk line offsets to real line numbers in the new file, posting comments precisely on the target lines (`side: "RIGHT"`).
- **Deterministic Issue Detection**: Fast, static detection for:
  1. **SOLID Principles**: Direct tight coupling (`new ConcreteDependency()`) and SRP violations.
  2. **Null-Safety & Null-Handling**: Unchecked dereferences, unsafe `.Value` calls, and null-forgiving operator `!` misuse.
  3. **Async/Await Correctness**: `async void` methods, `.Result` deadlocks, and `.Wait()` sync-blocking.
- **Zero Duplicate Comments**: Calculates deterministic fingerprints (`file + line + category + message`) against existing PR review comments to ensure zero duplicate comments on workflow re-runs or synchronize events.
- **Single Consolidated Review**: Groups all findings into a single GitHub PR Review instead of spamming individual comment events.

---

## Architecture Diagram

```mermaid
flowchart TD
    A[GitHub Pull Request Event] -->|opened / synchronize| B[GitHub Actions Workflow]
    B --> C[Fetch PR Files & Patches\nGET /pulls/pull_number/files]
    C --> D[Filter .cs Files & Parse Hunks]
    D --> E[Map Diff Lines to New-File Line Numbers]
    E --> F[Deterministic C# Reviewer\nSOLID | Null-handling | Async]
    F --> G[Fetch Existing PR Comments\nGET /pulls/pull_number/comments]
    G --> H[Duplicate Checker & Fingerprint Comparison]
    H -->|Filter Out Existing| I[Format Consolidated Review Payload]
    I --> J[Post Single GitHub Review\nPOST /pulls/pull_number/reviews]
```

---

## Workflow Setup

Create `.github/workflows/pr-sentry.yml` in your repository:

```yaml
name: PR Sentry - Sentry on the Diff

on:
  pull_request:
    types: [opened, synchronize]

permissions:
  contents: read
  pull-requests: write

jobs:
  review:
    name: C# Code Review
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Run PR Sentry
        uses: OWNER/pr-sentry@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

---

## Required Permissions

PR Sentry requires the following workflow permissions:

```yaml
permissions:
  contents: read
  pull-requests: write
```

- `contents: read`: Allows fetching repository contents and PR file diffs.
- `pull-requests: write`: Allows fetching existing PR comments and posting consolidated reviews with inline inline comments.

---

## Example Findings

### 1. SOLID Principle Issue
```text
[SOLID] Directly creates concrete dependency `new EmailSender()` for field `sender`, tightly coupling the class. Consider dependency injection.
```

### 2. Null-Handling Issue
```text
[null-handling] `customer.Address` is dereferenced without verifying that `customer` is non-null.
```

### 3. Async Correctness Issue
```text
[async] Avoid `.Result` on a Task (found `GetCustomerAsync().Result`) because it blocks asynchronous execution and may cause deadlocks.
```

---

## Project Structure

```text
pr-sentry/
├── .github/
│   └── workflows/
│       └── pr-sentry.yml    # GitHub Actions workflow definition
├── src/
│   ├── index.js             # Pipeline orchestrator
│   ├── github.js            # GitHub REST API interactions
│   ├── diffParser.js        # Unified diff hunk parser & C# filter
│   ├── reviewer.js          # Deterministic C# rules engine
│   ├── duplicateChecker.js  # Fingerprint calculator & duplicate filter
│   └── publisher.js         # Consolidated review formatter & publisher
├── tests/
│   ├── diffParser.test.js   # Diff parsing unit tests
│   ├── reviewer.test.js     # Rule detection unit tests
│   ├── duplicateChecker.test.js # Duplicate prevention unit tests
│   └── runTests.js          # Test runner script
├── fixtures/
│   └── sample-patches/      # Sample C# diff patches for testing
├── action.yml               # Action metadata declaration
├── package.json             # Dependencies and scripts
├── README.md                # Project documentation
└── REPORT.md                # Technical design & verification report
```

---

## Running Tests

Execute the automated test suite locally using Node.js:

```bash
npm test
```

Or run directly:

```bash
node tests/runTests.js
```

---

## How to Create a Test PR

1. Push PR Sentry to your GitHub repository.
2. Create a feature branch and modify or create a `.cs` file:
   ```csharp
   public class OrderService
   {
       private readonly EmailSender sender = new EmailSender(); // Triggers SOLID finding

       public async void ProcessOrder(Customer customer)    // Triggers async void finding
       {
           var name = customer.Name;                        // Triggers null-handling finding
           var taskResult = GetStatusAsync().Result;        // Triggers .Result finding
       }
   }
   ```
3. Open a Pull Request targetting `main`.
4. PR Sentry will trigger automatically and post inline comments on the exact added lines.

---

## Troubleshooting & Security

- **Missing Tokens**: Ensure `github-token: ${{ secrets.GITHUB_TOKEN }}` is passed to the Action step.
- **Zero Inline Comments Posted**: Verify that the PR modifies `.cs` files and contains added lines (`+`). Deleted or unchanged lines are intentionally not commented on.
- **No Token Storage**: PR Sentry does not store, log, or transmit tokens or code outside of GitHub Actions runner runtime environment.
- **Safe Exit**: Unsupported or malformed diffs are skipped without failing the pipeline.

---

## Limitations

- Scans newly added lines (`+`) within diff hunks; pre-existing lines around the diff are not scanned.
- Static analysis relies on deterministic pattern matching without full C# AST semantic compilation.
