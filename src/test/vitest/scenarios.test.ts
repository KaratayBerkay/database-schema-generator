import { describe, it, expect } from "vitest";
import { getSchema } from "@mrleebo/prisma-ast";
import { caller } from "./helpers";
import { readProjectVersionGraph } from "@/lib/schema-db/graph";
import { renderPrismaSchemaFromGraph } from "@/lib/schema-renderers/prisma";

const nameFor = (title: string) => `${title} Demo`;

describe("scenarios", () => {
  it("lists basic and advanced scenarios with computed counts (none loaded yet)", async () => {
    const list = await caller.scenarios.list();
    const ids = list.map((s) => s.id).sort();
    expect(ids).toEqual([
      "blog-platform",
      "ecommerce-shop",
      "inventory-control",
      "saas-billing",
      "task-tracker",
    ]);
    expect(list.every((s) => s.loaded === null)).toBe(true);

    const basic = list.filter((s) => s.category === "basic").map((s) => s.id).sort();
    const advanced = list.filter((s) => s.category === "advanced").map((s) => s.id).sort();
    expect(basic).toEqual(["blog-platform", "ecommerce-shop", "task-tracker"]);
    expect(advanced).toEqual(["inventory-control", "saas-billing"]);

    const blog = list.find((s) => s.id === "blog-platform")!;
    expect(blog.tableCount).toBe(6);
    expect(blog.enumCount).toBe(2);
    expect(blog.relationCount).toBe(6);
    expect(blog.versionCount).toBe(1);

    const saas = list.find((s) => s.id === "saas-billing")!;
    expect(saas.versionCount).toBe(3);
    expect(saas.tableCount).toBe(3);
    expect(saas.relationCount).toBe(2);

    const inventory = list.find((s) => s.id === "inventory-control")!;
    expect(inventory.versionCount).toBe(2);
  });

  it("loads every scenario into a fresh project; all versions render to valid Prisma", async () => {
    const list = await caller.scenarios.list();

    for (const scenario of list) {
      const projectName = nameFor(scenario.title);
      const result = await caller.scenarios.load({ scenarioId: scenario.id, projectName });
      expect(result.projectName).toBe(projectName);
      // Advanced scenarios always land on v1.
      expect(result.version).toBe("1.0111");

      const projects = await caller.projects.list();
      const created = projects.find((p) => p.name === projectName)!;
      expect(created.id).toBe(result.projectId);
      expect(created.versions.length).toBe(scenario.versionCount);

      // Every version's schema must render and re-parse cleanly.
      for (const version of created.versions) {
        const graph = readProjectVersionGraph(projectName, version.name);
        const prisma = renderPrismaSchemaFromGraph(graph);
        expect(() => getSchema(prisma)).not.toThrow();
        expect(prisma).not.toMatch(/UnknownType/);
      }

      // v1 counts match the summary.
      const v1 = readProjectVersionGraph(projectName, "1.0111");
      expect(v1.tables.length).toBe(scenario.tableCount);
      expect(v1.enums.length).toBe(scenario.enumCount);
      expect(v1.relations.length).toBe(scenario.relationCount);
    }
  });

  it("marks loaded scenarios and rejects a second load", async () => {
    const list = await caller.scenarios.list();
    expect(list.every((s) => s.loaded !== null)).toBe(true);
    const blog = list.find((s) => s.id === "blog-platform")!;
    expect(blog.loaded!.projectName).toBe(nameFor("Blog Platform"));

    await expect(
      caller.scenarios.load({ scenarioId: "blog-platform", projectName: "Different Name Here" }),
    ).rejects.toThrow(/already loaded/i);
  });

  it("evolves the SaaS Billing schema across three versions", async () => {
    const projectName = nameFor("SaaS Billing");
    const projects = await caller.projects.list();
    const saas = projects.find((p) => p.name === projectName)!;
    const versions = saas.versions.map((v) => v.name);
    expect(versions).toEqual(["1.0111", "1.0112", "1.0113"]);

    const v1 = renderPrismaSchemaFromGraph(readProjectVersionGraph(projectName, "1.0111"));
    const v2 = renderPrismaSchemaFromGraph(readProjectVersionGraph(projectName, "1.0112"));
    const v3 = renderPrismaSchemaFromGraph(readProjectVersionGraph(projectName, "1.0113"));

    // v1 has the boolean `paid`; v2 adds Coupon; v3 swaps paid for an enum.
    expect(v1).toMatch(/paid\s+Boolean/);
    expect(v1).not.toContain("model Coupon {");
    expect(v2).toContain("model Coupon {");
    expect(v3).toContain("enum InvoiceStatus {");
    expect(v3).not.toMatch(/paid\s+Boolean/);
    // The renamed Subscription column.
    expect(v1).toMatch(/startedAt\s+DateTime/);
    expect(v3).toMatch(/activatedAt\s+DateTime/);
  });

  it("re-loads a scenario, resetting it under the same name", async () => {
    const projectName = nameFor("Blog Platform");
    const before = (await caller.projects.list()).find((p) => p.name === projectName)!;

    const result = await caller.scenarios.reload({ scenarioId: "blog-platform" });
    expect(result.projectName).toBe(projectName);

    const after = (await caller.projects.list()).find((p) => p.name === projectName)!;
    // Fresh project (delete + recreate) but same name, and still marked loaded.
    expect(after.id).toBe(result.projectId);
    expect(after.id).not.toBe(before.id);

    const list = await caller.scenarios.list();
    expect(list.find((s) => s.id === "blog-platform")!.loaded!.projectName).toBe(projectName);
  });

  it("clears the loaded mark when the project is deleted", async () => {
    const projectName = nameFor("Task Tracker");
    const project = (await caller.projects.list()).find((p) => p.name === projectName)!;

    await caller.projects.delete({ id: project.id });

    const list = await caller.scenarios.list();
    expect(list.find((s) => s.id === "task-tracker")!.loaded).toBeNull();
  });

  it("keys remove/reload on project id, supporting a custom project name", async () => {
    // task-tracker was un-loaded by the delete test above, so it's loadable again.
    const customName = "Totally Custom Name";
    const loadRes = await caller.scenarios.load({ scenarioId: "task-tracker", projectName: customName });
    expect(loadRes.projectName).toBe(customName);

    // The loaded mark carries the real project id and the custom name (not the title).
    const afterLoad = (await caller.scenarios.list()).find((s) => s.id === "task-tracker")!;
    expect(afterLoad.loaded).toEqual({ projectId: loadRes.projectId, projectName: customName });

    // Re-load preserves the custom name while producing a fresh project id.
    const reloadRes = await caller.scenarios.reload({ scenarioId: "task-tracker" });
    expect(reloadRes.projectName).toBe(customName);
    expect(reloadRes.projectId).not.toBe(loadRes.projectId);

    // Removing by the project id (what the UI passes) clears the mark — name irrelevant.
    const loadedId = (await caller.scenarios.list()).find((s) => s.id === "task-tracker")!.loaded!.projectId;
    await caller.projects.delete({ id: loadedId });
    expect((await caller.scenarios.list()).find((s) => s.id === "task-tracker")!.loaded).toBeNull();
  });

  it("rejects unknown scenario ids on load and reload", async () => {
    await expect(
      caller.scenarios.load({ scenarioId: "does-not-exist", projectName: "Nope Project Name" }),
    ).rejects.toThrow();
    await expect(caller.scenarios.reload({ scenarioId: "does-not-exist" })).rejects.toThrow();
  });
});
