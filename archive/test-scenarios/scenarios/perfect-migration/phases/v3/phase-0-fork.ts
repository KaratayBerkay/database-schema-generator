import { api, PROJECT_NAME, V1_VERSION } from "../../client";

export async function forkToV3(): Promise<string> {
  const projects = await api.projects.list();
  const project = projects.find((p) => p.name === PROJECT_NAME);
  if (!project) throw new Error(`Project "${PROJECT_NAME}" not found — run v1 and v2 phases first.`);

  // Versions are ordered: [v1, v2, v3?, ...]. v2 is index 1 (after v1 at index 0).
  const v1Idx = project.versions.findIndex((v) => v.name === V1_VERSION);
  if (v1Idx === -1) throw new Error(`V1 version "${V1_VERSION}" not found — run v1 phases first.`);

  const v2 = project.versions[v1Idx + 1];
  if (!v2) throw new Error("V2 version not found — run v2 phases first.");

  const versionsAfterV2 = project.versions.slice(v1Idx + 2);
  if (versionsAfterV2.length > 0) {
    const v3 = versionsAfterV2[0].name;
    console.log(`  ✓ V3 already forked: ${v3} — skipping.`);
    return v3;
  }

  const result = await api.projects.forkVersion({ projectId: project.id });
  console.log(`  ✓ Forked ${v2.name} → ${result.newVersion}`);
  return result.newVersion;
}
