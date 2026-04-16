
type SenderType = 'user' | 'group' | 'channel';

interface AuthenticatedUser {
    id: number | string;
    [key: string]: any;
  }
  
  // Koa context type for Strapi controllers
  interface KoaContext {
    state: {
      user?: AuthenticatedUser;
      [key: string]: any;
    };
    request: {
      body: any;
      [key: string]: any;
    };
    params: {
      [key: string]: string;
    };
    ip: string;
    body: any;
    throw: (status: number, message: string) => never;
    [key: string]: any;
  }
  
  interface SendTextRequest {
    recipient: string;
    message: string;
    senderType?: SenderType;
  }
  
  interface SendImageRequest {
    recipient: string;
    imageUrl: string;
    caption?: string;
    senderType?: SenderType;
  }
  
  interface SendVideoRequest {
    recipient: string;
    videoUrl: string;
    caption?: string;
    senderType?: SenderType;
  }
  
  interface SendDocumentRequest {
    recipient: string;
    documentUrl: string;
    filename?: string;
    caption?: string;
    senderType?: SenderType;
  }
  
  interface SendVoiceRequest {
    recipient: string;
    audioUrl: string;
    senderType?: SenderType;
  }
  
  interface ContactData {
    name: string;
    phone: string;
    email?: string;
  }
  
  interface SendContactRequest {
    recipient: string;
    contact: ContactData;
    senderType?: SenderType;
  }
  
  interface LocationData {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  }
  
  interface SendLocationRequest {
    recipient: string;
    location: LocationData;
    senderType?: SenderType;
  }
  
  interface SendBulkRequest {
    recipients: string[];
    message: string;
    senderType?: SenderType;
    delayMs?: number;
  }
  
  interface ValidateRecipientRequest {
    recipient: string;
  }
  
  interface ApiResponse {
    success: boolean;
    data?: any;
    message?: string;
    error?: string;
  }
  
  interface BulkSendResult {
    recipient: string;
    success: boolean;
    result?: any;
    error?: string;
  }
  
  interface ValidationResult {
    valid: boolean;
    data?: any;
    error?: string;
  }
  
  interface DeviceStatus {
    [key: string]: any;
  }
  
  interface HealthCheckResponse {
    [key: string]: any;
  }
  
  interface HealthCheckResponse {
    success: boolean;
    status: 'healthy' | 'unhealthy';
    configured?: boolean;
    error?: string;
    timestamp: string;
  }
  interface MessageStatus {
    [key: string]: any;
  }
  export{
    HealthCheckResponse,
    ApiResponse,
    ValidateRecipientRequest,
    SendBulkRequest,
    SendLocationRequest,
    SendContactRequest,
    SendVoiceRequest,
    SendDocumentRequest,
    SendVideoRequest,
    SendImageRequest,
    SendTextRequest,
    KoaContext,
    DeviceStatus,
    ValidationResult,
    BulkSendResult,
    LocationData,
    ContactData,
    MessageStatus,
    AuthenticatedUser,

  }