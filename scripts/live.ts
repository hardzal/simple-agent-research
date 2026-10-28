import {
  LiveProbeFailure,
  runLiveProbe,
} from "../src/compatibility/live-probe.js";
import { runLiveSearch } from "../src/compatibility/live-search.js";

const args = process.argv.slice(2);
const caseId = args[1] === "LIVE-02" ? "LIVE-02" : "LIVE-01";

try {
  const run = caseId === "LIVE-02" ? runLiveSearch : runLiveProbe;
  console.log(JSON.stringify(await run(args, process.env)));
} catch (error) {
  const safeCategories = [
    "LIVE_CASE",
    "ALLOW_LIVE_TESTS",
    "LIVE_BUDGET",
    "LIVE_REPLAY",
    "LIVE_OPT_IN",
    "TAVILY_API_KEY",
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
            caseId,
            outcome: "failed",
            errorType: category,
          },
    ),
  );
  process.exitCode = 1;
}
