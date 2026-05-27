/** OnlyApply 字标（`npm run build:onlyapply-logo`：public/onlyapply-logo-source.png → public/onlyapply-logo.png） */
export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <img
      src="/onlyapply-logo.png"
      alt="OnlyApply"
      width={887}
      height={167}
      className={`onlyapply-logo ${className}`.trim()}
      decoding="async"
    />
  );
}
