
export declare interface ServiceError {
  code: number;
  message: String;
  reject?: (err) => void;
}

export const ErrorCodes = {

  UNKNOWN_ERROR: 0,

  LOAD_ACCOUNT_ERROR: 1,
  BAD_PASSWORD: 2,
  UNKNOWN_ACCOUNT_EMAIL: 3,
  EMAIL_ALREADY_REGISTERED: 4,
  UNREACHABLE_NETWORK_ERROR: 4,
  UNKNOWN_NETWORK_ERROR: 5,
  SENT_CONFIRMATION_EMAIL_FAILED: 6,
  CONFIRM_EMAIL_FAILED: 7,
  SAVE_ACCOUNT_ERROR: 8,
  ACCOUNT_NOT_EXISTS: 9,
  SUBSCRIBE_ACCOUNT_ERROR: 10,
  ENTITY_STORAGE_MIGRATION_FAILED: 11,

  LOAD_DATA_ERROR: 12,
  SAVE_DATA_ERROR: 13,
  DELETE_DATA_ERROR: 14,
  SUBSCRIBE_DATA_ERROR: 15,

  // DATA errors (load error)
  LOAD_PERSONS_ERROR: 100,
  DATA_NOT_FOUND_ERROR: 104,

  TABLE_INVALID_ROW_ERROR: 350,
  TABLE_READ_ONLY: 351,

  UNAUTHORIZED: 401,
  AUTH_CHALLENGE_ERROR: 601,
  AUTH_SERVER_ERROR: 602,

  LOAD_CONFIG_ERROR: 700,
  SAVE_CONFIG_ERROR: 701,

  LOAD_TRASH_ENTITY_ERROR: 800,
  DELETE_TRASH_ENTITY_ERROR: 801
};

export const ServerErrorCodes = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401, // not authenticated
  FORBIDDEN: 403, // authenticated but no access right
  NOT_FOUND: 404,

  // sumaris-core-shared errors
  INTERNAL_SERVER_ERROR: 500,
  DATA_LOCKED: 520,
  BAD_UPDATE_DATE: 521,
  DENY_DELETION: 522,

  // sumaris-server errors
  INVALID_EMAIL_CONFIRMATION: 550,
  INVALID_QUERY_VARIABLES: 551,
  ACCOUNT_ALREADY_EXISTS: 552,
  BAD_APP_VERSION: 553
};
