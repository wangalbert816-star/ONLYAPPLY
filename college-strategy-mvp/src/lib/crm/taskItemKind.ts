import type { CrmTask, CrmTaskItemKind } from "./types";

export function normalizeTaskItemKind(kind?: CrmTaskItemKind): CrmTaskItemKind {
  return kind === "resource" ? "resource" : "action";
}

export function isTaskResource(task: Pick<CrmTask, "itemKind">): boolean {
  return normalizeTaskItemKind(task.itemKind) === "resource";
}

export function isTaskAction(task: Pick<CrmTask, "itemKind">): boolean {
  return !isTaskResource(task);
}
