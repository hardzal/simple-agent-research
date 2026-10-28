import {
  LiveProbeFailure,
  runLiveProbe,
} from "../src/compatibility/live-probe.js";
import { runLiveSearch } from "../src/compatibility/live-search.js";
import { runLiveResearch } from "../src/compatibility/live-research.js";

const args = process.argv.slice(2);
const cases = {
  "LIVE-01": runLiveProbe,
  "LIVE-02": runLiveSearch,
  "LIVE-03": runLiveResearch,
};
const caseId =
  args[1] && Object.hasOwn(cases, args[1])
    ? (args[1] as keyof typeof cases)
    : "unknown";

try {
  if (caseId === "unknown") throw new Error("LIVE_CASE");
  const run = cases[caseId];
  console.log(JSON.stringify(await run(args, process.env)));
} catch (error) {
  const safeCategories = [
    "LIVE_CASE",
    "ALLOW_LIVE_TESTS",
    "LIVE_BUDGET",
    "LIVE_REPLAY",
    "LIVE_OPT_IN",
    "TAVILY_API_KEY",
    "OPENAI_API_KEY",
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
            outcome: [
              "ALLOW_LIVE_TESTS",
              "LIVE_OPT_IN",
              "TAVILY_API_KEY",
              "OPENAI_API_KEY",
            ].includes(category)
              ? "blocked"
              : "failed",
            errorType: category,
          },
    ),
  );
  process.exitCode = 1;
}
