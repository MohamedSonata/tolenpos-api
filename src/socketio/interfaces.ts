// Common types

import {
  Data,
} from '@strapi/types';
import { Media } from '@strapi/types/dist/schema/attribute';
type DateTimeValue = Date | string;
type ID = string | number;
type DocumentID = string;



// Re-export common types
export type { DateTimeValue, ID, DocumentID, Data, Media };




interface NotificationBody<T> {
  fcmToken: string;
  title: string;
  body: string;
  data: NotificationBodyData<T>;
}

interface NotificationBodyData<T> {
  bodyData: T;
  timestamp: Date | string;
  action: NotificationAction;
  type: NotificationType
}

enum NotificationAction {
  SHOW_DRIVER = "SHOW_DRIVER",
  UPDATE_DRIVER = "UPDATE_DRIVER",
  HIDE_DRIVER = "HIDE_DRIVER",
  HIDE_ALL_DRIVERS = "HIDE_ALL_DRIVERS",
  SHOW_ALL_DRIVERS = "SHOW_ALL_DRIVERS",
  UPDATE_ALL_DRIVERS = "UPDATE_ALL_DRIVERS",
  UPDATE_CUSTOMER_LOCATION = "UPDATE_CUSTOMER_LOCATION",
  UPDATE_CUSTOMER_STATUS = "UPDATE_CUSTOMER_STATUS",
  UPDATE_DRIVER_STATUS = "UPDATE_DRIVER_STATUS",
  UPDATE_DRIVER_LOCATION = "UPDATE_DRIVER_LOCATION",
  SHOW_MESSAGE_ALERT = "SHOW_MESSAGE_ALERT",
  SHOW_NEw_OTP_ALERT = "SHOW_NEw_OTP_ALERT",
}

enum NotificationType {
  RIDE_REQUEST = "RIDE_REQUEST",
  RIDE_ACCEPTANCE = "RIDE_ACCEPTANCE",
  RIDE_REJECTION = "RIDE_REJECTION",
  RIDE_COMPLETED = "RIDE_COMPLETED",
  RIDE_CANCELATION = "RIDE_CANCELATION",
  PAYMENT = "PAYMENT",
  RIDE_RATING = "RIDE_RATING",
  NEW_MESSAGE = "NEW_MESSAGE",
  DRIVER_ARRIVED = "DRIVER_ARRIVED",
  NEW_RIDE_OTP = "NEW_RIDE_OTP",
}

enum SocketEventAction {
  RIDE_Confirmed = "RIDE_Confirmed",
  START_RIDE_STREAM = "START_RIDE_STREAM",
  END_RIDE_STREAM = "END_RIDE_STREAM",
  START_DRIVER_ARRIVAL_STREAM = "START_DRIVER_ARRIVAL_STREAM",
  END_DRIVER_ARRIVAL_STREAM = "END_DRIVER_ARRIVAL_STREAM",
  START_RIDE_CHAT_STREAM = "START_RIDE_CHAT_STREAM",
  END_RIDE_CHAT_STREAM = "END_RIDE_CHAT_STREAM",
  START_DRIVER_STATUS_STREAM = "START_DRIVER_STATUS_STREAM",
  END_DRIVER_STATUS_STREAM = "END_DRIVER_STATUS_STREAM",
  START_DRIVER_LOCATION_STREAM = "START_DRIVER_LOCATION_STREAM",
  END_DRIVER_LOCATION_STREAM = "END_DRIVER_LOCATION_STREAM",
  DRIVER_LOCATION_UPDATE = "DRIVER_LOCATION_UPDATE",
  START_RIDE_CHAT = "START_RIDE_CHAT",
  END_RIDE_CHAT = "END_RIDE_CHAT",
  START_RIDE_REQUEST = "START_RIDE_REQUEST",
  END_RIDE_REQUEST = "END_RIDE_REQUEST",
  START_RIDE_UPDATE = "START_RIDE_UPDATE",
  END_RIDE_UPDATE = "END_RIDE_UPDATE",
  START_RIDE_COMPLETED = "START_RIDE_COMPLETED",
  END_RIDE_COMPLETED = "END_RIDE_COMPLETED",
  START_RIDE_CANCELATION = "START_RIDE_CANCELATION",
  END_RIDE_CANCELATION = "END_RIDE_CANCELATION",
}

interface LatLong {
  latitude: number;
  longitude: number;
}

interface DriverArrivalRouteEventBody {
  rideDocumentId: string;
  userDocumentId: string;
  latLong: LatLong;
}

interface UpdateUserDriverLocationEventBody {
  driverDocumentId: string;
  city: string;
  governate: string;
  subAdministrativeArea: string;
  latitude: number;
  longitude: number;
  userId: string;
  radius: string;
  query: any;
}

// Export all legacy interfaces
export {
 

  NotificationBody,
  NotificationBodyData,
  LatLong,
  NotificationAction,
  UpdateUserDriverLocationEventBody,
  NotificationType,
  SocketEventAction,
  DriverArrivalRouteEventBody,
}
