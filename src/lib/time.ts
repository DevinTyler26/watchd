const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const ranges = [
  { limit: 60, divisor: 1, unit: "second" as const },
  { limit: 3600, divisor: 60, unit: "minute" as const },
  { limit: 86400, divisor: 3600, unit: "hour" as const },
  { limit: 604800, divisor: 86400, unit: "day" as const },
  { limit: 2629800, divisor: 604800, unit: "week" as const },
  { limit: 31557600, divisor: 2629800, unit: "month" as const },
];

export function relativeTimeFromNow(date: Date) {
  const deltaSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const absoluteSeconds = Math.abs(deltaSeconds);

  for (const range of ranges) {
    if (absoluteSeconds < range.limit) {
      const value = Math.round(deltaSeconds / range.divisor);
      return rtf.format(value, range.unit);
    }
  }

  const years = Math.round(deltaSeconds / 31557600);
  return rtf.format(years, "year");
}
