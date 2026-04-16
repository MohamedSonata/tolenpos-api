# Mobile App Integration Guide (Flutter)
## Real-time Seat Telemetry & License Management System

> **AI Agent Ready**: This document contains complete specifications for integrating the Flutter mobile application with the real-time seat telemetry system. All request/response formats, Socket.IO events, and HTTP endpoints are documented with Dart types.

---

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Authentication](#authentication)
4. [Socket.IO Integration](#socketio-integration)
5. [HTTP REST API](#http-rest-api)
6. [Data Models](#data-models)
7. [Implementation Guide](#implementation-guide)
8. [Error Handling](#error-handling)
9. [Best Practices](#best-practices)
10. [Testing](#testing)

---

## Overview

### System Purpose
The mobile application connects to a Strapi backend server to:
- Authenticate using JWT tokens
- Subscribe to real-time seat updates from POS machines
- Fetch seat information and telemetry history
- Monitor POS machine status in real-time

### Technology Stack
- **Framework**: Flutter
- **Real-time Communication**: socket_io_client package
- **HTTP Client**: dio package
- **Authentication**: JWT Bearer tokens

### Key Features
- ✅ Real-time seat telemetry updates
- ✅ Subscribe/unsubscribe to seat notifications
- ✅ Fetch all user's seats via HTTP
- ✅ Query telemetry history with filters
- ✅ Automatic reconnection handling
- ✅ Offline capability

---

## Architecture

### Connection Flow
```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│ Mobile App  │────────▶│  Socket.IO   │────────▶│   Strapi    │
│  (Flutter)  │◀────────│   Server     │◀────────│   Backend   │
└─────────────┘         └──────────────┘         └─────────────┘
      │                                                  │
      │                                                  │
      └──────────────── HTTP REST API ──────────────────┘
```

### Data Flow
1. **Authentication**: Mobile app authenticates with JWT token
2. **Subscription**: Mobile app subscribes to seat updates
3. **Real-time Updates**: Server pushes seat telemetry changes to mobile app
4. **HTTP Queries**: Mobile app fetches seat list and history via REST API

---

## Authentication

### Authentication Method: JWT Bearer Token

The mobile app uses **JWT token authentication**:
- **JWT Token**: Obtained from user login/registration
- **User Document ID**: Automatically extracted from JWT payload

### JWT Token Structure

```dart
// JWT payload contains:
{
  "id": "user-document-id",      // User's document ID
  "email": "user@example.com",
  "iat": 1705320000,              // Issued at timestamp
  "exp": 1705406400               // Expiration timestamp
}
```

### Authentication Flow

```dart
// 1. User logs in and receives JWT token
final String jwtToken = await authService.login(email, password);

// 2. Store token securely
await secureStorage.write(key: 'jwt_token', value: jwtToken);

// 3. Connect to Socket.IO with JWT token
final socket = io(serverUrl, 
  OptionBuilder()
    .setTransports(['websocket', 'polling'])
    .setQuery({'token': jwtToken})
    .build()
);
```

### Authentication Validation

The server validates:
1. ✅ JWT token is valid and not expired
2. ✅ User exists in the database
3. ✅ Token signature is correct

### Authentication Errors

```dart
socket.on('UnauthorizedError', (data) {
  print('Authentication failed: $data');
  // data structure:
  // {
  //   "socketConnected": false,
  //   "credentialsExp": true,
  //   "error": {
  //     "status": 401,
  //     "name": "UnauthorizedError",
  //     "message": "Missing or invalid credentials",
  //     "details": {}
  //   }
  // }
});
```

---

## Socket.IO Integration

### Installation

Add to `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  socket_io_client: ^2.0.3+1
  dio: ^5.4.0
  flutter_secure_storage: ^9.0.0
  uuid: ^4.0.0  # For generating request IDs
```

Run:
```bash
flutter pub get
```

### Basic Setup

```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;

class MobileSocketService {
  IO.Socket? _socket;
  final String serverUrl;
  final String jwtToken;
  bool _isConnected = false;
  bool _isSubscribed = false;

  MobileSocketService({
    required this.serverUrl,
    required this.jwtToken,
  });

  /// Connect to Socket.IO server
  Future<void> connect() async {
    _socket = IO.io(
      serverUrl,
      IO.OptionBuilder()
        .setTransports(['websocket', 'polling'])
        .setQuery({'token': jwtToken})
        .enableReconnection()
        .setReconnectionDelay(1000)
        .setReconnectionDelayMax(5000)
        .setReconnectionAttempts(999999)
        .setTimeout(20000)
        .build(),
    );

    _setupEventListeners();
    _socket!.connect();
  }

  /// Setup event listeners
  void _setupEventListeners() {
    // Connection events
    _socket!.on('connect', _onConnect);
    _socket!.on('disconnect', _onDisconnect);
    _socket!.on('connect_error', _onConnectError);

    // Authentication events
    _socket!.on('UnauthorizedError', _onUnauthorized);

    // Seat subscription events
    _socket!.on('seat:subscribe:success', _onSubscribeSuccess);
    _socket!.on('seat:updated', _onSeatUpdated);
  }

  void _onConnect(_) {
    print('✅ Connected to server: ${_socket!.id}');
    _isConnected = true;
    // Notify UI
  }

  void _onDisconnect(_) {
    print('❌ Disconnected from server');
    _isConnected = false;
    _isSubscribed = false;
    // Notify UI
  }

  void _onConnectError(dynamic error) {
    print('❌ Connection error: $error');
    _isConnected = false;
    // Notify UI
  }

  void _onUnauthorized(dynamic data) {
    print('🚫 Unauthorized: $data');
    _isConnected = false;
    // Show authentication error to user
  }

  void _onSubscribeSuccess(dynamic data) {
    if (data['success'] == true) {
      print('✅ Subscribed to seat updates');
      _isSubscribed = true;
    } else {
      print('❌ Subscription failed: ${data['error']}');
      _isSubscribed = false;
    }
    // Notify UI
  }

  void _onSeatUpdated(dynamic data) {
    print('🔔 Seat update received: $data');
    // Parse and handle seat update
    final seatUpdate = SeatUpdatedNotification.fromJson(data);
    // Notify UI or update local state
  }

  /// Subscribe to seat updates
  void subscribeToSeats() {
    if (_socket == null || !_isConnected) {
      print('⚠️ Not connected to server');
      return;
    }

    print('📡 Subscribing to seat updates...');
    _socket!.emit('seat:subscribe', {});
  }

  /// Unsubscribe from seat updates
  void unsubscribeFromSeats() {
    if (_socket == null || !_isConnected) {
      return;
    }

    print('📡 Unsubscribing from seat updates...');
    _socket!.emit('seat:unsubscribe');
    _isSubscribed = false;
  }

  /// Disconnect from server
  void disconnect() {
    if (_socket != null) {
      _socket!.disconnect();
      _socket!.dispose();
      _socket = null;
    }
    _isConnected = false;
    _isSubscribed = false;
  }

  bool get isConnected => _isConnected;
  bool get isSubscribed => _isSubscribed;
}
```

### Socket.IO Events Reference

#### Events Emitted by Mobile App (Client → Server)

##### 1. `seat:subscribe` - Subscribe to Seat Updates

**Purpose**: Subscribe to real-time seat telemetry updates

**Payload Type**:
```dart
class SeatSubscribePayload {
  // Empty for now, may include filters in future
  
  Map<String, dynamic> toJson() => {};
}
```

**Example**:
```dart
socket.emit('seat:subscribe', {});
```

**Server Response**: `seat:subscribe:success` event

---

##### 2. `seat:unsubscribe` - Unsubscribe from Seat Updates

**Purpose**: Stop receiving seat telemetry updates

**Payload**: None

**Example**:
```dart
socket.emit('seat:unsubscribe');
```

**Server Response**: None (silent unsubscribe)

---

##### 3. `seat:telemetry:query` - Request Real-time Telemetry from POS (NEW)

**Purpose**: Request telemetry data directly from POS device in real-time

**Payload Type**:
```dart
class TelemetryQueryRequest {
  final String requestId;
  final String keySeatDocumentId;
  final TelemetryQueryFilters? filters;

  TelemetryQueryRequest({
    required this.requestId,
    required this.keySeatDocumentId,
    this.filters,
  });

  Map<String, dynamic> toJson() => {
    'requestId': requestId,
    'keySeatDocumentId': keySeatDocumentId,
    if (filters != null) 'filters': filters!.toJson(),
  };
}

class TelemetryQueryFilters {
  final String? startDate;
  final String? endDate;
  final List<String>? dataTypes;

  TelemetryQueryFilters({
    this.startDate,
    this.endDate,
    this.dataTypes,
  });

  Map<String, dynamic> toJson() => {
    if (startDate != null) 'startDate': startDate,
    if (endDate != null) 'endDate': endDate,
    if (dataTypes != null) 'dataTypes': dataTypes,
  };
}
```

**Example**:
```dart
import 'package:uuid/uuid.dart';

final requestId = Uuid().v4();
socket.emit('seat:telemetry:query', {
  'requestId': requestId,
  'keySeatDocumentId': 'seat-doc-id-123',
  'filters': {
    'dataTypes': ['orders', 'inventory', 'sales']
  }
});
```

**Server Response**: `seat:telemetry:query:result` or `seat:telemetry:query:error` event

**Timeout**: 10 seconds (server will return snapshot if POS doesn't respond)

---

#### Events Received by Mobile App (Server → Client)

##### 1. `seat:subscribe:success` - Subscription Confirmation

**Purpose**: Confirmation of subscription success/failure

**Payload Type**:
```dart
class SeatSubscribeSuccessResponse {
  final bool success;
  final String? message;
  final String? error;

  SeatSubscribeSuccessResponse({
    required this.success,
    this.message,
    this.error,
  });

  factory SeatSubscribeSuccessResponse.fromJson(Map<String, dynamic> json) {
    return SeatSubscribeSuccessResponse(
      success: json['success'] as bool,
      message: json['message'] as String?,
      error: json['error'] as String?,
    );
  }
}
```

**Success Example**:
```dart
{
  "success": true,
  "message": "Subscribed to seat updates"
}
```

**Failure Example**:
```dart
{
  "success": false,
  "error": "User document ID not found"
}
```

**Usage**:
```dart
socket.on('seat:subscribe:success', (data) {
  final response = SeatSubscribeSuccessResponse.fromJson(data);
  
  if (response.success) {
    print('✅ Subscribed: ${response.message}');
    // Update UI to show subscribed state
  } else {
    print('❌ Subscription failed: ${response.error}');
    // Show error to user
  }
});
```

---

##### 2. `seat:updated` - Real-time Seat Update Notification

**Purpose**: Pushed when a POS machine updates its telemetry

**Payload Type**:
```dart
class SeatUpdatedNotification {
  final String machineUUID;
  final Map<String, dynamic> realtimeTelemetry;  // Updated field name
  final bool isActive;
  final String updatedAt;
  final String licenseDocumentId;

  SeatUpdatedNotification({
    required this.machineUUID,
    required this.realtimeTelemetry,
    required this.isActive,
    required this.updatedAt,
    required this.licenseDocumentId,
  });

  factory SeatUpdatedNotification.fromJson(Map<String, dynamic> json) {
    return SeatUpdatedNotification(
      machineUUID: json['machineUUID'] as String,
      realtimeTelemetry: json['realtimeTelemetry'] as Map<String, dynamic>,
      isActive: json['isActive'] as bool,
      updatedAt: json['updatedAt'] as String,
      licenseDocumentId: json['licenseDocumentId'] as String,
    );
  }
}
```

**Example**:
```dart
{
  "machineUUID": "POS-001",
  "realtimeTelemetry": {
    "networkStatus": "online",
    "lastSyncTime": "2024-01-15T10:30:45.123Z",
    "lastOrder": {
      "receiptNumber": "RCP-2024-001234",
      "total": 125.50,
      "itemCount": 3,
      "paymentMethod": "card",
      "status": "completed",
      "createdAt": "2024-01-15T10:25:30.000Z"
    },
    "kpiSummary": {
      "totalSales": 3450.75,
      "transactionCount": 42,
      "averageTransactionValue": 82.16,
      "period": "today",
      "lastUpdated": "2024-01-15T10:30:45.123Z"
    },
    "expenses": [
      {
        "id": "exp-001",
        "title": "Office Supplies",
        "amount": 125.00,
        "category": "Supplies",
        "paymentMethod": "card",
        "expenseDate": "2024-01-15T09:00:00.000Z",
        "isUrgent": false
      }
    ],
    "osVersion": "Windows 10",
    "appVersion": "2.1.0",
    "cpuUsage": 45,
    "memoryUsage": 60,
    "diskSpace": 250,
    "cashDrawerStatus": "closed",
    "printerStatus": "online"
  },
  "isActive": true,
  "updatedAt": "2024-01-15T10:30:45.123Z",
  "licenseDocumentId": "lic-doc-id-123"
}
```

**Usage**:
```dart
socket.on('seat:updated', (data) {
  final update = SeatUpdatedNotification.fromJson(data);
  
  print('🔔 Seat ${update.machineUUID} updated');
  
  // Access business data
  final lastOrder = update.realtimeTelemetry['lastOrder'];
  if (lastOrder != null) {
    print('Last order: ${lastOrder['receiptNumber']} - \$${lastOrder['total']}');
  }
  
  final kpiSummary = update.realtimeTelemetry['kpiSummary'];
  if (kpiSummary != null) {
    print('Today\'s sales: \$${kpiSummary['totalSales']}');
    print('Transactions: ${kpiSummary['transactionCount']}');
  }
  
  // Access system metrics
  print('CPU: ${update.realtimeTelemetry['cpuUsage']}%');
  print('Memory: ${update.realtimeTelemetry['memoryUsage']}%');
  
  // Update local state
  _updateSeatInList(update);
  
  // Show notification to user
  _showNotification(
    'POS Update',
    'Machine ${update.machineUUID} sent new data'
  );
  
  // Trigger UI rebuild
  notifyListeners();
});
```

---

##### 3. `seat:telemetry:query:result` - Telemetry Query Response (NEW)

**Purpose**: Response to real-time telemetry query request

**Payload Type**:
```dart
class TelemetryQueryResult {
  final String requestId;
  final String keySeatDocumentId;
  final String source;  // 'realtime' or 'snapshot'
  final Map<String, dynamic> data;
  final String timestamp;
  final bool success;
  final String? warning;
  final int? snapshotAge;  // Hours since snapshot (if source is 'snapshot')

  TelemetryQueryResult({
    required this.requestId,
    required this.keySeatDocumentId,
    required this.source,
    required this.data,
    required this.timestamp,
    required this.success,
    this.warning,
    this.snapshotAge,
  });

  factory TelemetryQueryResult.fromJson(Map<String, dynamic> json) {
    return TelemetryQueryResult(
      requestId: json['requestId'] as String,
      keySeatDocumentId: json['keySeatDocumentId'] as String,
      source: json['source'] as String,
      data: json['data'] as Map<String, dynamic>,
      timestamp: json['timestamp'] as String,
      success: json['success'] as bool,
      warning: json['warning'] as String?,
      snapshotAge: json['snapshotAge'] as int?,
    );
  }

  bool get isRealtime => source == 'realtime';
  bool get isSnapshot => source == 'snapshot';
}
```

**Example (Real-time)**:
```dart
{
  "requestId": "uuid-123",
  "keySeatDocumentId": "seat-doc-id-123",
  "source": "realtime",
  "data": {
    "networkStatus": "online",
    "lastOrder": { /* ... */ },
    "kpiSummary": { /* ... */ }
  },
  "timestamp": "2024-01-15T10:30:45.123Z",
  "success": true
}
```

**Example (Snapshot Fallback)**:
```dart
{
  "requestId": "uuid-123",
  "keySeatDocumentId": "seat-doc-id-123",
  "source": "snapshot",
  "data": {
    "networkStatus": "offline",
    "lastOrder": { /* ... */ },
    "kpiSummary": { /* ... */ }
  },
  "timestamp": "2024-01-15T08:00:00.000Z",
  "success": true,
  "warning": "POS device offline - showing snapshot from 2 hours ago",
  "snapshotAge": 2
}
```

**Usage**:
```dart
socket.on('seat:telemetry:query:result', (data) {
  final result = TelemetryQueryResult.fromJson(data);
  
  if (result.isRealtime) {
    print('✅ Got real-time data from POS');
  } else {
    print('⚠️ POS offline, using snapshot from ${result.snapshotAge} hours ago');
    if (result.warning != null) {
      showWarning(result.warning!);
    }
  }
  
  // Process the data
  updateUI(result.data);
});
```

---

##### 4. `seat:telemetry:query:error` - Telemetry Query Error (NEW)

**Purpose**: Error response when telemetry query fails

**Payload Type**:
```dart
class TelemetryQueryError {
  final String requestId;
  final String keySeatDocumentId;
  final String error;
  final bool fallbackAvailable;

  TelemetryQueryError({
    required this.requestId,
    required this.keySeatDocumentId,
    required this.error,
    required this.fallbackAvailable,
  });

  factory TelemetryQueryError.fromJson(Map<String, dynamic> json) {
    return TelemetryQueryError(
      requestId: json['requestId'] as String,
      keySeatDocumentId: json['keySeatDocumentId'] as String,
      error: json['error'] as String,
      fallbackAvailable: json['fallbackAvailable'] as bool,
    );
  }
}
```

**Example**:
```dart
{
  "requestId": "uuid-123",
  "keySeatDocumentId": "seat-doc-id-123",
  "error": "POS device offline and no snapshot available",
  "fallbackAvailable": false
}
```

**Usage**:
```dart
socket.on('seat:telemetry:query:error', (data) {
  final error = TelemetryQueryError.fromJson(data);
  
  print('❌ Query failed: ${error.error}');
  
  if (error.fallbackAvailable) {
    showError('Could not get real-time data, but snapshot is available');
  } else {
    showError('No data available: ${error.error}');
  }
});
```

---

##### 5. `UnauthorizedError` - Authentication Error

**Purpose**: Emitted when authentication fails

**Payload Type**:
```dart
class UnauthorizedErrorResponse {
  final bool socketConnected;
  final bool credentialsExp;
  final ErrorDetails error;

  UnauthorizedErrorResponse({
    required this.socketConnected,
    required this.credentialsExp,
    required this.error,
  });

  factory UnauthorizedErrorResponse.fromJson(Map<String, dynamic> json) {
    return UnauthorizedErrorResponse(
      socketConnected: json['socketConnected'] as bool,
      credentialsExp: json['credentialsExp'] as bool,
      error: ErrorDetails.fromJson(json['error']),
    );
  }
}

class ErrorDetails {
  final int status;
  final String name;
  final String message;
  final Map<String, dynamic> details;

  ErrorDetails({
    required this.status,
    required this.name,
    required this.message,
    required this.details,
  });

  factory ErrorDetails.fromJson(Map<String, dynamic> json) {
    return ErrorDetails(
      status: json['status'] as int,
      name: json['name'] as String,
      message: json['message'] as String,
      details: json['details'] as Map<String, dynamic>,
    );
  }
}
```

**Example**:
```dart
{
  "socketConnected": false,
  "credentialsExp": true,
  "error": {
    "status": 401,
    "name": "UnauthorizedError",
    "message": "Missing or invalid credentials",
    "details": {}
  }
}
```

**Usage**:
```dart
socket.on('UnauthorizedError', (data) {
  final error = UnauthorizedErrorResponse.fromJson(data);
  
  print('🚫 Authentication failed: ${error.error.message}');
  
  // Disconnect socket
  socket.disconnect();
  
  // Show error dialog
  showDialog(
    context: context,
    builder: (context) => AlertDialog(
      title: Text('Authentication Error'),
      content: Text(error.error.message),
      actions: [
        TextButton(
          onPressed: () {
            Navigator.pop(context);
            // Navigate to login screen
          },
          child: Text('Login Again'),
        ),
      ],
    ),
  );
});
```

---


## Real-time Telemetry Queries (NEW)

### Overview

The mobile app can now request telemetry data directly from POS devices in real-time using the telemetry query system. This provides:

- **Real-time data** when POS is online (500ms - 2s response)
- **Automatic fallback** to last daily snapshot when POS is offline
- **10-second timeout** with graceful degradation
- **Request tracking** using unique request IDs

### Query Flow

```
Mobile App                Server                  POS Device
    |                       |                         |
    |--query request------->|                         |
    |   (with requestId)    |                         |
    |                       |--forward request------->|
    |                       |   (via socketId)        |
    |                       |                         |
    |                       |                         |--query local DB
    |                       |                         |
    |                       |<--send response---------|
    |<--forward response----|                         |
    |                       |                         |
    |                       |                         |
    [TIMEOUT: 10s]          |                         |
    |<--snapshot fallback---|                         |
```

### Implementation Example

```dart
import 'package:uuid/uuid.dart';

class TelemetryQueryService {
  final Socket socket;
  final Map<String, Completer<TelemetryQueryResult>> _pendingQueries = {};

  TelemetryQueryService(this.socket) {
    _setupListeners();
  }

  void _setupListeners() {
    socket.on('seat:telemetry:query:result', (data) {
      final result = TelemetryQueryResult.fromJson(data);
      final completer = _pendingQueries.remove(result.requestId);
      completer?.complete(result);
    });

    socket.on('seat:telemetry:query:error', (data) {
      final error = TelemetryQueryError.fromJson(data);
      final completer = _pendingQueries.remove(error.requestId);
      completer?.completeError(Exception(error.error));
    });
  }

  Future<TelemetryQueryResult> queryTelemetry({
    required String keySeatDocumentId,
    TelemetryQueryFilters? filters,
    Duration timeout = const Duration(seconds: 12),
  }) async {
    final requestId = Uuid().v4();
    final completer = Completer<TelemetryQueryResult>();
    _pendingQueries[requestId] = completer;

    // Send query request
    socket.emit('seat:telemetry:query', {
      'requestId': requestId,
      'keySeatDocumentId': keySeatDocumentId,
      if (filters != null) 'filters': filters.toJson(),
    });

    // Wait for response with timeout
    try {
      return await completer.future.timeout(
        timeout,
        onTimeout: () {
          _pendingQueries.remove(requestId);
          throw TimeoutException('Telemetry query timed out');
        },
      );
    } catch (e) {
      _pendingQueries.remove(requestId);
      rethrow;
    }
  }

  void dispose() {
    _pendingQueries.clear();
  }
}

// Usage
final queryService = TelemetryQueryService(socket);

try {
  final result = await queryService.queryTelemetry(
    keySeatDocumentId: 'seat-doc-id-123',
    filters: TelemetryQueryFilters(
      dataTypes: ['orders', 'inventory', 'sales'],
    ),
  );

  if (result.isRealtime) {
    print('✅ Got real-time data');
    showData(result.data);
  } else {
    print('⚠️ Using snapshot from ${result.snapshotAge} hours ago');
    showDataWithWarning(result.data, result.warning);
  }
} on TimeoutException {
  print('❌ Query timed out');
  showError('Could not get data from POS');
} catch (e) {
  print('❌ Query failed: $e');
  showError('Failed to query telemetry');
}
```

### When to Use Queries vs Subscriptions

**Use Subscriptions (`seat:subscribe`)** when:
- You want continuous updates
- You're monitoring multiple seats
- You need push notifications for changes
- You're building a dashboard

**Use Queries (`seat:telemetry:query`)** when:
- You need data on-demand
- You want the freshest possible data
- You're viewing a specific seat's details
- You need to refresh data manually

### Best Practices

1. **Generate unique request IDs** using UUID
2. **Implement timeout handling** (12 seconds recommended)
3. **Clean up pending requests** on component unmount
4. **Show loading indicators** during queries
5. **Handle both realtime and snapshot responses**
6. **Display warnings** when using snapshot data

---

## HTTP REST API

### Base URL
```
https://your-server.com/api
```

### Authentication
All HTTP requests require JWT authentication via Bearer token.

**Header**:
```
Authorization: Bearer <jwt-token>
```

> **Note**: For HTTP API, you need a JWT token (same token used for Socket.IO authentication).

---

### Endpoints

#### 1. GET `/key-seats/my-seats` - Fetch User's Seats

**Purpose**: Retrieve all seats (POS machines) owned by the authenticated user

**Method**: `GET`

**Authentication**: Required (JWT Bearer token)

**Query Parameters**: None

**Request Example**:
```dart
final response = await dio.get(
  'https://your-server.com/api/key-seats/my-seats',
  options: Options(
    headers: {
      'Authorization': 'Bearer $jwtToken',
      'Content-Type': 'application/json',
    },
  ),
);
```

**Response Type**:
```dart
class MySeatsResponse {
  final List<KeySeat> data;
  final MetaInfo meta;

  MySeatsResponse({
    required this.data,
    required this.meta,
  });

  factory MySeatsResponse.fromJson(Map<String, dynamic> json) {
    return MySeatsResponse(
      data: (json['data'] as List)
          .map((item) => KeySeat.fromJson(item))
          .toList(),
      meta: MetaInfo.fromJson(json['meta']),
    );
  }
}

class KeySeat {
  final int id;
  final String documentId;
  final String machineUUID;
  final String? userSocketId;
  final Map<String, dynamic>? telemetry;
  final bool isActive;
  final String createdAt;
  final String updatedAt;
  final String publishedAt;
  final String? locale;
  final LicenseInfo license;

  KeySeat({
    required this.id,
    required this.documentId,
    required this.machineUUID,
    this.userSocketId,
    this.telemetry,
    required this.isActive,
    required this.createdAt,
    required this.updatedAt,
    required this.publishedAt,
    this.locale,
    required this.license,
  });

  factory KeySeat.fromJson(Map<String, dynamic> json) {
    return KeySeat(
      id: json['id'] as int,
      documentId: json['documentId'] as String,
      machineUUID: json['machineUUID'] as String,
      userSocketId: json['userSocketId'] as String?,
      telemetry: json['telemetry'] as Map<String, dynamic>?,
      isActive: json['isActive'] as bool,
      createdAt: json['createdAt'] as String,
      updatedAt: json['updatedAt'] as String,
      publishedAt: json['publishedAt'] as String,
      locale: json['locale'] as String?,
      license: LicenseInfo.fromJson(json['license']),
    );
  }
}

class LicenseInfo {
  final String documentId;
  final String licenseKey;
  final String planSubscriptionType;

  LicenseInfo({
    required this.documentId,
    required this.licenseKey,
    required this.planSubscriptionType,
  });

  factory LicenseInfo.fromJson(Map<String, dynamic> json) {
    return LicenseInfo(
      documentId: json['documentId'] as String,
      licenseKey: json['licenseKey'] as String,
      planSubscriptionType: json['planSubscriptionType'] as String,
    );
  }
}

class MetaInfo {
  final int total;

  MetaInfo({required this.total});

  factory MetaInfo.fromJson(Map<String, dynamic> json) {
    return MetaInfo(total: json['total'] as int);
  }
}
```

**Success Response (200)**:
```json
{
  "data": [
    {
      "id": 1,
      "documentId": "abc123def456",
      "machineUUID": "POS-001",
      "userSocketId": "socket-id-xyz",
      "telemetry": {
        "cpuUsage": 45,
        "memoryUsage": 60,
        "transactionsToday": 150
      },
      "isActive": true,
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z",
      "publishedAt": "2024-01-15T10:00:00.000Z",
      "locale": null,
      "license": {
        "documentId": "lic-doc-id-123",
        "licenseKey": "your-license-key",
        "planSubscriptionType": "Pro"
      }
    }
  ],
  "meta": {
    "total": 1
  }
}
```

**Error Responses**:

- **401 Unauthorized**:
```json
{
  "error": {
    "status": 401,
    "name": "UnauthorizedError",
    "message": "Authentication required"
  }
}
```

- **500 Internal Server Error**:
```json
{
  "error": {
    "status": 500,
    "name": "InternalServerError",
    "message": "Failed to fetch seats"
  }
}
```

**Usage Example**:
```dart
Future<List<KeySeat>> fetchMySeats(String jwtToken) async {
  try {
    final dio = Dio();
    final response = await dio.get(
      'https://your-server.com/api/key-seats/my-seats',
      options: Options(
        headers: {
          'Authorization': 'Bearer $jwtToken',
          'Content-Type': 'application/json',
        },
      ),
    );

    final result = MySeatsResponse.fromJson(response.data);
    return result.data;
  } catch (error) {
    print('Failed to fetch seats: $error');
    rethrow;
  }
}
```

---

#### 2. GET `/seat-telemetry-history/query` - Query Telemetry History

**Purpose**: Retrieve historical telemetry data with filtering and pagination

**Method**: `GET`

**Authentication**: Required (JWT Bearer token)

**Query Parameters**:
```dart
class TelemetryHistoryQueryParams {
  final String? machineUUID;    // Filter by specific machine (optional)
  final String? startDate;      // ISO 8601 date string (optional)
  final String? endDate;        // ISO 8601 date string (optional)
  final int? page;              // Page number (default: 1)
  final int? pageSize;          // Records per page (default: 100, max: 1000)

  TelemetryHistoryQueryParams({
    this.machineUUID,
    this.startDate,
    this.endDate,
    this.page,
    this.pageSize,
  });

  Map<String, dynamic> toQueryParams() {
    final params = <String, dynamic>{};
    if (machineUUID != null) params['machineUUID'] = machineUUID;
    if (startDate != null) params['startDate'] = startDate;
    if (endDate != null) params['endDate'] = endDate;
    if (page != null) params['page'] = page.toString();
    if (pageSize != null) params['pageSize'] = pageSize.toString();
    return params;
  }
}
```

**Request Example**:
```dart
final params = TelemetryHistoryQueryParams(
  machineUUID: 'POS-001',
  startDate: '2024-01-01T00:00:00Z',
  endDate: '2024-01-31T23:59:59Z',
  page: 1,
  pageSize: 50,
);

final response = await dio.get(
  'https://your-server.com/api/seat-telemetry-history/query',
  queryParameters: params.toQueryParams(),
  options: Options(
    headers: {
      'Authorization': 'Bearer $jwtToken',
      'Content-Type': 'application/json',
    },
  ),
);
```

**Response Type**:
```dart
class TelemetryHistoryResponse {
  final List<TelemetryHistoryRecord> data;
  final HistoryMetaInfo meta;

  TelemetryHistoryResponse({
    required this.data,
    required this.meta,
  });

  factory TelemetryHistoryResponse.fromJson(Map<String, dynamic> json) {
    return TelemetryHistoryResponse(
      data: (json['data'] as List)
          .map((item) => TelemetryHistoryRecord.fromJson(item))
          .toList(),
      meta: HistoryMetaInfo.fromJson(json['meta']),
    );
  }
}

class TelemetryHistoryRecord {
  final int id;
  final String documentId;
  final String capturedAt;
  final String snapshotType;
  final Map<String, dynamic> telemetryData;
  final String createdAt;
  final String updatedAt;
  final String publishedAt;
  final String? locale;
  final KeySeatInfo keySeat;

  TelemetryHistoryRecord({
    required this.id,
    required this.documentId,
    required this.capturedAt,
    required this.snapshotType,
    required this.telemetryData,
    required this.createdAt,
    required this.updatedAt,
    required this.publishedAt,
    this.locale,
    required this.keySeat,
  });

  factory TelemetryHistoryRecord.fromJson(Map<String, dynamic> json) {
    return TelemetryHistoryRecord(
      id: json['id'] as int,
      documentId: json['documentId'] as String,
      capturedAt: json['capturedAt'] as String,
      snapshotType: json['snapshotType'] as String,
      telemetryData: json['telemetryData'] as Map<String, dynamic>,
      createdAt: json['createdAt'] as String,
      updatedAt: json['updatedAt'] as String,
      publishedAt: json['publishedAt'] as String,
      locale: json['locale'] as String?,
      keySeat: KeySeatInfo.fromJson(json['keySeat']),
    );
  }
}

class KeySeatInfo {
  final String documentId;
  final String machineUUID;

  KeySeatInfo({
    required this.documentId,
    required this.machineUUID,
  });

  factory KeySeatInfo.fromJson(Map<String, dynamic> json) {
    return KeySeatInfo(
      documentId: json['documentId'] as String,
      machineUUID: json['machineUUID'] as String,
    );
  }
}

class HistoryMetaInfo {
  final int page;
  final int pageSize;
  final int total;

  HistoryMetaInfo({
    required this.page,
    required this.pageSize,
    required this.total,
  });

  factory HistoryMetaInfo.fromJson(Map<String, dynamic> json) {
    return HistoryMetaInfo(
      page: json['page'] as int,
      pageSize: json['pageSize'] as int,
      total: json['total'] as int,
    );
  }
}
```

**Success Response (200)**:
```json
{
  "data": [
    {
      "id": 1,
      "documentId": "hist-doc-id-123",
      "capturedAt": "2024-01-15T10:30:00.000Z",
      "snapshotType": "scheduled",
      "telemetryData": {
        "cpuUsage": 45,
        "memoryUsage": 60,
        "transactionsToday": 150,
        "diskSpace": 250
      },
      "createdAt": "2024-01-15T10:30:05.000Z",
      "updatedAt": "2024-01-15T10:30:05.000Z",
      "publishedAt": "2024-01-15T10:30:05.000Z",
      "locale": null,
      "keySeat": {
        "documentId": "seat-doc-id-456",
        "machineUUID": "POS-001"
      }
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 50,
    "total": 1
  }
}
```

**Error Responses**:

- **401 Unauthorized**:
```json
{
  "error": {
    "status": 401,
    "name": "UnauthorizedError",
    "message": "Authentication required"
  }
}
```

- **403 Forbidden**:
```json
{
  "error": {
    "status": 403,
    "name": "ForbiddenError",
    "message": "You do not have access to this seat"
  }
}
```

- **404 Not Found**:
```json
{
  "error": {
    "status": 404,
    "name": "NotFoundError",
    "message": "Seat not found"
  }
}
```

**Usage Example**:
```dart
Future<List<TelemetryHistoryRecord>> fetchTelemetryHistory({
  required String jwtToken,
  String? machineUUID,
  DateTime? startDate,
  DateTime? endDate,
}) async {
  try {
    final dio = Dio();
    final params = TelemetryHistoryQueryParams(
      machineUUID: machineUUID,
      startDate: startDate?.toIso8601String(),
      endDate: endDate?.toIso8601String(),
      page: 1,
      pageSize: 100,
    );

    final response = await dio.get(
      'https://your-server.com/api/seat-telemetry-history/query',
      queryParameters: params.toQueryParams(),
      options: Options(
        headers: {
          'Authorization': 'Bearer $jwtToken',
          'Content-Type': 'application/json',
        },
      ),
    );

    final result = TelemetryHistoryResponse.fromJson(response.data);
    return result.data;
  } catch (error) {
    print('Failed to fetch telemetry history: $error');
    rethrow;
  }
}
```

---


## Data Models

### Complete Dart Type Definitions

```dart
// ============================================
// Authentication & Connection
// ============================================

class MobileConnectionConfig {
  final String serverUrl;
  final String jwtToken;

  MobileConnectionConfig({
    required this.serverUrl,
    required this.jwtToken,
  });
}

// ============================================
// Socket.IO Event Payloads
// ============================================

class SeatSubscribePayload {
  // Empty for now, may include filters in future
  
  Map<String, dynamic> toJson() => {};
}

class SeatSubscribeSuccessResponse {
  final bool success;
  final String? message;
  final String? error;

  SeatSubscribeSuccessResponse({
    required this.success,
    this.message,
    this.error,
  });

  factory SeatSubscribeSuccessResponse.fromJson(Map<String, dynamic> json) {
    return SeatSubscribeSuccessResponse(
      success: json['success'] as bool,
      message: json['message'] as String?,
      error: json['error'] as String?,
    );
  }
}

class SeatUpdatedNotification {
  final String machineUUID;
  final Map<String, dynamic> telemetry;
  final bool isActive;
  final String updatedAt;
  final String licenseDocumentId;

  SeatUpdatedNotification({
    required this.machineUUID,
    required this.telemetry,
    required this.isActive,
    required this.updatedAt,
    required this.licenseDocumentId,
  });

  factory SeatUpdatedNotification.fromJson(Map<String, dynamic> json) {
    return SeatUpdatedNotification(
      machineUUID: json['machineUUID'] as String,
      telemetry: json['telemetry'] as Map<String, dynamic>,
      isActive: json['isActive'] as bool,
      updatedAt: json['updatedAt'] as String,
      licenseDocumentId: json['licenseDocumentId'] as String,
    );
  }
}

class UnauthorizedErrorResponse {
  final bool socketConnected;
  final bool credentialsExp;
  final ErrorDetails error;

  UnauthorizedErrorResponse({
    required this.socketConnected,
    required this.credentialsExp,
    required this.error,
  });

  factory UnauthorizedErrorResponse.fromJson(Map<String, dynamic> json) {
    return UnauthorizedErrorResponse(
      socketConnected: json['socketConnected'] as bool,
      credentialsExp: json['credentialsExp'] as bool,
      error: ErrorDetails.fromJson(json['error']),
    );
  }
}

class ErrorDetails {
  final int status;
  final String name;
  final String message;
  final Map<String, dynamic> details;

  ErrorDetails({
    required this.status,
    required this.name,
    required this.message,
    required this.details,
  });

  factory ErrorDetails.fromJson(Map<String, dynamic> json) {
    return ErrorDetails(
      status: json['status'] as int,
      name: json['name'] as String,
      message: json['message'] as String,
      details: json['details'] as Map<String, dynamic>,
    );
  }
}

// ============================================
// HTTP API Models
// ============================================

class MySeatsResponse {
  final List<KeySeat> data;
  final MetaInfo meta;

  MySeatsResponse({
    required this.data,
    required this.meta,
  });

  factory MySeatsResponse.fromJson(Map<String, dynamic> json) {
    return MySeatsResponse(
      data: (json['data'] as List)
          .map((item) => KeySeat.fromJson(item))
          .toList(),
      meta: MetaInfo.fromJson(json['meta']),
    );
  }
}

class KeySeat {
  final int id;
  final String documentId;
  final String machineUUID;
  final String? userSocketId;
  final Map<String, dynamic>? telemetry;
  final bool isActive;
  final String createdAt;
  final String updatedAt;
  final String publishedAt;
  final String? locale;
  final LicenseInfo license;

  KeySeat({
    required this.id,
    required this.documentId,
    required this.machineUUID,
    this.userSocketId,
    this.telemetry,
    required this.isActive,
    required this.createdAt,
    required this.updatedAt,
    required this.publishedAt,
    this.locale,
    required this.license,
  });

  factory KeySeat.fromJson(Map<String, dynamic> json) {
    return KeySeat(
      id: json['id'] as int,
      documentId: json['documentId'] as String,
      machineUUID: json['machineUUID'] as String,
      userSocketId: json['userSocketId'] as String?,
      telemetry: json['telemetry'] as Map<String, dynamic>?,
      isActive: json['isActive'] as bool,
      createdAt: json['createdAt'] as String,
      updatedAt: json['updatedAt'] as String,
      publishedAt: json['publishedAt'] as String,
      locale: json['locale'] as String?,
      license: LicenseInfo.fromJson(json['license']),
    );
  }
}

class LicenseInfo {
  final String documentId;
  final String licenseKey;
  final String planSubscriptionType;

  LicenseInfo({
    required this.documentId,
    required this.licenseKey,
    required this.planSubscriptionType,
  });

  factory LicenseInfo.fromJson(Map<String, dynamic> json) {
    return LicenseInfo(
      documentId: json['documentId'] as String,
      licenseKey: json['licenseKey'] as String,
      planSubscriptionType: json['planSubscriptionType'] as String,
    );
  }
}

class MetaInfo {
  final int total;

  MetaInfo({required this.total});

  factory MetaInfo.fromJson(Map<String, dynamic> json) {
    return MetaInfo(total: json['total'] as int);
  }
}

class TelemetryHistoryResponse {
  final List<TelemetryHistoryRecord> data;
  final HistoryMetaInfo meta;

  TelemetryHistoryResponse({
    required this.data,
    required this.meta,
  });

  factory TelemetryHistoryResponse.fromJson(Map<String, dynamic> json) {
    return TelemetryHistoryResponse(
      data: (json['data'] as List)
          .map((item) => TelemetryHistoryRecord.fromJson(item))
          .toList(),
      meta: HistoryMetaInfo.fromJson(json['meta']),
    );
  }
}

class TelemetryHistoryRecord {
  final int id;
  final String documentId;
  final String capturedAt;
  final String snapshotType;
  final Map<String, dynamic> telemetryData;
  final String createdAt;
  final String updatedAt;
  final String publishedAt;
  final String? locale;
  final KeySeatInfo keySeat;

  TelemetryHistoryRecord({
    required this.id,
    required this.documentId,
    required this.capturedAt,
    required this.snapshotType,
    required this.telemetryData,
    required this.createdAt,
    required this.updatedAt,
    required this.publishedAt,
    this.locale,
    required this.keySeat,
  });

  factory TelemetryHistoryRecord.fromJson(Map<String, dynamic> json) {
    return TelemetryHistoryRecord(
      id: json['id'] as int,
      documentId: json['documentId'] as String,
      capturedAt: json['capturedAt'] as String,
      snapshotType: json['snapshotType'] as String,
      telemetryData: json['telemetryData'] as Map<String, dynamic>,
      createdAt: json['createdAt'] as String,
      updatedAt: json['updatedAt'] as String,
      publishedAt: json['publishedAt'] as String,
      locale: json['locale'] as String?,
      keySeat: KeySeatInfo.fromJson(json['keySeat']),
    );
  }
}

class KeySeatInfo {
  final String documentId;
  final String machineUUID;

  KeySeatInfo({
    required this.documentId,
    required this.machineUUID,
  });

  factory KeySeatInfo.fromJson(Map<String, dynamic> json) {
    return KeySeatInfo(
      documentId: json['documentId'] as String,
      machineUUID: json['machineUUID'] as String,
    );
  }
}

class HistoryMetaInfo {
  final int page;
  final int pageSize;
  final int total;

  HistoryMetaInfo({
    required this.page,
    required this.pageSize,
    required this.total,
  });

  factory HistoryMetaInfo.fromJson(Map<String, dynamic> json) {
    return HistoryMetaInfo(
      page: json['page'] as int,
      pageSize: json['pageSize'] as int,
      total: json['total'] as int,
    );
  }
}

class TelemetryHistoryQueryParams {
  final String? machineUUID;
  final String? startDate;
  final String? endDate;
  final int? page;
  final int? pageSize;

  TelemetryHistoryQueryParams({
    this.machineUUID,
    this.startDate,
    this.endDate,
    this.page,
    this.pageSize,
  });

  Map<String, dynamic> toQueryParams() {
    final params = <String, dynamic>{};
    if (machineUUID != null) params['machineUUID'] = machineUUID;
    if (startDate != null) params['startDate'] = startDate;
    if (endDate != null) params['endDate'] = endDate;
    if (page != null) params['page'] = page.toString();
    if (pageSize != null) params['pageSize'] = pageSize.toString();
    return params;
  }
}

// ============================================
// Telemetry Data Structure
// ============================================

class TelemetryData {
  final String? osVersion;
  final String? appVersion;
  final double? cpuUsage;
  final double? memoryUsage;
  final double? diskSpace;
  final int? transactionsToday;
  final String? lastTransactionTime;
  final String? cashDrawerStatus;
  final String? printerStatus;
  final String? networkStatus;
  final String? lastSyncTime;
  final double? temperature;
  final int? errorCount;
  final Map<String, dynamic>? customFields;

  TelemetryData({
    this.osVersion,
    this.appVersion,
    this.cpuUsage,
    this.memoryUsage,
    this.diskSpace,
    this.transactionsToday,
    this.lastTransactionTime,
    this.cashDrawerStatus,
    this.printerStatus,
    this.networkStatus,
    this.lastSyncTime,
    this.temperature,
    this.errorCount,
    this.customFields,
  });

  factory TelemetryData.fromJson(Map<String, dynamic> json) {
    return TelemetryData(
      osVersion: json['osVersion'] as String?,
      appVersion: json['appVersion'] as String?,
      cpuUsage: (json['cpuUsage'] as num?)?.toDouble(),
      memoryUsage: (json['memoryUsage'] as num?)?.toDouble(),
      diskSpace: (json['diskSpace'] as num?)?.toDouble(),
      transactionsToday: json['transactionsToday'] as int?,
      lastTransactionTime: json['lastTransactionTime'] as String?,
      cashDrawerStatus: json['cashDrawerStatus'] as String?,
      printerStatus: json['printerStatus'] as String?,
      networkStatus: json['networkStatus'] as String?,
      lastSyncTime: json['lastSyncTime'] as String?,
      temperature: (json['temperature'] as num?)?.toDouble(),
      errorCount: json['errorCount'] as int?,
      customFields: json,
    );
  }

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    if (osVersion != null) json['osVersion'] = osVersion;
    if (appVersion != null) json['appVersion'] = appVersion;
    if (cpuUsage != null) json['cpuUsage'] = cpuUsage;
    if (memoryUsage != null) json['memoryUsage'] = memoryUsage;
    if (diskSpace != null) json['diskSpace'] = diskSpace;
    if (transactionsToday != null) json['transactionsToday'] = transactionsToday;
    if (lastTransactionTime != null) json['lastTransactionTime'] = lastTransactionTime;
    if (cashDrawerStatus != null) json['cashDrawerStatus'] = cashDrawerStatus;
    if (printerStatus != null) json['printerStatus'] = printerStatus;
    if (networkStatus != null) json['networkStatus'] = networkStatus;
    if (lastSyncTime != null) json['lastSyncTime'] = lastSyncTime;
    if (temperature != null) json['temperature'] = temperature;
    if (errorCount != null) json['errorCount'] = errorCount;
    if (customFields != null) json.addAll(customFields!);
    return json;
  }
}
```

---


## Implementation Guide

### Step-by-Step Integration

#### Step 1: Add Dependencies

Add to `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  socket_io_client: ^2.0.3+1
  dio: ^5.4.0
  flutter_secure_storage: ^9.0.0
  provider: ^6.1.1  # For state management (optional)
```

Run:
```bash
flutter pub get
```

---

#### Step 2: Create Socket Service

Create `lib/services/mobile_socket_service.dart`:

```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;

class MobileSocketService {
  IO.Socket? _socket;
  final String serverUrl;
  final String jwtToken;
  bool _isConnected = false;
  bool _isSubscribed = false;

  // Callbacks
  Function(SeatUpdatedNotification)? onSeatUpdated;
  Function()? onConnected;
  Function()? onDisconnected;
  Function(String)? onError;

  MobileSocketService({
    required this.serverUrl,
    required this.jwtToken,
  });

  Future<void> connect() async {
    _socket = IO.io(
      serverUrl,
      IO.OptionBuilder()
        .setTransports(['websocket', 'polling'])
        .setQuery({'token': jwtToken})
        .enableReconnection()
        .setReconnectionDelay(1000)
        .setReconnectionDelayMax(5000)
        .setReconnectionAttempts(999999)
        .setTimeout(20000)
        .build(),
    );

    _setupEventListeners();
    _socket!.connect();
  }

  void _setupEventListeners() {
    _socket!.on('connect', (_) {
      print('✅ Connected to server: ${_socket!.id}');
      _isConnected = true;
      onConnected?.call();
    });

    _socket!.on('disconnect', (_) {
      print('❌ Disconnected from server');
      _isConnected = false;
      _isSubscribed = false;
      onDisconnected?.call();
    });

    _socket!.on('connect_error', (error) {
      print('❌ Connection error: $error');
      _isConnected = false;
      onError?.call('Connection error: $error');
    });

    _socket!.on('UnauthorizedError', (data) {
      print('🚫 Unauthorized: $data');
      _isConnected = false;
      final error = UnauthorizedErrorResponse.fromJson(data);
      onError?.call(error.error.message);
    });

    _socket!.on('seat:subscribe:success', (data) {
      final response = SeatSubscribeSuccessResponse.fromJson(data);
      if (response.success) {
        print('✅ Subscribed to seat updates');
        _isSubscribed = true;
      } else {
        print('❌ Subscription failed: ${response.error}');
        _isSubscribed = false;
        onError?.call(response.error ?? 'Subscription failed');
      }
    });

    _socket!.on('seat:updated', (data) {
      print('🔔 Seat update received');
      final update = SeatUpdatedNotification.fromJson(data);
      onSeatUpdated?.call(update);
    });
  }

  void subscribeToSeats() {
    if (_socket == null || !_isConnected) {
      print('⚠️ Not connected to server');
      return;
    }

    print('📡 Subscribing to seat updates...');
    _socket!.emit('seat:subscribe', {});
  }

  void unsubscribeFromSeats() {
    if (_socket == null || !_isConnected) {
      return;
    }

    print('📡 Unsubscribing from seat updates...');
    _socket!.emit('seat:unsubscribe');
    _isSubscribed = false;
  }

  void disconnect() {
    if (_socket != null) {
      _socket!.disconnect();
      _socket!.dispose();
      _socket = null;
    }
    _isConnected = false;
    _isSubscribed = false;
  }

  bool get isConnected => _isConnected;
  bool get isSubscribed => _isSubscribed;
}
```

---

#### Step 3: Create HTTP API Service

Create `lib/services/mobile_api_service.dart`:

```dart
import 'package:dio/dio.dart';

class MobileApiService {
  final Dio _dio;
  final String baseUrl;
  final String jwtToken;

  MobileApiService({
    required this.baseUrl,
    required this.jwtToken,
  }) : _dio = Dio(BaseOptions(
          baseUrl: baseUrl,
          headers: {
            'Authorization': 'Bearer $jwtToken',
            'Content-Type': 'application/json',
          },
        ));

  Future<List<KeySeat>> fetchMySeats() async {
    try {
      final response = await _dio.get('/api/key-seats/my-seats');
      final result = MySeatsResponse.fromJson(response.data);
      return result.data;
    } on DioException catch (e) {
      print('Error fetching seats: ${e.message}');
      rethrow;
    }
  }

  Future<List<TelemetryHistoryRecord>> fetchTelemetryHistory({
    String? machineUUID,
    DateTime? startDate,
    DateTime? endDate,
    int page = 1,
    int pageSize = 100,
  }) async {
    try {
      final params = TelemetryHistoryQueryParams(
        machineUUID: machineUUID,
        startDate: startDate?.toIso8601String(),
        endDate: endDate?.toIso8601String(),
        page: page,
        pageSize: pageSize,
      );

      final response = await _dio.get(
        '/api/seat-telemetry-history/query',
        queryParameters: params.toQueryParams(),
      );

      final result = TelemetryHistoryResponse.fromJson(response.data);
      return result.data;
    } on DioException catch (e) {
      print('Error fetching telemetry history: ${e.message}');
      rethrow;
    }
  }
}
```

---

#### Step 4: Create State Management (Provider)

Create `lib/providers/seat_provider.dart`:

```dart
import 'package:flutter/foundation.dart';

class SeatProvider with ChangeNotifier {
  final MobileSocketService _socketService;
  final MobileApiService _apiService;

  List<KeySeat> _seats = [];
  bool _isConnected = false;
  bool _isSubscribed = false;
  String? _errorMessage;

  SeatProvider({
    required MobileSocketService socketService,
    required MobileApiService apiService,
  })  : _socketService = socketService,
        _apiService = apiService {
    _setupSocketCallbacks();
  }

  List<KeySeat> get seats => _seats;
  bool get isConnected => _isConnected;
  bool get isSubscribed => _isSubscribed;
  String? get errorMessage => _errorMessage;

  void _setupSocketCallbacks() {
    _socketService.onConnected = () {
      _isConnected = true;
      _errorMessage = null;
      notifyListeners();
    };

    _socketService.onDisconnected = () {
      _isConnected = false;
      _isSubscribed = false;
      notifyListeners();
    };

    _socketService.onError = (error) {
      _errorMessage = error;
      notifyListeners();
    };

    _socketService.onSeatUpdated = (update) {
      _handleSeatUpdate(update);
    };
  }

  void _handleSeatUpdate(SeatUpdatedNotification update) {
    final index = _seats.indexWhere((s) => s.machineUUID == update.machineUUID);
    if (index != -1) {
      _seats[index] = KeySeat(
        id: _seats[index].id,
        documentId: _seats[index].documentId,
        machineUUID: update.machineUUID,
        userSocketId: _seats[index].userSocketId,
        telemetry: update.telemetry,
        isActive: update.isActive,
        createdAt: _seats[index].createdAt,
        updatedAt: update.updatedAt,
        publishedAt: _seats[index].publishedAt,
        locale: _seats[index].locale,
        license: _seats[index].license,
      );
      notifyListeners();
    }
  }

  Future<void> connect() async {
    try {
      await _socketService.connect();
    } catch (e) {
      _errorMessage = 'Failed to connect: $e';
      notifyListeners();
    }
  }

  void disconnect() {
    _socketService.disconnect();
  }

  void subscribeToSeats() {
    _socketService.subscribeToSeats();
    _isSubscribed = true;
    notifyListeners();
  }

  void unsubscribeFromSeats() {
    _socketService.unsubscribeFromSeats();
    _isSubscribed = false;
    notifyListeners();
  }

  Future<void> fetchSeats() async {
    try {
      _seats = await _apiService.fetchMySeats();
      _errorMessage = null;
      notifyListeners();
    } catch (e) {
      _errorMessage = 'Failed to fetch seats: $e';
      notifyListeners();
    }
  }

  Future<List<TelemetryHistoryRecord>> fetchHistory({
    String? machineUUID,
    DateTime? startDate,
    DateTime? endDate,
  }) async {
    try {
      return await _apiService.fetchTelemetryHistory(
        machineUUID: machineUUID,
        startDate: startDate,
        endDate: endDate,
      );
    } catch (e) {
      _errorMessage = 'Failed to fetch history: $e';
      notifyListeners();
      rethrow;
    }
  }

  @override
  void dispose() {
    _socketService.disconnect();
    super.dispose();
  }
}
```

---

#### Step 5: Setup in Main App

Update `lib/main.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Retrieve JWT token from secure storage
  const storage = FlutterSecureStorage();
  final jwtToken = await storage.read(key: 'jwt_token') ?? '';
  
  // Initialize services
  final socketService = MobileSocketService(
    serverUrl: 'https://your-server.com',
    jwtToken: jwtToken,
  );
  
  final apiService = MobileApiService(
    baseUrl: 'https://your-server.com',
    jwtToken: jwtToken,
  );
  
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(
          create: (_) => SeatProvider(
            socketService: socketService,
            apiService: apiService,
          ),
        ),
      ],
      child: const MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'POS Monitor',
      theme: ThemeData(
        primarySwatch: Colors.blue,
      ),
      home: const HomeScreen(),
    );
  }
}
```

---

#### Step 6: Create UI Screen

Create `lib/screens/home_screen.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({Key? key}) : super(key: key);

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  @override
  void initState() {
    super.initState();
    _initialize();
  }

  Future<void> _initialize() async {
    final provider = context.read<SeatProvider>();
    await provider.connect();
    await provider.fetchSeats();
    provider.subscribeToSeats();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('POS Monitor'),
        actions: [
          Consumer<SeatProvider>(
            builder: (context, provider, child) {
              return IconButton(
                icon: Icon(
                  provider.isConnected ? Icons.cloud_done : Icons.cloud_off,
                  color: provider.isConnected ? Colors.green : Colors.red,
                ),
                onPressed: () {
                  if (provider.isConnected) {
                    provider.disconnect();
                  } else {
                    provider.connect();
                  }
                },
              );
            },
          ),
        ],
      ),
      body: Consumer<SeatProvider>(
        builder: (context, provider, child) {
          if (provider.errorMessage != null) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error, size: 64, color: Colors.red),
                  const SizedBox(height: 16),
                  Text(provider.errorMessage!),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () => provider.connect(),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            );
          }

          if (provider.seats.isEmpty) {
            return const Center(
              child: CircularProgressIndicator(),
            );
          }

          return RefreshIndicator(
            onRefresh: () => provider.fetchSeats(),
            child: ListView.builder(
              itemCount: provider.seats.length,
              itemBuilder: (context, index) {
                final seat = provider.seats[index];
                return SeatCard(seat: seat);
              },
            ),
          );
        },
      ),
      floatingActionButton: Consumer<SeatProvider>(
        builder: (context, provider, child) {
          return FloatingActionButton(
            onPressed: () {
              if (provider.isSubscribed) {
                provider.unsubscribeFromSeats();
              } else {
                provider.subscribeToSeats();
              }
            },
            child: Icon(
              provider.isSubscribed ? Icons.notifications_active : Icons.notifications_off,
            ),
          );
        },
      ),
    );
  }
}

class SeatCard extends StatelessWidget {
  final KeySeat seat;

  const SeatCard({Key? key, required this.seat}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.all(8),
      child: ListTile(
        leading: Icon(
          Icons.computer,
          color: seat.isActive ? Colors.green : Colors.red,
          size: 40,
        ),
        title: Text(seat.machineUUID),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Plan: ${seat.license.planSubscriptionType}'),
            Text('Status: ${seat.isActive ? "Active" : "Inactive"}'),
            if (seat.telemetry != null)
              Text('CPU: ${seat.telemetry!['cpuUsage']}%'),
          ],
        ),
        trailing: IconButton(
          icon: const Icon(Icons.info),
          onPressed: () {
            _showSeatDetails(context, seat);
          },
        ),
      ),
    );
  }

  void _showSeatDetails(BuildContext context, KeySeat seat) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(seat.machineUUID),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('License: ${seat.license.licenseKey}'),
              Text('Plan: ${seat.license.planSubscriptionType}'),
              Text('Status: ${seat.isActive ? "Active" : "Inactive"}'),
              const SizedBox(height: 16),
              const Text('Telemetry:', style: TextStyle(fontWeight: FontWeight.bold)),
              if (seat.telemetry != null)
                ...seat.telemetry!.entries.map((e) => Text('${e.key}: ${e.value}')),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }
}
```

---


## Error Handling

### Common Errors and Solutions

#### 1. Authentication Errors

**Error**: `UnauthorizedError - Missing or invalid credentials`

**Causes**:
- JWT token is expired
- JWT token is invalid or malformed
- User doesn't exist in database

**Solutions**:
```dart
socket.on('UnauthorizedError', (data) {
  final error = UnauthorizedErrorResponse.fromJson(data);
  
  // Log user out and redirect to login
  _handleAuthenticationFailure(error.error.message);
});

void _handleAuthenticationFailure(String message) {
  // Clear stored token
  secureStorage.delete(key: 'jwt_token');
  
  // Show error dialog
  showDialog(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Authentication Failed'),
      content: Text(message),
      actions: [
        TextButton(
          onPressed: () {
            Navigator.pop(context);
            // Navigate to login screen
            Navigator.pushReplacementNamed(context, '/login');
          },
          child: const Text('Login Again'),
        ),
      ],
    ),
  );
}
```

---

#### 2. Connection Errors

**Error**: `connect_error` or `connect_timeout`

**Causes**:
- Server is down or unreachable
- Network connectivity issues
- Firewall blocking connection

**Solutions**:
```dart
socket.on('connect_error', (error) {
  print('Connection error: $error');
  
  // Show retry dialog
  _showRetryDialog();
});

void _showRetryDialog() {
  showDialog(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Connection Failed'),
      content: const Text('Unable to connect to server. Check your internet connection.'),
      actions: [
        TextButton(
          onPressed: () {
            Navigator.pop(context);
            // Retry connection
            socketService.connect();
          },
          child: const Text('Retry'),
        ),
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
      ],
    ),
  );
}
```

---

#### 3. Subscription Errors

**Error**: `seat:subscribe:success` with `success: false`

**Causes**:
- User document ID not found
- User has no seats
- Database error

**Solutions**:
```dart
socket.on('seat:subscribe:success', (data) {
  final response = SeatSubscribeSuccessResponse.fromJson(data);
  
  if (!response.success) {
    print('Subscription failed: ${response.error}');
    
    // Show error to user
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Failed to subscribe: ${response.error}'),
        backgroundColor: Colors.red,
        action: SnackBarAction(
          label: 'Retry',
          onPressed: () => socketService.subscribeToSeats(),
        ),
      ),
    );
  }
});
```

---

#### 4. HTTP API Errors

**Error**: HTTP 401, 403, 404, 500

**Solutions**:
```dart
Future<List<KeySeat>> fetchMySeats() async {
  try {
    final response = await dio.get('/api/key-seats/my-seats');
    return MySeatsResponse.fromJson(response.data).data;
  } on DioException catch (e) {
    if (e.response != null) {
      switch (e.response!.statusCode) {
        case 401:
          // Authentication required
          throw AuthenticationException('Please login again');
        case 403:
          // Forbidden
          throw AuthorizationException('Access denied');
        case 404:
          // Not found
          throw NotFoundException('Resource not found');
        case 500:
          // Server error
          throw ServerException('Server error, please try again later');
        default:
          throw ApiException('Unknown error: ${e.response!.statusCode}');
      }
    } else {
      // Network error
      throw NetworkException('Network error, check your connection');
    }
  }
}

// Custom exception classes
class AuthenticationException implements Exception {
  final String message;
  AuthenticationException(this.message);
}

class AuthorizationException implements Exception {
  final String message;
  AuthorizationException(this.message);
}

class NotFoundException implements Exception {
  final String message;
  NotFoundException(this.message);
}

class ServerException implements Exception {
  final String message;
  ServerException(this.message);
}

class NetworkException implements Exception {
  final String message;
  NetworkException(this.message);
}

class ApiException implements Exception {
  final String message;
  ApiException(this.message);
}
```

---

#### 5. Disconnection Handling

**Error**: Unexpected disconnection

**Solutions**:
```dart
socket.on('disconnect', (reason) {
  print('Disconnected: $reason');
  
  if (reason == 'io server disconnect') {
    // Server forcefully disconnected the socket
    // Manual reconnection required
    _showReconnectDialog();
  } else {
    // Automatic reconnection will be attempted
    _showReconnectingSnackbar();
  }
});

void _showReconnectDialog() {
  showDialog(
    context: context,
    barrierDismissible: false,
    builder: (context) => AlertDialog(
      title: const Text('Disconnected'),
      content: const Text('Connection to server was lost. Reconnect?'),
      actions: [
        TextButton(
          onPressed: () {
            Navigator.pop(context);
            socketService.connect();
          },
          child: const Text('Reconnect'),
        ),
      ],
    ),
  );
}

void _showReconnectingSnackbar() {
  ScaffoldMessenger.of(context).showSnackBar(
    const SnackBar(
      content: Text('Connection lost. Reconnecting...'),
      duration: Duration(seconds: 3),
    ),
  );
}
```

---


## Best Practices

### 1. Token Management

**Secure Storage**:
```dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class TokenManager {
  static const _storage = FlutterSecureStorage();
  static const _tokenKey = 'jwt_token';

  static Future<void> saveToken(String token) async {
    await _storage.write(key: _tokenKey, value: token);
  }

  static Future<String?> getToken() async {
    return await _storage.read(key: _tokenKey);
  }

  static Future<void> deleteToken() async {
    await _storage.delete(key: _tokenKey);
  }

  static Future<bool> hasToken() async {
    final token = await getToken();
    return token != null && token.isNotEmpty;
  }
}
```

**Token Refresh**:
```dart
class AuthService {
  Future<String> refreshToken(String oldToken) async {
    try {
      final response = await dio.post(
        '/api/auth/refresh',
        data: {'token': oldToken},
      );
      
      final newToken = response.data['jwt'];
      await TokenManager.saveToken(newToken);
      return newToken;
    } catch (e) {
      throw AuthenticationException('Failed to refresh token');
    }
  }
}
```

---

### 2. Connection Management

**Automatic Reconnection**:
```dart
class MobileSocketService {
  Timer? _reconnectTimer;
  int _reconnectAttempts = 0;
  static const _maxReconnectAttempts = 5;

  void _handleDisconnect() {
    _isConnected = false;
    _isSubscribed = false;
    
    if (_reconnectAttempts < _maxReconnectAttempts) {
      _reconnectAttempts++;
      _reconnectTimer = Timer(
        Duration(seconds: _reconnectAttempts * 2),
        () => connect(),
      );
    } else {
      onError?.call('Max reconnection attempts reached');
    }
  }

  void _handleConnect() {
    _isConnected = true;
    _reconnectAttempts = 0;
    _reconnectTimer?.cancel();
    onConnected?.call();
  }
}
```

**Connection State Monitoring**:
```dart
class ConnectionMonitor {
  final MobileSocketService socketService;
  StreamController<ConnectionState> _stateController = StreamController.broadcast();

  Stream<ConnectionState> get stateStream => _stateController.stream;

  ConnectionMonitor(this.socketService) {
    socketService.onConnected = () {
      _stateController.add(ConnectionState.connected);
    };

    socketService.onDisconnected = () {
      _stateController.add(ConnectionState.disconnected);
    };
  }

  void dispose() {
    _stateController.close();
  }
}

enum ConnectionState {
  connected,
  disconnected,
  reconnecting,
}
```

---

### 3. State Management

**Use Provider for Global State**:
```dart
class SeatProvider with ChangeNotifier {
  Map<String, KeySeat> _seatsMap = {};
  
  List<KeySeat> get seats => _seatsMap.values.toList();
  
  KeySeat? getSeatByUUID(String uuid) => _seatsMap[uuid];
  
  void updateSeat(SeatUpdatedNotification update) {
    final existingSeat = _seatsMap[update.machineUUID];
    if (existingSeat != null) {
      _seatsMap[update.machineUUID] = existingSeat.copyWith(
        telemetry: update.telemetry,
        isActive: update.isActive,
        updatedAt: update.updatedAt,
      );
      notifyListeners();
    }
  }
}
```

**Local Caching**:
```dart
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';

class SeatCache {
  static const _cacheKey = 'cached_seats';

  static Future<void> cacheSeats(List<KeySeat> seats) async {
    final prefs = await SharedPreferences.getInstance();
    final json = jsonEncode(seats.map((s) => s.toJson()).toList());
    await prefs.setString(_cacheKey, json);
  }

  static Future<List<KeySeat>?> getCachedSeats() async {
    final prefs = await SharedPreferences.getInstance();
    final json = prefs.getString(_cacheKey);
    if (json == null) return null;
    
    final List<dynamic> decoded = jsonDecode(json);
    return decoded.map((item) => KeySeat.fromJson(item)).toList();
  }

  static Future<void> clearCache() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_cacheKey);
  }
}
```

---

### 4. Performance Optimization

**Debounce Updates**:
```dart
import 'dart:async';

class DebouncedSeatProvider with ChangeNotifier {
  Timer? _debounceTimer;
  final Duration debounceDuration;

  DebouncedSeatProvider({
    this.debounceDuration = const Duration(milliseconds: 500),
  });

  void updateSeat(SeatUpdatedNotification update) {
    _debounceTimer?.cancel();
    _debounceTimer = Timer(debounceDuration, () {
      _performUpdate(update);
    });
  }

  void _performUpdate(SeatUpdatedNotification update) {
    // Perform actual update
    notifyListeners();
  }
}
```

**Lazy Loading**:
```dart
class TelemetryHistoryScreen extends StatefulWidget {
  @override
  _TelemetryHistoryScreenState createState() => _TelemetryHistoryScreenState();
}

class _TelemetryHistoryScreenState extends State<TelemetryHistoryScreen> {
  final ScrollController _scrollController = ScrollController();
  List<TelemetryHistoryRecord> _history = [];
  int _currentPage = 1;
  bool _isLoading = false;
  bool _hasMore = true;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    _loadMore();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >= 
        _scrollController.position.maxScrollExtent * 0.8) {
      _loadMore();
    }
  }

  Future<void> _loadMore() async {
    if (_isLoading || !_hasMore) return;

    setState(() => _isLoading = true);

    try {
      final provider = context.read<SeatProvider>();
      final newRecords = await provider.fetchHistory(
        page: _currentPage,
        pageSize: 50,
      );

      setState(() {
        _history.addAll(newRecords);
        _currentPage++;
        _hasMore = newRecords.length == 50;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      controller: _scrollController,
      itemCount: _history.length + (_hasMore ? 1 : 0),
      itemBuilder: (context, index) {
        if (index == _history.length) {
          return const Center(child: CircularProgressIndicator());
        }
        return HistoryTile(record: _history[index]);
      },
    );
  }
}
```

---

### 5. Offline Support

**Queue Updates for Offline Mode**:
```dart
class OfflineQueueManager {
  final List<Map<String, dynamic>> _queue = [];

  void addToQueue(Map<String, dynamic> data) {
    _queue.add(data);
    _saveQueue();
  }

  Future<void> processQueue(MobileSocketService socketService) async {
    if (!socketService.isConnected || _queue.isEmpty) return;

    final itemsToProcess = List.from(_queue);
    _queue.clear();

    for (final item in itemsToProcess) {
      try {
        // Process queued item
        await _processItem(item, socketService);
      } catch (e) {
        // Re-add to queue if failed
        _queue.add(item);
      }
    }

    _saveQueue();
  }

  Future<void> _processItem(
    Map<String, dynamic> item,
    MobileSocketService socketService,
  ) async {
    // Implement processing logic
  }

  Future<void> _saveQueue() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('offline_queue', jsonEncode(_queue));
  }

  Future<void> _loadQueue() async {
    final prefs = await SharedPreferences.getInstance();
    final json = prefs.getString('offline_queue');
    if (json != null) {
      _queue.addAll(List<Map<String, dynamic>>.from(jsonDecode(json)));
    }
  }
}
```

---

### 6. Logging and Debugging

**Structured Logging**:
```dart
import 'package:logger/logger.dart';

class AppLogger {
  static final Logger _logger = Logger(
    printer: PrettyPrinter(
      methodCount: 2,
      errorMethodCount: 8,
      lineLength: 120,
      colors: true,
      printEmojis: true,
      printTime: true,
    ),
  );

  static void debug(String message) => _logger.d(message);
  static void info(String message) => _logger.i(message);
  static void warning(String message) => _logger.w(message);
  static void error(String message, [dynamic error, StackTrace? stackTrace]) {
    _logger.e(message, error: error, stackTrace: stackTrace);
  }
}

// Usage
AppLogger.info('Connected to server');
AppLogger.error('Failed to fetch seats', error, stackTrace);
```

---

### 7. Testing

**Mock Socket Service**:
```dart
class MockSocketService extends MobileSocketService {
  MockSocketService() : super(serverUrl: '', jwtToken: '');

  @override
  Future<void> connect() async {
    await Future.delayed(const Duration(milliseconds: 100));
    _isConnected = true;
    onConnected?.call();
  }

  @override
  void subscribeToSeats() {
    _isSubscribed = true;
  }

  void simulateSeatUpdate(SeatUpdatedNotification update) {
    onSeatUpdated?.call(update);
  }
}
```

**Widget Testing**:
```dart
void main() {
  testWidgets('SeatCard displays seat information', (tester) async {
    final seat = KeySeat(
      id: 1,
      documentId: 'doc-123',
      machineUUID: 'POS-001',
      isActive: true,
      telemetry: {'cpuUsage': 45},
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:30:00Z',
      publishedAt: '2024-01-15T10:00:00Z',
      license: LicenseInfo(
        documentId: 'lic-123',
        licenseKey: 'key-123',
        planSubscriptionType: 'Pro',
      ),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SeatCard(seat: seat),
        ),
      ),
    );

    expect(find.text('POS-001'), findsOneWidget);
    expect(find.text('Plan: Pro'), findsOneWidget);
    expect(find.text('Status: Active'), findsOneWidget);
  });
}
```

---


## Testing

### Manual Testing with Test HTML File

Use the provided `test-mobile-app.html` file to test the mobile app integration:

1. **Open the test file** in a web browser
2. **Configure connection**:
   - Server URL: `http://localhost:1334` (or your server URL)
   - JWT Token: Your authentication token
3. **Test connection**: Click "Connect to Server"
4. **Subscribe to updates**: Click "Subscribe to Seat Updates"
5. **Fetch seats**: Click "Fetch My Seats (HTTP GET)"
6. **Monitor updates**: Watch for real-time seat updates in the event log

---

### Unit Testing

#### Test Socket Service

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';

void main() {
  group('MobileSocketService', () {
    late MockSocketService socketService;

    setUp(() {
      socketService = MockSocketService();
    });

    test('connects successfully', () async {
      await socketService.connect();
      expect(socketService.isConnected, true);
    });

    test('subscribes to seats', () {
      socketService.subscribeToSeats();
      expect(socketService.isSubscribed, true);
    });

    test('handles seat updates', () async {
      bool updateReceived = false;
      socketService.onSeatUpdated = (update) {
        updateReceived = true;
      };

      final update = SeatUpdatedNotification(
        machineUUID: 'POS-001',
        telemetry: {'cpuUsage': 45},
        isActive: true,
        updatedAt: DateTime.now().toIso8601String(),
        licenseDocumentId: 'lic-123',
      );

      socketService.simulateSeatUpdate(update);
      expect(updateReceived, true);
    });

    test('disconnects properly', () {
      socketService.disconnect();
      expect(socketService.isConnected, false);
      expect(socketService.isSubscribed, false);
    });
  });
}
```

---

#### Test API Service

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:dio/dio.dart';

void main() {
  group('MobileApiService', () {
    late MobileApiService apiService;
    late MockDio mockDio;

    setUp(() {
      mockDio = MockDio();
      apiService = MobileApiService(
        baseUrl: 'https://test.com',
        jwtToken: 'test-token',
      );
    });

    test('fetches seats successfully', () async {
      final mockResponse = {
        'data': [
          {
            'id': 1,
            'documentId': 'doc-123',
            'machineUUID': 'POS-001',
            'isActive': true,
            'telemetry': {'cpuUsage': 45},
            'createdAt': '2024-01-15T10:00:00Z',
            'updatedAt': '2024-01-15T10:30:00Z',
            'publishedAt': '2024-01-15T10:00:00Z',
            'license': {
              'documentId': 'lic-123',
              'licenseKey': 'key-123',
              'planSubscriptionType': 'Pro',
            },
          }
        ],
        'meta': {'total': 1}
      };

      when(mockDio.get('/api/key-seats/my-seats'))
          .thenAnswer((_) async => Response(
                data: mockResponse,
                statusCode: 200,
                requestOptions: RequestOptions(path: ''),
              ));

      final seats = await apiService.fetchMySeats();
      expect(seats.length, 1);
      expect(seats[0].machineUUID, 'POS-001');
    });

    test('handles authentication error', () async {
      when(mockDio.get('/api/key-seats/my-seats'))
          .thenThrow(DioException(
            response: Response(
              statusCode: 401,
              requestOptions: RequestOptions(path: ''),
            ),
            requestOptions: RequestOptions(path: ''),
          ));

      expect(
        () => apiService.fetchMySeats(),
        throwsA(isA<AuthenticationException>()),
      );
    });
  });
}
```

---

#### Test Provider

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';

void main() {
  group('SeatProvider', () {
    late SeatProvider provider;
    late MockSocketService mockSocketService;
    late MockApiService mockApiService;

    setUp(() {
      mockSocketService = MockSocketService();
      mockApiService = MockApiService();
      provider = SeatProvider(
        socketService: mockSocketService,
        apiService: mockApiService,
      );
    });

    test('fetches seats successfully', () async {
      final mockSeats = [
        KeySeat(
          id: 1,
          documentId: 'doc-123',
          machineUUID: 'POS-001',
          isActive: true,
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:30:00Z',
          publishedAt: '2024-01-15T10:00:00Z',
          license: LicenseInfo(
            documentId: 'lic-123',
            licenseKey: 'key-123',
            planSubscriptionType: 'Pro',
          ),
        ),
      ];

      when(mockApiService.fetchMySeats())
          .thenAnswer((_) async => mockSeats);

      await provider.fetchSeats();
      expect(provider.seats.length, 1);
      expect(provider.errorMessage, null);
    });

    test('handles seat update', () {
      final initialSeat = KeySeat(
        id: 1,
        documentId: 'doc-123',
        machineUUID: 'POS-001',
        isActive: true,
        telemetry: {'cpuUsage': 45},
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:30:00Z',
        publishedAt: '2024-01-15T10:00:00Z',
        license: LicenseInfo(
          documentId: 'lic-123',
          licenseKey: 'key-123',
          planSubscriptionType: 'Pro',
        ),
      );

      provider.seats.add(initialSeat);

      final update = SeatUpdatedNotification(
        machineUUID: 'POS-001',
        telemetry: {'cpuUsage': 60},
        isActive: true,
        updatedAt: DateTime.now().toIso8601String(),
        licenseDocumentId: 'lic-123',
      );

      provider._handleSeatUpdate(update);

      expect(provider.seats[0].telemetry!['cpuUsage'], 60);
    });
  });
}
```

---

### Integration Testing

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Mobile App Integration Tests', () {
    testWidgets('complete flow test', (tester) async {
      // Launch app
      await tester.pumpWidget(const MyApp());
      await tester.pumpAndSettle();

      // Verify initial state
      expect(find.text('POS Monitor'), findsOneWidget);

      // Wait for connection
      await tester.pump(const Duration(seconds: 2));

      // Verify seats are loaded
      expect(find.byType(SeatCard), findsWidgets);

      // Tap on a seat to view details
      await tester.tap(find.byType(SeatCard).first);
      await tester.pumpAndSettle();

      // Verify details dialog
      expect(find.text('Close'), findsOneWidget);

      // Close dialog
      await tester.tap(find.text('Close'));
      await tester.pumpAndSettle();

      // Test subscription toggle
      await tester.tap(find.byType(FloatingActionButton));
      await tester.pumpAndSettle();

      // Verify subscription state changed
      expect(find.byIcon(Icons.notifications_off), findsOneWidget);
    });
  });
}
```

---

### Performance Testing

```dart
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Performance Tests', () {
    test('handles 100 seat updates efficiently', () async {
      final provider = SeatProvider(
        socketService: MockSocketService(),
        apiService: MockApiService(),
      );

      // Add 100 seats
      for (int i = 0; i < 100; i++) {
        provider.seats.add(KeySeat(
          id: i,
          documentId: 'doc-$i',
          machineUUID: 'POS-$i',
          isActive: true,
          createdAt: DateTime.now().toIso8601String(),
          updatedAt: DateTime.now().toIso8601String(),
          publishedAt: DateTime.now().toIso8601String(),
          license: LicenseInfo(
            documentId: 'lic-$i',
            licenseKey: 'key-$i',
            planSubscriptionType: 'Pro',
          ),
        ));
      }

      final stopwatch = Stopwatch()..start();

      // Simulate 100 updates
      for (int i = 0; i < 100; i++) {
        final update = SeatUpdatedNotification(
          machineUUID: 'POS-$i',
          telemetry: {'cpuUsage': 50 + i},
          isActive: true,
          updatedAt: DateTime.now().toIso8601String(),
          licenseDocumentId: 'lic-$i',
        );
        provider._handleSeatUpdate(update);
      }

      stopwatch.stop();

      // Should complete in less than 1 second
      expect(stopwatch.elapsedMilliseconds, lessThan(1000));
    });
  });
}
```

---

### Testing Checklist

- [ ] Socket connection establishes successfully
- [ ] JWT authentication works correctly
- [ ] Subscription to seat updates succeeds
- [ ] Real-time seat updates are received
- [ ] HTTP API endpoints return correct data
- [ ] Error handling works for all error types
- [ ] Reconnection logic works after disconnection
- [ ] Offline mode queues updates correctly
- [ ] UI updates reflect real-time changes
- [ ] Performance is acceptable with many seats
- [ ] Memory usage is reasonable
- [ ] Token refresh works correctly
- [ ] Logout clears all data properly

---

## Troubleshooting

### Common Issues

#### Issue 1: Socket not connecting

**Symptoms**: `connect_error` or timeout

**Solutions**:
1. Verify server URL is correct
2. Check JWT token is valid
3. Ensure server is running
4. Check firewall/network settings
5. Try using polling transport: `setTransports(['polling'])`

---

#### Issue 2: Not receiving seat updates

**Symptoms**: No `seat:updated` events

**Solutions**:
1. Verify subscription succeeded (`seat:subscribe:success`)
2. Check user has seats in database
3. Ensure POS machines are sending updates
4. Verify JWT token has correct user ID

---

#### Issue 3: HTTP requests failing

**Symptoms**: 401, 403, or 500 errors

**Solutions**:
1. Check JWT token is included in headers
2. Verify token hasn't expired
3. Ensure user has permission to access seats
4. Check server logs for errors

---

#### Issue 4: App crashes on seat update

**Symptoms**: App crashes when receiving updates

**Solutions**:
1. Verify telemetry data structure matches expected format
2. Add null safety checks
3. Use try-catch blocks around JSON parsing
4. Log incoming data for debugging

---

## Summary

This guide provides everything needed to integrate a Flutter mobile app with the real-time seat telemetry system:

- ✅ Complete Socket.IO integration with all events
- ✅ HTTP REST API with full type definitions
- ✅ Dart data models for all payloads
- ✅ Step-by-step implementation guide
- ✅ Error handling patterns
- ✅ Best practices for production apps
- ✅ Testing strategies and examples
- ✅ Troubleshooting guide

For additional help, refer to:
- `POS_INTEGRATION_GUIDE.md` - POS application integration
- `TESTING_GUIDE.md` - Testing procedures
- Server API documentation

---

**Document Version**: 1.0.0  
**Last Updated**: 2024-01-15  
**Maintained By**: Development Team
