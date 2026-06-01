import type { CrmStoredFile, CrmTask } from "./types";

const TASK_SUBMISSION_CATEGORY = "task-submission";

/** Resolve files the student turned in for a task (submitted_file_ids + file.task_id). */
export function resolveTaskSubmissions(task: CrmTask, files: CrmStoredFile[]): CrmStoredFile[] {
  const ids = new Set<string>();
  for (const id of task.submittedFileIds ?? []) ids.add(id);
  for (const f of files) {
    if (f.taskId === task.id) ids.add(f.id);
  }
  const byId = new Map(files.map((f) => [f.id, f]));
  return [...ids].map((id) => byId.get(id)).filter((f): f is CrmStoredFile => Boolean(f));
}

/** Legacy rows: student upload saved before submitted_file_ids existed (category only). */
export function orphanTaskSubmissionFiles(tasks: CrmTask[], files: CrmStoredFile[]): CrmStoredFile[] {
  const linked = new Set<string>();
  for (const task of tasks) {
    for (const f of resolveTaskSubmissions(task, files)) linked.add(f.id);
  }
  return files.filter(
    (f) =>
      f.uploadedByRole === "student" &&
      f.category === TASK_SUBMISSION_CATEGORY &&
      !linked.has(f.id),
  );
}

export function isTaskSubmissionReturned(task: CrmTask): boolean {
  return Boolean(task.returnedAt);
}

export function allTaskSubmissionFiles(tasks: CrmTask[], files: CrmStoredFile[]): CrmStoredFile[] {
  const ids = new Set<string>();
  for (const task of tasks) {
    for (const f of resolveTaskSubmissions(task, files)) ids.add(f.id);
  }
  return files.filter((f) => ids.has(f.id));
}
