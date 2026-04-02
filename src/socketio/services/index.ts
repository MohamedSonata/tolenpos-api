/**
 * Socket.IO authentication and error handling services.
 * Provides helpers for authenticating user connections and handling token verification.
 */
import strapiUtils from '@strapi/utils';

import { Core } from "@strapi/strapi";

import jwt, { JwtPayload } from "jsonwebtoken";
import { Socket } from "socket.io";
import { SocketIOErrorEvents } from '../error_events.constants';

// Extend only with custom properties, do not override handshake
interface AuthenticatedSocket extends Socket {
  userID?: string;
  strategeyName?: string;
  clientType?: 'mobile' | 'pos';
  machineUUID?: string;
  keySeatDocumentId?: string;
  // handshake is inherited from Socket
  [key: string]: any;
}

const socketService = ({ strapi }: { strapi: Core.Strapi }) => {
  /**
   * Verifies a JWT token using the Strapi JWT secret.
   * @param token - The JWT token to verify.
   * @returns Promise resolving to the decoded token payload.
   */
  const verify = async (token: string): Promise<JwtPayload> => {
    return new Promise((resolve, reject) => {
      jwt.verify(
        token,
        strapi.config.get("plugin::users-permissions.jwtSecret"),
        {},
        (err, tokenPayload = {}) => {
          if (err) {
            reject(new strapiUtils.errors.UnauthorizedError("Invalid token."));
          } else {
            resolve(tokenPayload as JwtPayload);
          }
        }
      );
    });
  };

  /**
   * Authenticates POS app connection using API key token and machine UUID.
   * Validates against key-seat and license records.
   *
   * @param socket - The Socket.IO socket instance.
   * @param token - The API key/license key.
   * @param userDocumentId - The user document ID.
   * @param machineUUID - The machine UUID.
   * @returns Promise resolving to true if authenticated, false otherwise.
   */
  const authenticatePOSConnection = async (
    socket: AuthenticatedSocket,
    token: string,
    userDocumentId: string,
    machineUUID: string
  ): Promise<boolean> => {
    try {
      console.log("POS Authentication attempt:", { token, userDocumentId, machineUUID });

      // Find the license by license key
      const license = await strapi.documents('api::license.license').findFirst({
        filters: {
          licenseKey: token,
          isActive: true,
        },
        populate: ['user', 'seats'],
      });

      if (!license) {
        console.log("License not found or inactive");
        return false;
      }

      // Check if license is expired (for expiring licenses)
      if (license.expirationType === 'expiring' && license.expiresAt) {
        const expirationDate = new Date(license.expiresAt);
        if (expirationDate < new Date()) {
          console.log("License has expired");
          return false;
        }
      }

      // Verify the user owns this license
      if (license.user?.documentId !== userDocumentId) {
        console.log("User does not own this license");
        return false;
      }

      // Find or validate the key-seat for this machine
      const keySeat = await strapi.documents('api::key-seat.key-seat').findFirst({
        filters: {
          machineUUID: machineUUID,
          license: {
            documentId: license.documentId,
          },
          isActive: true,
        },
      });

      if (!keySeat) {
        console.log("Key seat not found or inactive for this machine");
        return false;
      }

      // Authentication successful - set socket properties
      socket.userID = userDocumentId;
      socket.strategeyName = "pos-api-key";
      socket.clientType = "pos";
      socket.machineUUID = machineUUID;
      socket.keySeatDocumentId = keySeat.documentId; // Store for easy access

      console.log("POS authentication successful:", {
        userID: socket.userID,
        machineUUID: socket.machineUUID,
        keySeatId: keySeat.documentId,
      });

      return true;
    } catch (error) {
      console.error("POS authentication error:", error);
      return false;
    }
  };

  /**
   * Validate User Authentication Token.
   * Associates the Socket object with new params (user:UserID, strategyName: "users-permissions").
   * If not valid: Emits UnauthorizedError event and disconnects the user.
   *
   * @param socket - The Socket.IO socket instance.
   * @returns Promise resolving to true if authenticated, false otherwise.
   */
  const authenticateUserConnection = async (
    socket: AuthenticatedSocket
  ): Promise<boolean> => {
    let payload: JwtPayload | undefined;
    try {
      // Get authentication parameters from handshake query
      const query = socket.handshake.query as any;
      const token = query.token as string;
      const userDocumentId = query.userDocumentId as string;
      const machineUUID = query.machineUUID as string;

      console.log("User Token Sent at Connection From User:", token);
      console.log("Connection params:", { userDocumentId, machineUUID });

      // Determine authentication method based on provided parameters
      // POS app sends: token (API key), userDocumentId, and machineUUID
      // Mobile app sends: token (JWT) only
      if (machineUUID && userDocumentId) {
        // POS app authentication
        console.log("Attempting POS authentication");
        const authenticated = await authenticatePOSConnection(
          socket,
          token,
          userDocumentId,
          machineUUID
        );

        if (authenticated) {
          return true;
        }
        // If POS auth fails, throw error to trigger error emission
        throw new Error("POS authentication failed");
      } else {
        // Mobile app JWT authentication
        console.log("Attempting JWT authentication");
        payload = await verify(token);
        console.log(
          "VerifiedUserCredentials",
          payload,
          "Line(22)=>src/socketio/services/index.ts"
        );
        
        if (payload) {
          // Save the User ID to the socket connection object
          socket.userID = payload.userId;
          if (socket.userID) {
            // Save the strategyName to the socket connection object
            socket.strategeyName = "users-permissions";
            socket.clientType = "mobile";
          }
          return true;
        }
        return false;
      }
    } catch (error) {
      // Emit UnauthorizedError event for notifying the user
      socket.emit(SocketIOErrorEvents.UnauthorizedError, {
        socketConnected: socket.connected,
        credentialsExp: true,
        error: {
          status: 401,
          name: "UnauthorizedError",
          message: "Missing or invalid credentials",
          details: {},
        },
      });
      // Disconnect the connection to save performance and prevent unauthenticated event execution
      // socket.disconnect(true);
      return false;
    }
  };

  /**
   * Checks if a JWT token payload is expired.
   * @param payload - The decoded JWT payload.
   * @returns True if the token is expired, false otherwise.
   */
  const isTokenExpired = async (payload: JwtPayload): Promise<boolean> => {
    // Get the expiration time (exp) from the token payload
    console.log("PAAAAAAAAAAAAAAAAAAAAAAy", payload);
    const expirationTime = payload.exp;
    // Get the current time in seconds
    const currentTime = Math.floor(Date.now() / 1000);
    // Compare the expiration time with the current time
    return expirationTime !== undefined ? expirationTime < currentTime : true;
  };

  return {
    authenticateUserConnection,
    authenticatePOSConnection,
    isTokenExpired,
    verify
  };
};

export default socketService;
