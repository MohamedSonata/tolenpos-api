/**
 * Enum-like class containing all Socket.IO error event names used in the application.
 * Use these constants to avoid typos and ensure consistency across the codebase.
 */
export class SocketIOErrorEvents {
  /**
   * Event name for unauthorized errors (authentication failures).
   */
  static readonly UnauthorizedError = "UnauthorizedError";

  /**
   * Event name for credential reset required errors.
   * Emitted when stored credentials are no longer valid (e.g., after database reset).
   */
  static readonly CredentialResetRequired = "CredentialResetRequired";

  // Add more error events here as needed
}
