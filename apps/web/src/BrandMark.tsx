export function BrandMark({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand-mark${small ? " small" : ""}`} aria-hidden="true">
      <img className="brand-light" src="/brand/orca-light.png" alt="" />
      <img className="brand-dark" src="/brand/orca-dark.png" alt="" />
    </span>
  );
}
