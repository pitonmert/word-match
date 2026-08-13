export function getLocationStateValue<T>(
  locationState: unknown,
  key: string,
  isMatch: (value: T) => boolean,
): T | null {
  if (
    !locationState ||
    typeof locationState !== "object" ||
    !(key in locationState)
  ) {
    return null;
  }

  const value = (locationState as Record<string, T | null | undefined>)[key];
  return value !== undefined && value !== null && isMatch(value) ? value : null;
}
