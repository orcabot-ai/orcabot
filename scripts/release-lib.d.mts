export const stableVersion: RegExp;
export function releaseVersion(
  value: string,
  options?: { placeholder?: boolean },
): string;
export function compareVersions(a: string, b: string): -1 | 0 | 1;
export function git(args: string[], cwd?: string): string;
export function validateRelease(
  tag: string,
  cwd?: string,
): { version: string; sha: string; buildTime: string };
