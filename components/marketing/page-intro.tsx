/** Title block for marketing and reading pages. */
export function PageIntro({
  eyebrow,
  title,
  lede,
  center = false,
  children
}: {
  eyebrow?: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  center?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <header className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      {eyebrow ? <p className="eyebrow eyebrow-accent">{eyebrow}</p> : null}
      <h1 className="title-display mt-3 text-balance text-[42px] sm:text-[56px]">{title}</h1>
      {lede ? <p className="mt-5 text-pretty text-[17px] leading-[1.65] text-[var(--muted-strong)]">{lede}</p> : null}
      {children}
    </header>
  );
}
