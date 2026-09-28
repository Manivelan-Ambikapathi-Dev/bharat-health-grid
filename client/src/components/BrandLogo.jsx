import './BrandLogo.css';

function Mark({ title }) {
  return (
    <svg className="bhg-logo-mark" viewBox="0 0 64 64" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title ? <title>{title}</title> : null}
      <rect x="1" y="1" width="62" height="62" rx="16" className="bhg-logo-plate" />
      <path
        className="bhg-logo-land"
        d="M30 13c5-.4 10 1.2 13 5.2 2.2 3 2.6 6.4 4.2 9.2 1.8 3.2.6 6.4-1.4 8.8-1.6 4.6-4.2 8.8-8.6 11.2-2.2 1.2-4.4.2-5.6-1.6-1.6-3.2-2.2-7-4.2-9.8-2.4-3.2-6.2-4.6-7.2-8.4-1-4 1.2-8.2 4.6-10.8 1.8-1.4 3.6-2.4 5.2-3.8z"
      />
      <path className="bhg-logo-link" d="M18 24h10M36 24h10M22 44h8M36 42h8M28 22v8M36 30v12" />
      <circle className="bhg-logo-node" cx="18" cy="24" r="2.2" />
      <circle className="bhg-logo-node" cx="46" cy="24" r="2.2" />
      <circle className="bhg-logo-node" cx="22" cy="44" r="2.2" />
      <circle className="bhg-logo-node" cx="44" cy="42" r="2.2" />
      <path className="bhg-logo-cross" d="M32 22v16M24 30h16" />
    </svg>
  );
}

function BrandLogo({ variant = 'full', className = '' }) {
  const compact = variant === 'compact';
  const tone = variant === 'light' ? 'light' : 'dark';
  const classes = `bhg-logo bhg-logo--${tone}${compact ? ' bhg-logo--compact' : ''} ${className}`.trim();

  if (compact) {
    return (
      <span className={classes}>
        <Mark title="Bharat Health Grid" />
      </span>
    );
  }

  return (
    <span className={classes}>
      <Mark />
      <span className="bhg-logo-word">
        <span className="bhg-logo-bharat">Bharat</span>
        <span className="bhg-logo-grid">Health Grid</span>
      </span>
    </span>
  );
}

export default BrandLogo;
