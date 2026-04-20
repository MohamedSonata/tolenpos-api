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

// POS Seat Interfaces

// Business Data Structures
interface LastOrderData {
  receiptNumber: string;
  total: number;
  itemCount: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  items?: any[];
  customer?: any;
}

interface KPISummaryData {
  totalSales: number;
  transactionCount: number;
  averageTransactionValue: number;
  period: string;
  lastUpdated: string;
}

interface ExpenseData {
  id: string;
  title: string;
  amount: number;
  category: string;
  paymentMethod: string;
  expenseDate: string;
  isUrgent: boolean;
}

// Telemetry Data Structure
interface TelemetryData {
  // Network status
  networkStatus?: 'online' | 'offline';
  lastSyncTime?: string;
  
  // Business data (new fields)
  lastOrder?: LastOrderData | null;
  kpiSummary?: KPISummaryData | null;
  expenses?: ExpenseData[];
  
  // System information (optional legacy fields)
  osVersion?: string;
  appVersion?: string;
  cpuUsage?: number;
  memoryUsage?: number;
  diskSpace?: number;
  
  // Additional business metrics (optional legacy fields)
  transactionsToday?: number;
  lastTransactionTime?: string;
  cashDrawerStatus?: 'open' | 'closed';
  printerStatus?: 'online' | 'offline' | 'error';
  
  // Metadata (added by backend)
  lastUpdated?: string;
  
  // Allow additional custom fields
  [key: string]: any;
}
 interface CategorySalesSummary {
  categoryId: string
  categoryName: string
  totalRevenue: number
  totalQuantitySold: number
  transactionCount: number
}
 interface HistoricalKPISummary {
  yesterday: {
    totalSales: number
    transactionCount: number
    averageTransactionValue: number
    grossProfit: number
    marginPercentage: number
    categories: CategorySalesSummary[]
  }
  thisWeek: {
    totalSales: number
    transactionCount: number
    averageTransactionValue: number
    grossProfit: number
    marginPercentage: number
    categories: CategorySalesSummary[]
  }
  thisMonth: {
    totalSales: number
    transactionCount: number
    averageTransactionValue: number
    grossProfit: number
    marginPercentage: number
    categories: CategorySalesSummary[]
  }
  cachedAt: string // ISO 8601 timestamp when data was cached
}
interface SeatUpdatePayload {
  realtimeTelemetry: TelemetryData;  // Real-time telemetry updates from POS
  historicalKpiSummary: HistoricalKPISummary;  // Real-time telemetry updates from POS
}

interface SeatSubscribePayload {
  // Empty for now, may include filters in future
}

interface SeatUpdatedNotification {
  machineUUID: string;
  realtimeTelemetry: TelemetryData;  // Real-time telemetry data
  isActive: boolean;
  updatedAt: string;
  licenseDocumentId: string;
}

// Telemetry Query Interfaces (Real-time queries from Mobile to POS)

interface TelemetryQueryFilters {
  startDate?: string;
  endDate?: string;
  dataTypes?: string[]; // ['orders', 'inventory', 'sales', 'expenses']
}

interface TelemetryQueryRequest {
  requestId: string; // Unique ID for tracking request/response
  keySeatDocumentId: string;
  filters: TelemetryQueryFilters;
}

interface TelemetryQueryResponse {
  requestId: string;
  keySeatDocumentId: string;
  telemetryData: Record<string, any>;
  mobileSocketId: string; // Socket ID of requesting mobile app
  timestamp?: string;
  success?: boolean;
}

interface TelemetryQueryError {
  requestId: string;
  keySeatDocumentId: string;
  error: string;
  fallbackAvailable: boolean;
}

interface TelemetryQueryResult {
  requestId: string;
  keySeatDocumentId: string;
  source: 'realtime' | 'snapshot' | 'unavailable';
  data: Record<string, any>;
  timestamp: string;
  success: boolean;
  warning?: string;
  snapshotAge?: number; // Hours since snapshot was taken
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
  SeatUpdatePayload,
  SeatSubscribePayload,
  SeatUpdatedNotification,
  TelemetryData,
  LastOrderData,
  KPISummaryData,
  ExpenseData,
  TelemetryQueryFilters,
  TelemetryQueryRequest,
  TelemetryQueryResponse,
  TelemetryQueryError,
  TelemetryQueryResult,
  HistoricalKPISummary,
  CategorySalesSummary,
}
