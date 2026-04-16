interface UserPermissionsService {
    template: (message: string, data: any) => Promise<string>;
  }
  
  interface JWTService {
    issue: (payload: { id: number }) => string;
  }
  

  interface User {
    id: number;
    documentId: string;
    username: string;
    email: string;
    phone: string;
    provider: string;
    
    confirmed: boolean;
    blocked: boolean;
    createdAt: string;
    updatedAt: string;
    publishedAt: string;
 
}

  
  interface SanitizedUser extends Omit<User, 'password' | 'resetPasswordToken'> {}
  