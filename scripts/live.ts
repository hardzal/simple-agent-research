import {
  LiveProbeFailure,
  runLiveProbe,
} from "../src/compatibility/live-probe.js";

try {
  console.log(
    JSON.stringify(await runLiveProbe(process.argv.slice(2), process.env)),
  );
} catch (error) {
  const safeCategories = [
    "LIVE_CASE",
    "ALLOW_LIVE_TESTS",
    "LIVE_BUDGET",
    "LIVE_REPLAY",
  ];
  const category =
    error instanceof Error && safeCategories.includes(error.message)
      ? error.message
      : "LIVE_PROBE_FAILED";
  console.error(
    JSON.stringify(
      error instanceof LiveProbeFailure
        ? error.evidence
        : {
            caseId: "LIVE-01",
            outcome: "failed",
            errorType: category,
          },
    ),
  );
  process.exitCode = 1;
}
