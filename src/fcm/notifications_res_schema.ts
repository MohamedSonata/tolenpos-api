// export interface NotificationErrorResponse {
//     success: false;
//     error: string;
//     message?: string;
//     timestamp: string;
//     type?: string;
// }

// export interface NotificationSuccessResponse<T = any> {
//     success: true;
//     data?: T;
//     message?: string;
//     timestamp: string;
//     type?: string;
// }


// const notificationResponse = () => {
//     return {
//         createErrorResponse(error: string, message?: string, type?: string): NotificationErrorResponse {
//             return {
//                 success: false,
//                 error,
//                 message,
//                 timestamp: new Date().toISOString(),
//                 type
//             };
//         },
//         createSuccessResponse(data?: any, message?: string, type?: string): NotificationSuccessResponse {
//             return {
//                 success: true,
//                 data,
//                 message,
//                 timestamp: new Date().toISOString(),
//                 type
//             };
//         }
//     }
// }

// export default {
//     notificationResponse
// }
