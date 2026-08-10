# PMREM E2E Race Reproduction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Force and diagnose the suspected late-first-RAF race in `webgpu_pmrem_cubemap`, producing a red CI run with actual, expected, and diff artifacts.

**Architecture:** Keep the experiment test-only. The PMREM example waits for the E2E render gate before registering its animation loop, while the deterministic RAF injection and runner log the resulting request ordering and timeout. The existing screenshot comparison and artifact upload remain responsible for proving the visible failure.

**Tech Stack:** JavaScript, Puppeteer, GitHub Actions, three.js WebGPURenderer E2E harness.

---

### Task 1: Add RAF and render-gate diagnostics

**Files:**
- Modify: `test/e2e/deterministic-injection.js:24-50`
- Modify: `test/e2e/puppeteer.js:464-510`

- [ ] **Step 1: Record and print RAF state transitions**

Add a trace array and helper after the render flags in `deterministic-injection.js`:

```js
window._e2eRAFTrace = [];

function traceRAF( event ) {

	const entry = {
		event,
		time: window.performance._now(),
		renderStarted: window._renderStarted,
		renderFinished: window._renderFinished
	};

	window._e2eRAFTrace.push( entry );
	console.log( `[E2E RAF] ${ event } started=${ entry.renderStarted } finished=${ entry.renderFinished }` );

}
```

Call `traceRAF( 'request' )` at the start of the RAF override, `traceRAF( 'callback' )` immediately before `cb( now() )`, and `traceRAF( 'discarded-after-start' )` when a request arrives after `_renderStarted` is already true.

- [ ] **Step 2: Log the gate opening and suppressed timeout**

Immediately before setting `_renderStarted`, add:

```js
console.log( '[E2E RAF] render gate opened' );
window._renderStarted = true;
```

Restore the existing timeout warning branch without changing control flow:

```js
} else {

	console.yellow( `Render timeout exceeded in file ${ file }` );

}
```

- [ ] **Step 3: Lint the diagnostic changes**

Run:

```bash
npx eslint test/e2e/deterministic-injection.js test/e2e/puppeteer.js
```

Expected: exit code 0 with no ESLint errors.

- [ ] **Step 4: Commit the diagnostics**

```bash
git add test/e2e/deterministic-injection.js test/e2e/puppeteer.js
git commit -m "E2E: Trace deterministic RAF timing"
```

### Task 2: Force the late-first-RAF ordering

**Files:**
- Modify: `examples/webgpu_pmrem_cubemap.html:54-55`

- [ ] **Step 1: Add the test-only condition wait**

Insert this block immediately before `renderer.setAnimationLoop( render )`:

```js
if ( window.TESTING ) {

	await new Promise( resolve => {

		const intervalId = setInterval( () => {

			if ( window._renderStarted === true ) {

				clearInterval( intervalId );
				resolve();

			}

		}, 10 );

	} );

}
```

This forces `renderer.setAnimationLoop( render )` to run only after the E2E gate is open.

- [ ] **Step 2: Lint the modified example**

Run:

```bash
npx eslint examples/webgpu_pmrem_cubemap.html
```

Expected: exit code 0 with no ESLint errors.

- [ ] **Step 3: Inspect the complete experiment diff**

Run:

```bash
git diff --check
git diff upstream/dev -- test/e2e/deterministic-injection.js test/e2e/puppeteer.js examples/webgpu_pmrem_cubemap.html
```

Expected: no whitespace errors; the diff contains only the condition wait and diagnostics described above.

- [ ] **Step 4: Commit the reproduction**

```bash
git add examples/webgpu_pmrem_cubemap.html
git commit -m "E2E: Reproduce late PMREM animation frame"
```

### Task 3: Verify the red CI run and artifacts

**Files:**
- Verify: `.github/workflows/ci.yml:45-82`
- Inspect: `test/e2e/output-screenshots/` from the GitHub Actions artifact

- [ ] **Step 1: Confirm the workflow still targets only PMREM cubemap**

Run:

```bash
git diff upstream/dev -- .github/workflows/ci.yml
```

Expected: matrix `CI` contains only `4`, and the E2E command passes `webgpu_pmrem_cubemap`.

- [ ] **Step 2: Push the experiment branch**

```bash
git push origin pailhead/fix-ci
```

Expected: GitHub reports the branch updated and starts PR #4 checks.

- [ ] **Step 3: Monitor the E2E check**

Run:

```bash
gh pr checks 4 --repo pailhead/three.js --watch
```

Expected: the E2E check fails while unrelated checks may pass.

- [ ] **Step 4: Verify the diagnostic ordering in the failed log**

Read the failed E2E job log and confirm this ordering:

```text
[E2E RAF] render gate opened
[E2E RAF] request started=true
[E2E RAF] discarded-after-start
Render timeout exceeded in file webgpu_pmrem_cubemap
Diff wrong in 99.8% of pixels in file: webgpu_pmrem_cubemap
```

- [ ] **Step 5: Download and inspect the artifact**

Download `Output screenshots-ubuntu-latest-4` from the failed run and verify it contains:

```text
webgpu_pmrem_cubemap-actual.jpg
webgpu_pmrem_cubemap-expected.jpg
webgpu_pmrem_cubemap-diff.jpg
```

Expected: actual is almost black, expected is the reference PMREM scene, and diff is predominantly red.
