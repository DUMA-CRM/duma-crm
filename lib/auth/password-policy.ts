export const MIN_PASSWORD_LENGTH = 12;

export function passwordLengthHint(password: string): string | undefined {
  if (!password || password.length >= MIN_PASSWORD_LENGTH) return undefined;
  return `${MIN_PASSWORD_LENGTH - password.length} more characters needed`;
}
