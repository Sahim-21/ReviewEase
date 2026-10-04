type RestaurantBannerProps = {
  name: string;
  logoUrl: string | null;
  table?: string;
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

export function RestaurantBanner({ name, logoUrl, table }: RestaurantBannerProps) {
  const logo = safeLogoUrl(logoUrl);
  return (
    <header className="flex items-center gap-3">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt=""
          width={48}
          height={48}
          className="h-12 w-12 rounded-2xl bg-white object-cover shadow-sm"
        />
      ) : (
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand)] text-lg font-semibold text-white"
          aria-hidden
        >
          {name.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">You are reviewing</p>
        <h1 className="truncate text-xl font-semibold tracking-tight">{name}</h1>
        {table ? <p className="text-sm text-neutral-600">Table {table}</p> : null}
      </div>
    </header>
  );
}
