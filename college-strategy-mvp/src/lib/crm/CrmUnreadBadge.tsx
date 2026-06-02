type Props = {
  count: number;
  className?: string;
  label?: string;
};

export function CrmUnreadBadge({ count, className, label }: Props) {
  if (count <= 0) return null;
  const display = count > 99 ? "99+" : String(count);
  return (
    <span
      className={`crm-unread-badge${className ? ` ${className}` : ""}`}
      aria-label={label}
      title={label}
    >
      {display}
    </span>
  );
}
