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

  // POS Seat Events Section

  /**
   * Event emitted by POS app to update seat telemetry data
   */
  static readonly OnSeatUpdate = "seat:update";

  /**
   * Event emitted to POS app confirming successful seat update
   */
  static readonly EmitSeatUpdateSuccess = "seat:update:success";

  /**
   * Event emitted by mobile app to subscribe to seat updates
   */
  static readonly OnSeatSubscribe = "seat:subscribe";

  /**
   * Event emitted to mobile app confirming subscription
   */
  static readonly EmitSeatSubscribeSuccess = "seat:subscribe:success";

  /**
   * Event emitted to subscribed mobile apps when seat data changes
   */
  static readonly EmitSeatUpdated = "seat:updated";

  /**
   * Event emitted by mobile app to unsubscribe from seat updates
   */
  static readonly OnSeatUnsubscribe = "seat:unsubscribe";

  // Telemetry Query Events (Real-time queries from Mobile to POS)

  /**
   * Event emitted by mobile app to request telemetry data from POS device
   */
  static readonly OnTelemetryQuery = "seat:telemetry:query";

  /**
   * Event emitted to POS device to forward telemetry query request
   */
  static readonly EmitTelemetryQueryRequest = "seat:telemetry:query:request";

  /**
   * Event emitted by POS device with telemetry query response
   */
  static readonly OnTelemetryQueryResponse = "seat:telemetry:query:response";

  /**
   * Event emitted to mobile app with telemetry query result (realtime or snapshot)
   */
  static readonly EmitTelemetryQueryResponse = "seat:telemetry:query:result";

  /**
   * Event emitted to mobile app when telemetry query fails or times out
   */
  static readonly EmitTelemetryQueryError = "seat:telemetry:query:error";

  // Customer App Events Section

  /**
   * Event emitted by customer app to connect to a specific POS seat
   */
  static readonly OnCustomerConnect = "customer:connect";

  /**
   * Event emitted to customer app confirming successful connection
   */
  static readonly EmitCustomerConnectSuccess = "customer:connect:success";

  /**
   * Event emitted when customer disconnects from seat
   */
  static readonly OnCustomerDisconnect = "customer:disconnect";

  /**
   * Event emitted to POS device when a customer connects to their seat
   */
  static readonly EmitPOSCustomerConnected = "seat:customer:connected";

  /**
   * Event emitted to POS device when a customer disconnects from their seat
   */
  static readonly EmitPOSCustomerDisconnected = "seat:customer:disconnected";

  // Menu Browsing Events (Restaurant/Cafe)

  /**
   * Event emitted by customer app to request menu categories
   */
  static readonly OnCustomerMenuCategories = "customer:menu:categories";

  /**
   * Event emitted to customer app with menu categories data
   */
  static readonly EmitCustomerMenuCategories = "customer:menu:categories:data";

  /**
   * Event emitted by customer app to request menu products for a category
   */
  static readonly OnCustomerMenuProducts = "customer:menu:products";

  /**
   * Event emitted to customer app with menu products data
   */
  static readonly EmitCustomerMenuProducts = "customer:menu:products:data";

  // Barcode Scanning Events (Retail/Pharmacy)

  /**
   * Event emitted by customer app to scan a product barcode
   */
  static readonly OnCustomerProductScan = "customer:product:scan";

  /**
   * Event emitted to customer app with scanned product data
   */
  static readonly EmitCustomerProductData = "customer:product:data";

  // POS Request Events (Backend to POS)

  /**
   * Event emitted to POS device to request menu categories
   */
  static readonly EmitPOSMenuCategoriesRequest = "pos:menu:categories:request";

  /**
   * Event emitted to POS device to request menu products
   */
  static readonly EmitPOSMenuProductsRequest = "pos:menu:products:request";

  /**
   * Event emitted to POS device to request product scan
   */
  static readonly EmitPOSProductScanRequest = "pos:product:scan:request";

  // POS Response Events (POS to Backend)

  /**
   * Event emitted by POS device with menu categories response
   */
  static readonly OnPOSMenuCategoriesResponse = "pos:menu:categories:response";

  /**
   * Event emitted by POS device with menu products response
   */
  static readonly OnPOSMenuProductsResponse = "pos:menu:products:response";

  /**
   * Event emitted by POS device with product scan response
   */
  static readonly OnPOSProductScanResponse = "pos:product:scan:response";

  // Customer Error Events

  /**
   * Event emitted to customer app when an error occurs
   */
  static readonly EmitCustomerError = "customer:error";

  /**
   * Event emitted to customer app when a request times out
   */
  static readonly EmitCustomerTimeout = "customer:timeout";

  // Customer Ordering Events

  /**
   * Event emitted by customer app to create an order
   */
  static readonly OnCustomerOrderCreate = "customer:order:create";

  /**
   * Event emitted to customer app with order creation response
   */
  static readonly EmitCustomerOrderResponse = "customer:order:create:response";

  /**
   * Event emitted to POS device to request order creation
   */
  static readonly EmitPOSOrderRequest = "pos:order:create:request";

  /**
   * Event emitted by POS device with order creation response
   */
  static readonly OnPOSOrderResponse = "pos:order:create:response";
}