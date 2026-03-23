/**
 * Enum-like class containing all Socket.IO event names used in the application.
 * Use these constants to avoid typos and ensure consistency across the codebase.
 */
export class SocketIOEvents {
  // Customer Events Section

  /**
   * Event name for emitting closed driver information.
   */
  static readonly OnClosedDrivers = "driver:closedDrivers";

  static readonly onStopClosedDrivers = "driver:stopClosedDrivers";

 
  /**
    * Event name for emitting closed driver data.
    */
  static readonly EmitClosedDriversData = "driver:closedDriversResponse";


  /**
   * Event name for requesting user data fetch.
   */
  static readonly OnFetchUserData = "user:dataRequest";
  static readonly OnUpdateUserSocketId = "user:";
  static readonly EmitUserData = "user:data";

  static readonly OnCustomerUpdate = "user:update:customer";
  static readonly OnUpdateCustomerSocketId = "customer:update:socketIODetails";


  static readonly OnCustomerRefresh = "user:update:customer:refresh";


  /// Driver Events
  static readonly OnUpdateDriverSocketId = "driver:update:socketIODetails";

  static readonly onDriverLocationUpdate = "driver:update:location";

  static readonly onDriverUpdateStatus = "driver:update:status";
  /**
   * Event name for Refresh Driver Data to Default.
   */
  static readonly onDriverRefresh = "driver:update:refresh";




  /**
   * Event name for emitting ride data To Customer or Driver.
   */
  static readonly EmitRideData = "ride:dataResponse";
  /**
   * Event name for requesting ride data from Customer or Driver.
   */
  static readonly OnFetchRideData = "ride:dataRequest";
  /**
   * Event name for emitting ride Event To Driver.
   */
  static readonly EmitRideOfferToDriver = "ride:offer";
  /**
   * Event name for new ride request Process from Customer.
   */
  static readonly OnRideDriverArrivalRoute = "ride:driver:arrivalRoute";
  
  static readonly OnRideRequest = "ride:request";
  static readonly OnRideDriverArrived = 'driver:arrived';
  /**
   * Event name for updating ride Process from Customer.
   */
  static readonly OnRideUpdate = "ride:update";
  static readonly OnRideUpdateSocketIds = "ride:update:socket-IO-Details";
  static readonly OnUpdateRideStatus = "ride:update:ride-status";
  static readonly OnRideChat = "ride:chat";
  static readonly OnRideChatSendMessage = "ride:chat-Message";

  static readonly OnJoinRideChat = "ride:joinChat";
  static readonly OnJoinRideChatUnauthorized = "ride:joinChat-Unauthorized";
  static readonly OnJoinRideChatJoined = "ride:joinChat-Joined";

  // Ride Chat Additional Events (optional, using string literals in code for flexibility)
  static readonly OnRideChatTyping = "ride:chat:typing";
  static readonly OnRideChatTypingStatus = "ride:chat:typing-status";
  static readonly OnRideChatMessageDelivered = "ride:chat:message-delivered";
  static readonly OnRideChatMessageRead = "ride:chat:message-read";
  static readonly OnRideChatLeave = "ride:chat:leave";
  static readonly OnRideChatUserLeft = "ride:chat:user-left";
  static readonly OnRideChatRoomClosing = "ride:chat:room-closing";
  /**
   * Event name for ride accepted Process from Driver.
   */
  static readonly RideAccepted = "ride:accepted";
  /**
   * Event name for ride rejected Process from Driver.
   */
  static readonly RideRejected = "ride:rejected";
  /**
   * Event name for ride completed Process from Driver.
   */
  static readonly onRideCompleted = "ride:completed";
  /**
   * Event name for ride cancelation Process from Driver OR Customer.
   */
  static readonly onRideCancelation = "ride:cancelation";
  static readonly onRideCancelled = "ride:cancelled";
  
    static readonly OnRideState = "ride:state";

  // OTP Verification Events
  /**
   * Event name for verifying ride OTP from Driver.
   */
  static readonly OnRideVerifyOTP = "ride:verifyOTP";
 
  /**
   * Event name for OTP verified response to Driver.
   */
  static readonly OnRideOTPVerified = "ride:otpVerified";
  /**
   * Event name for resending OTP from Customer.
   */
  static readonly OnRideResendOTP = "ride:resendOTP";
  /**
   * Event name for OTP resent response to Customer.
   */
  static readonly OnRideOTPResent = "ride:otpResent";

  // Ride Last Known Position Events
  /**
   * Event name for updating ride last known position.
   */
  static readonly OnRideUpdateLastKnownPosition = "ride:update:lastKnownPosition";
  /**
   * Event name for getting ride last known position.
   */
  static readonly OnRideGetLastKnownPosition = "ride:get:lastKnownPosition";
  /**
   * Event name for deleting ride last known position.
   */
  static readonly OnRideDeleteLastKnownPosition = "ride:delete:lastKnownPosition";
  /**
   * Event name for stopping ride last known position tracking.
   */
  static readonly OnRideStopLastKnownPosition = "ride:stop:lastKnownPosition";
  /**
   * Event name for emitting ride last known position update to passenger.
   */
  static readonly EmitRideDriverLastKnownPosition = "ride:driver:lastKnownPosition";
  /**
   * Event name for ride last known position updated confirmation.
   */
  static readonly EmitRideLastKnownPositionUpdated = "ride:lastKnownPosition:updated";
  /**
   * Event name for ride last known position data response.
   */
  static readonly EmitRideLastKnownPositionData = "ride:lastKnownPosition:data";
  /**
   * Event name for ride last known position error.
   */
  static readonly EmitRideLastKnownPositionError = "ride:lastKnownPosition:error";

  /**
   * Event name for ride rating Process to Customer.
   */
  static readonly EmitRideRating = "ride:rating";
  /**
   * Event name for ride payment Process to Customer.
   */
  static readonly EmitRidePayment = "ride:payment";
  /** 
   * Event name for ride data not found Process to Customer.
   */
  static readonly EmitRideDataNotFound = "ride:dataNotFound";
}