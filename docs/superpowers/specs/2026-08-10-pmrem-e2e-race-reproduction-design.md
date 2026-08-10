# PMREM E2E Race Reproduction Design

## Goal

Produce a deterministic failing `webgpu_pmrem_cubemap` E2E run that matches the historical CI symptom: a render timeout followed by an almost-black actual screenshot and a large pixel diff. Preserve the existing artifact upload so the actual, expected, and diff images can be inspected.

## Hypothesis

The deterministic RAF injection drops the renderer's first animation-frame request when WebGPU initialization finishes after the E2E runner has set `window._renderStarted` to `true`. With no scheduled frame, the example never calls `render()`. The runner suppresses the five-second render timeout and captures the untouched canvas.

## Reproduction

Add a temporary `window.TESTING`-only condition wait immediately before `renderer.setAnimationLoop( render )` in `webgpu_pmrem_cubemap.html`. The example waits until the runner has set `window._renderStarted` to `true`, then continues. This forces the renderer to request its first frame after the render gate opens, recreating the suspected ordering without relying on an arbitrary duration or affecting normal example usage.

Add narrowly scoped diagnostics that report:

- when the runner sets `_renderStarted`;
- whether RAF is requested before or after that point;
- whether the RAF callback executes;
- when the render timeout is reached.

The timeout remains non-fatal at that point so execution continues to the screenshot comparison. The expected red run must write `webgpu_pmrem_cubemap-actual.jpg`, `webgpu_pmrem_cubemap-expected.jpg`, and `webgpu_pmrem_cubemap-diff.jpg` for the existing artifact upload step.

## Success Criteria

The isolated GitHub Actions job must:

1. Log that `_renderStarted` became true before the first RAF request.
2. Log that the current injection discarded that request.
3. Reach the render timeout.
4. Fail the screenshot comparison with an almost-black actual image.
5. Upload all three screenshot artifacts.

## Scope

This phase changes only the PMREM example and E2E diagnostics. It does not modify PMREM generation, renderer behavior, pixel thresholds, reference screenshots, or unrelated examples. The artificial condition wait is temporary and will not be part of the final fix.

## Follow-up Fix Experiment

After the red run is confirmed, change the deterministic RAF injection so the first RAF requested after `_renderStarted` is scheduled asynchronously instead of discarded. Keep the artificial condition wait for one green verification run, then remove the wait and temporary diagnostics and verify the isolated test plus the normal CI shard.
