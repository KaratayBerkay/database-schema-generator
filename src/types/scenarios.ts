// Shared types for the Scenarios workflow (server store + client view).

export type ScenarioLoadedInfo = { projectId: string; projectName: string };

export type ScenarioSummary = {
  id: string;
  title: string;
  category: "basic" | "advanced";
  provider: string;
  accent: string;
  summary: string;
  highlights: string[];
  exploreNext: { label: string; href: string }[];
  tableCount: number;
  fieldCount: number;
  relationCount: number;
  enumCount: number;
  versionCount: number;
  /** Non-null when a demo project created from this scenario currently exists. */
  loaded: ScenarioLoadedInfo | null;
};

export type LoadScenarioResult = {
  projectId: string;
  projectName: string;
  /** The version a user lands on — always v1. */
  version: string;
};

/** Per-card action callbacks passed from the Scenarios view down to ScenarioCard. */
export type ScenarioCardHandlers = {
  onLoad: (scenarioId: string, name: string) => void;
  onReload: (scenarioId: string) => void;
  onRemove: (scenarioId: string, projectId: string) => void;
  onOpen: (projectId: string) => void;
};
