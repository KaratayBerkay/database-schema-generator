import { describe, it, expect } from "vitest";
import { getSchema } from "@mrleebo/prisma-ast";
import { caller } from "./helpers";
import { readProjectVersionGraph } from "@/lib/schema-db/graph";
import { renderPrismaSchemaFromGraph } from "@/lib/schema-renderers/prisma";

describe("scenarios", () => {
  it("lists the authored scenarios with computed counts", async () => {
    const list = await caller.scenarios.list();
    const ids = list.map((s) => s.id).sort();
    expect(ids).toEqual(["blog-platform", "ecommerce-shop", "task-tracker"]);

    const blog = list.find((s) => s.id === "blog-platform")!;
    expect(blog.tableCount).toBe(6);
    expect(blog.enumCount).toBe(2);
    expect(blog.relationCount).toBe(6);
    expect(blog.provider).toBe("PostgreSQL");

    const shop = list.find((s) => s.id === "ecommerce-shop")!;
    expect(shop.provider).toBe("MySQL");
    expect(shop.tableCount).toBe(5);
  });

  it("loads each scenario into a fresh project with a valid, parseable schema", async () => {
    const list = await caller.scenarios.list();

    for (const scenario of list) {
      const projectName = `${scenario.title} Demo`;
      const result = await caller.scenarios.load({
        scenarioId: scenario.id,
        projectName,
      });
      expect(result.projectName).toBe(projectName);

      // The created project must be discoverable through the normal project list.
      const projects = await caller.projects.list();
      const created = projects.find((p) => p.name === projectName);
      expect(created).toBeTruthy();
      expect(created!.id).toBe(result.projectId);

      const graph = readProjectVersionGraph(projectName, result.version);
      expect(graph.tables.length).toBe(scenario.tableCount);
      expect(graph.enums.length).toBe(scenario.enumCount);
      // Each owner relation produces exactly one relation row.
      expect(graph.relations.length).toBe(scenario.relationCount);

      // Rendering to Prisma and re-parsing it proves every relation, enum, and
      // type resolved — a mis-wired FK or dangling enum would break parsing.
      const prisma = renderPrismaSchemaFromGraph(graph);
      expect(() => getSchema(prisma)).not.toThrow();
      // No unresolved relation targets leaked into the output.
      expect(prisma).not.toMatch(/UnknownType|undefined/);
    }
  });

  it("wires the blog platform relations and enums correctly", async () => {
    const projectName = "Blog Platform Relations";
    const result = await caller.scenarios.load({
      scenarioId: "blog-platform",
      projectName,
    });

    const graph = readProjectVersionGraph(projectName, result.version);
    const prisma = renderPrismaSchemaFromGraph(graph);

    // Models present
    for (const model of ["User", "Post", "Category", "Comment", "Tag", "PostTag"]) {
      expect(prisma).toContain(`model ${model} {`);
    }
    // Enums present and used
    expect(prisma).toContain("enum PostStatus {");
    expect(prisma).toContain("enum UserRole {");
    // The owning FK relation carries fields/references
    expect(prisma).toMatch(/@relation\([^)]*fields:\s*\[authorId\][^)]*references:\s*\[id\]/);
    // The many-to-many join table's composite unique survived
    expect(prisma).toMatch(/@@unique\(\[postId, tagId\]/);

    const unique = await caller.scenarios.load({ scenarioId: "blog-platform", projectName }).catch((e) => e);
    expect(unique).toBeInstanceOf(Error);
  });

  it("rejects an unknown scenario id", async () => {
    await expect(
      caller.scenarios.load({ scenarioId: "does-not-exist", projectName: "Nope Project Name" }),
    ).rejects.toThrow();
  });
});
