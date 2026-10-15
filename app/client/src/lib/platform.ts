/** True on Apple platforms, where the search shortcut is Command K rather than Control K. */
export function isApplePlatform(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}
