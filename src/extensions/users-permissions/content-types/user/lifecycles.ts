
import { Core } from "@strapi/strapi";

interface CreateUserEvent {
  result: {
    documentId: string;
    userType: 'Driver' | 'Customer';
    email: string;
  };
}


/**
 * Lifecycle hooks for the user content type.
 * Handles creation of related driver/customer and wallet entities on user creation.
 */
export default {

  async beforeCreate(event, strapi: Core.Strapi) {
    const { params } = event;
   
  }}