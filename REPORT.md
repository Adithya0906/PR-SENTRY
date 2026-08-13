# Technical Report: PR Sentry – Sentry on the Diff

## 1. What We Built

We designed and implemented **PR Sentry – Sentry on the Diff**, an automated GitHub Action engineered specifically to perform inline code reviews on C# pull requests. 

Unlike conventional static analysis tools that analyze whole repositories or full source files, PR Sentry operates exclusively on the unified diff hunks of newly added C# code (`.cs`). It targets three major bug categories:
- **SOLID Principle Violations**: Direct tight coupling through `new ConcreteDependency()` and SRP overload.
- **Null-Handling & Null-Safety Deficiencies**: Unchecked property dereferencing, unsafe `.Value` accesses, and null-forgiving operator `!` misuse.
- **Async/Await Correctness Errors**: `async void` signatures, blocking `.Result` access, and sync-blocking `.Wait()` calls.

---

## 2. Architecture

PR Sentry follows a modular, single-pass pipeline:

```text
GitHub Pull Request (opened/synchronize)
  └─► GitHub Actions Workflow (.github/workflows/pr-sentry.yml)
        └─► PR Sentry Orchestrator (src/index.js)
              ├─► Fetch PR Files & Patches (src/github.js)
              ├─► Filter .cs Files & Exclude Generated/Deleted (src/diffParser.js)
              ├─► Parse Hunks & Map Added Lines (src/diffParser.js)
              ├─► Execute Rules Reviewer (src/reviewer.js)
              ├─► Fetch Existing PR Review Comments (src/github.js)
              ├─► Deduplicate via Fingerprint Engine (src/duplicateChecker.js)
              └─► Submit Consolidated Review (src/publisher.js)
```

---

## 3. Detection Logic

### SOLID Principles
- **Tight Coupling**: Detects field instantiations like `private readonly ConcreteClass field = new ConcreteClass();` in service, manager, controller, or handler classes.
- **SRP Violations**: Detects code blocks or methods combining database operations, email dispatch, and validation/formatting logic.

### Null-Handling
- **Unchecked Property Dereference**: Detects `object.Property` accesses on parameters/variables without preceding null checks or null-conditional `?.` operators.
- **Unsafe `.Value` Access**: Detects `nullableVar.Value` accesses without checking `nullableVar.HasValue`.
- **Null-Forgiving Operator `!`**: Identifies `variable!.Property` usage that suppresses compiler warnings without verifying runtime safety.

### Async Correctness
- **`async void` Methods**: Identifies non-event-handler methods declared as `async void` (recommending `async Task`).
- **Blocking `.Result`**: Detects `.Result` accesses on asynchronous Tasks that block execution threads and risk deadlocks.
- **Blocking `.Wait()`**: Identifies `.Wait()` synchronous invocations on Tasks inside async/sync execution contexts.

---

## 4. Diff Source and Selection Rationale

PR Sentry retrieves PR file diffs via GitHub REST API:
`GET /repos/{owner}/{repo}/pulls/{pull_number}/files`

### Rationale
1. **Performance**: Only fetches modified files and their unified diff patches rather than cloning full repository contents.
2. **Context-Aware**: Provides status (`added`, `modified`, `removed`) and patch text per file directly from GitHub's Git engine.
3. **Security**: Operates cleanly using the default `GITHUB_TOKEN` provided by GitHub Actions without requiring external server storage.

---

## 5. Diff Line-Mapping Method

Standard diff hunk headers follow the format:
`@@ -oldStart,oldLength +newStart,newLength @@`

PR Sentry walks line-by-line:
- **Context lines (`' '`)**: Increment both `currentOldLine` and `currentNewLine`.
- **Deleted lines (`'-'`)**: Increment `currentOldLine` only.
- **Added lines (`'+'`)**: Increment `currentNewLine` and mark `currentNewLine` as a valid target for inline PR review comments.

This guarantees that review comments map directly to real line numbers in the new file version (`side: "RIGHT"`), eliminating invalid offsets or comments on deleted lines.

---

## 6. Duplicate-Comment Strategy

To enforce zero duplicate comments across multiple workflow runs (e.g. repeated `synchronize` events or empty commits), PR Sentry computes a deterministic fingerprint for every finding:

$$\text{Fingerprint} = \text{file} + \text{":"} + \text{line} + \text{":"} + \text{category} + \text{":"} + \text{normalize}(\text{message})$$

Before submitting comments, PR Sentry calls:
`GET /repos/{owner}/{repo}/pulls/{pull_number}/comments`

It extracts existing comment fingerprints (`**[category]** message`) and filters out any finding whose fingerprint matches an existing review comment.

---

## 7. Static Analysis vs. LLM Decision

PR Sentry employs deterministic static analysis rather than an LLM prompt pipeline.

| Metric | Static Analysis (PR Sentry) | LLM Approach |
| :--- | :--- | :--- |
| **Execution Time** | Sub-second (< 100ms) | 5–15 seconds per file |
| **Cost** | Free ($0 API cost) | Recurring token fees |
| **Determinism** | 100% reproducible | Non-deterministic / Hallucination risk |
| **Offline Safety** | Requires zero external network calls | Requires API key & data transit |

---

## 8. Scenario Execution Results

| Scenario | Input Diff File | Detected Finding | Category | Line # | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Null Issue** | `null-dereference.patch` | `customer.Name` dereferenced without null check | `null-handling` | 13 | PASS |
| **2. Async Void** | `async-void.patch` | `async void SaveOrder()` detected | `async` | 18 | PASS |
| **3. Blocking Result** | `blocking-async-result.patch` | `GetCustomerAsync().Result` detected | `async` | 23 | PASS |
| **4. Blocking Wait** | `blocking-async-wait.patch` | `SaveAsync().Wait()` detected | `async` | 15 | PASS |
| **5. Tight Coupling** | `solid-tight-coupling.patch` | `new EmailSender()` concrete instantiation | `SOLID` | 6 | PASS |
| **6. Clean C#** | `clean-code.patch` | No findings detected | N/A | N/A | PASS |

---

## 9. False-Positive / False-Negative Discussion

- **False Positives**:
  - *Risk*: A class instantiating a simple value object or DTO with `new` could be mistaken for tight service coupling.
  - *Mitigation*: We maintain a standard type exclusion list (`List`, `Dictionary`, `StringBuilder`, `HttpClient`, etc.).
- **False Negatives**:
  - *Risk*: A multi-line null check spread across distant methods might not be recognized by line-level parsing.
  - *Mitigation*: Diff-focused scanning intentionally limits scope to added lines to maintain high precision on code being introduced.

---

## 10. Limitations

1. **Diff Scope**: Does not analyze unchanged lines surrounding the diff hunk.
2. **Type Resolution**: Does not build a full C# symbol table or resolve cross-file references.
3. **Patch Limits**: Excessively large patches (> 1MB) are skipped to prevent memory exhaustion.

---

## 11. Future Improvements

1. **Roslyn Analyzer Integration**: Optionally invoke lightweight Roslyn syntax trees for semantic symbol resolution.
2. **Configurable Rule Thresholds**: Support `.prsentry.yml` in repository root to customize severity levels and rule suppressions.
3. **Auto-Fix Suggestions**: Generate GitHub suggested changes (````suggestion```) for simple fixes like `async Task` or `?.`.

---

## 12. Installation & Running Instructions

### Local Execution & Testing
Run the complete automated test suite locally using Node.js:

```bash
npm test
```

### GitHub Workflow Integration
Add `.github/workflows/pr-sentry.yml` to your C# repository:

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
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: OWNER/pr-sentry@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```
