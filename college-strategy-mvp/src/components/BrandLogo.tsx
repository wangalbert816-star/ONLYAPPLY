/** OnlyApply 字标（生成自 public/onlyapply-logo-source.png → public/onlyapply-logo.png） */
export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <img
      src="/onlyapply-logo.png"
      alt="OnlyApply"
      width={531}
      height={106}
      className={`onlyapply-logo ${className}`.trim()}
      decoding="async"
    />
  );
}
