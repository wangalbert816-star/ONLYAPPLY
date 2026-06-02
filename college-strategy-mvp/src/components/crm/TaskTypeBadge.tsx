import type { CrmTaskItemKind, CrmTaskLinkType } from "../../lib/crm/types";
import { isTaskResource } from "../../lib/crm/taskItemKind";

type Props = {
  linkType: CrmTaskLinkType;
  itemKind?: CrmTaskItemKind;
  label: string;
  resourceLabel?: string;
};

export function TaskTypeBadge({ linkType, itemKind, label, resourceLabel }: Props) {
  if (isTaskResource({ itemKind })) {
    return (
      <span className="crm-task-type-badge crm-task-type-badge--resource">{resourceLabel ?? label}</span>
    );
  }
  return <span className={`crm-task-type-badge crm-task-type-badge--${linkType}`}>{label}</span>;
}

function taskItemClass(
  task: { linkType: CrmTaskLinkType; itemKind?: CrmTaskItemKind; status?: "open" | "done" },
) {
  if (isTaskResource(task)) return "crm-task--resource";
  const done = task.status === "done";
  return [`crm-task--${task.linkType}`, done ? "is-done" : ""].filter(Boolean).join(" ");
}

export { taskItemClass };
