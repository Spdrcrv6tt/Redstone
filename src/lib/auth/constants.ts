export const SESSION_COOKIE = "redstone_session";
export const SESSION_VERSION = "v1";
/** 30 days — persistent browser login */
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30;

export const DEFAULT_AUTH_USER = "guestuser";
/** scrypt hash of default password with AUTH_PASSWORD_SALT */
export const DEFAULT_PASSWORD_HASH_B64 =
  "O0r1uU1CcoNbRVAsuXwqEb48p9L67TTYP1LmbiwSeV8=";
export const AUTH_PASSWORD_SALT =
  "redstone-v1-fixed-salt-change-in-prod";
