type RestaurantBannerProps = {
  name: string;
  logoUrl: string | null;
  table?: string;
  /** e.g. "Step 2 of 4" */
  stepLabel?: string;
};

function safeLogoUrl(url: string | null): string | null {
  if (!url) {
    return null;
  }
  const trimmed = url.trim();
  if (trimmed.startsWith("https://") || trimmed.startsWith("http://") || trimmed.startsWith("/")) {
    return trimmed;
  }
  return null;
}

export function RestaurantBanner({ name, logoUrl, table, stepLabel }: RestaurantBannerProps) {
  const logo = safeLogoUrl(logoUrl);
  return (
    <header className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt=""
            width={48}
            height={48}
            className="h-12 w-12 shrink-0 -rotate-2 rounded-2xl border-2 border-line bg-white object-cover shadow-pop-sm"
          />
        ) : (
          <div
            className="flex h-12 w-12 shrink-0 -rotate-2 items-center justify-center rounded-2xl border-2 border-line bg-brand font-display text-xl font-extrabold text-on-brand shadow-pop-sm"
            aria-hidden
          >
            {name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl font-bold leading-tight tracking-tight">{name}</h1>
          {table ? <p className="text-sm font-medium text-muted">Table {table}</p> : null}
        </div>
      </div>
      {stepLabel ? (
        <span className="shrink-0 rotate-1 rounded-full border-2 border-hairline bg-tint px-3 py-1 font-display text-xs font-bold">
          {stepLabel}
        </span>
      ) : null}
    </header>
  );
}
