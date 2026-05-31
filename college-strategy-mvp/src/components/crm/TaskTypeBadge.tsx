import type { CrmTaskLinkType } from "../../lib/crm/types";

type Props = {
  linkType: CrmTaskLinkType;
  label: string;
};

export function TaskTypeBadge({ linkType, label }: Props) {
  return <span className={`crm-task-type-badge crm-task-type-badge--${linkType}`}>{label}</span>;
}

function taskItemClass(linkType: CrmTaskLinkType, done: boolean) {
  return [`crm-task--${linkType}`, done ? "is-done" : ""].filter(Boolean).join(" ");
}

export { taskItemClass };
