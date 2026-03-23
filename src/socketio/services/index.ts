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
      // Verify User Credentials
      // Type assertion for handshake.query.token
      const token = (socket.handshake.query as any).token as string;
      console.log("User Token Sent at Connection From User : ",token);
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
        }
        return true;
      }
      return false;
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
    isTokenExpired,
    verify
  };
};

export default socketService;
