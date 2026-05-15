/** OnlyApply 字标（资源在 public/onlyapply-logo.png） */
export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <img
      src="/onlyapply-logo.png"
      alt="OnlyApply"
      width={220}
      height={48}
      className={`onlyapply-logo ${className}`.trim()}
      decoding="async"
    />
  );
}
