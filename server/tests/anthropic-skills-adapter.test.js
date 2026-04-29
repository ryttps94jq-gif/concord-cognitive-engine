// server/tests/anthropic-skills-adapter.test.js
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  importAnthropicSkill,
  importAnthropicSkillDir,
  exportToAnthropicFormat,
  importAnthropicSkillTree,
  writeSkillToRegistry,
} from "../lib/skills/anthropic-skills-adapter.js";

let tmpDir;

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "concord-skills-test-"));
});

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const SAMPLE_SKILL_MD = `---
name: web-search
description: Search the web for current information
when-to-use: When the user asks about recent events or needs up-to-date information
category: domain
loads: eager
---

# Web Search Skill

Use this skill to retrieve current information from the web.

## Instructions

Call the search tool with a clear, concise query.
`;

describe("Anthropic Skills Adapter", () => {
  test("imports valid Anthropic SKILL.md", () => {
    const skillPath = path.join(tmpDir, "SKILL.md");
    fs.writeFileSync(skillPath, SAMPLE_SKILL_MD);

    const result = importAnthropicSkill(skillPath);
    assert.ok(result);
    assert.equal(result.name, "web-search");
    assert.ok(result.emergentMd.includes("name: web-search"));
    assert.ok(result.emergentMd.includes("when_to_use:"));
  });

  test("importAnthropicSkillDir finds SKILL.md in directory", () => {
    const skillDir = path.join(tmpDir, "my-skill");
    fs.mkdirSync(skillDir);
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), SAMPLE_SKILL_MD);

    const result = importAnthropicSkillDir(skillDir);
    assert.ok(result);
    assert.equal(result.name, "web-search");
  });

  test("imported skill has Concord EMERGENT.md frontmatter fields", () => {
    const skillPath = path.join(tmpDir, "SKILL2.md");
    fs.writeFileSync(skillPath, SAMPLE_SKILL_MD);

    const result = importAnthropicSkill(skillPath);
    assert.ok(result.emergentMd.includes("name:"));
    assert.ok(result.emergentMd.includes("description:"));
    assert.ok(result.emergentMd.includes("when_to_use:"));
    assert.ok(result.emergentMd.includes("loads:"));
    assert.ok(result.emergentMd.includes("category:"));
    assert.ok(result.emergentMd.includes("source: anthropic_import"));
  });

  test("exports Concord EMERGENT.md to Anthropic format", () => {
    const emergentPath = path.join(tmpDir, "EMERGENT.md");
    const emergentContent = `---
name: constitutional-check
description: Verify sovereignty invariants
when_to_use: Before cross-user operations
loads: eager
category: core
---

# Constitutional Check

Check invariants.
`;
    fs.writeFileSync(emergentPath, emergentContent);

    const result = exportToAnthropicFormat(emergentPath);
    assert.ok(result);
    assert.ok(result.includes("name: constitutional-check"));
    assert.ok(result.includes("when-to-use:"));
    assert.ok(!result.includes("when_to_use:"), "should use Anthropic hyphenated form");
  });

  test("returns null for SKILL.md without name field", () => {
    const skillPath = path.join(tmpDir, "SKILL_BAD.md");
    fs.writeFileSync(skillPath, "---\ndescription: no name here\n---\nBody");

    const result = importAnthropicSkill(skillPath);
    assert.equal(result, null);
  });

  test("importAnthropicSkillTree finds all SKILL.md recursively", () => {
    const treeDir = path.join(tmpDir, "tree");
    fs.mkdirSync(path.join(treeDir, "skill-a"), { recursive: true });
    fs.mkdirSync(path.join(treeDir, "skill-b"), { recursive: true });
    fs.writeFileSync(path.join(treeDir, "skill-a", "SKILL.md"), `---\nname: skill-a\ndescription: A\n---\nBody A`);
    fs.writeFileSync(path.join(treeDir, "skill-b", "SKILL.md"), `---\nname: skill-b\ndescription: B\n---\nBody B`);

    const results = importAnthropicSkillTree(treeDir);
    assert.equal(results.length, 2);
    const names = results.map(r => r.name).sort();
    assert.deepEqual(names, ["skill-a", "skill-b"]);
  });

  test("writeSkillToRegistry creates EMERGENT.md in target directory", () => {
    const registryDir = path.join(tmpDir, "registry");
    const skill = {
      name: "my-test-skill",
      description: "Test skill",
      emergentMd: "---\nname: my-test-skill\ndescription: Test skill\n---\nBody",
    };

    const outPath = writeSkillToRegistry(skill, registryDir);
    assert.ok(fs.existsSync(outPath));
    const content = fs.readFileSync(outPath, "utf-8");
    assert.ok(content.includes("name: my-test-skill"));
  });

  test("SkillRegistry scan() alias works", async () => {
    const { skillRegistry } = await import("../lib/agentic/skills.js");
    assert.equal(typeof skillRegistry.scan, "function");
    await assert.doesNotReject(() => skillRegistry.scan());
  });
});
