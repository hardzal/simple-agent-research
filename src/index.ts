export { createResearchRuntime } from "./application/research-runner.js";
export {
  createResearchAgent,
  type ResearchDependencies,
} from "./agent/research.agent.js";
export { createScopedStudio } from "./application/scoped-studio.js";
export { parseConfig, type AppConfig } from "./config/index.js";
export type { ResearchResponse } from "./schemas/research.js";
