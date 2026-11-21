import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LandscapeGalleryEntry } from "@/domain/models";
import { DEMO_PROJECT } from "@/data/demo-project";
import { runLocalSchoolCommand } from "./school-class-dev-store";

const code = "ABCD1234";
const project = { ...DEMO_PROJECT, classCode: code, id: "local-class" };
const teacherHash = "a".repeat(64);
const editHash = "b".repeat(64);
let directory: string;

function run(command: Parameters<typeof runLocalSchoolCommand>[0], payload: Record<string, unknown> = {}) {
  return runLocalSchoolCommand(command, code, payload, directory);
}

function work(studentSessionId: string): LandscapeGalleryEntry {
  return {
    id: "work-" + studentSessionId, studentSessionId, schoolProjectId: project.id,
    nickname: studentSessionId, objects: [], intentionKeyword: "꽃", intentionReason: "봄의 색을 표현했습니다.",
    submittedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("local shared school classes", () => {
  beforeEach(async () => { directory = await mkdtemp(path.join(tmpdir(), "gardening-class-")); });
  afterEach(async () => { await rm(directory, { recursive: true, force: true }); });

  it("returns the first owner's room on retry and reserves codes across concurrent creates", async () => {
    expect(await run("get")).toEqual({ status: 404 });
    const results = await Promise.all(Array.from({ length: 5 }, () => run("create", { project, teacherHash })));
    expect(results.map(result => result.status).sort()).toEqual([200, 200, 200, 200, 201]);
    expect(await run("create", { project, teacherHash: editHash })).toEqual({ status: 409 });
    expect(await run("get")).toEqual({ status: 200, project });
  });

  it("keeps simultaneous submissions separate and allows only the original student to update", async () => {
    await run("create", { project, teacherHash });
    const entries = [work("one"), work("two")];
    const responses = await Promise.all(entries.map(entry => run("submit", { entry, editHash })));
    expect(responses).toEqual([{ status: 200 }, { status: 200 }]);
    expect(await run("submit", { entry: { ...entries[0], schoolProjectId: "other" }, editHash })).toEqual({ status: 400 });
    expect(await run("submit", { entry: entries[0], editHash: teacherHash })).toEqual({ status: 403 });
    const updated = { ...entries[0], submittedAt: "2026-01-02T00:00:00.000Z", intentionReason: "나무도 심었어요." };
    expect(await run("submit", { entry: updated, editHash })).toEqual({ status: 200 });
    expect(await run("list")).toEqual({ status: 200, entries: [updated, entries[1]] });
  });
});
