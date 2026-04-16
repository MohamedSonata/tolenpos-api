import { Core } from '@strapi/strapi';
import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

const fireBaseConfig = ({ strapi }) => {
  return {
    async initFirebaseAdmin() {
      try {
        let serviceAccount;
        
        // Try to load from environment variable first
        if (process.env.FIREBASE_SERVICE_CUSTOMER_ACCOUNT_KEY) {
          try {
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_CUSTOMER_ACCOUNT_KEY);
            strapi.log.info('🔥 Firebase service account loaded from environment variable');
          } catch (jsonError) {
            strapi.log.error('❌ Invalid JSON in FIREBASE_SERVICE_CUSTOMER_ACCOUNT_KEY environment variable:', jsonError.message);
            strapi.log.info('🔄 Falling back to JSON file...');
          }
        }
        
        // If env variable failed or doesn't exist, try to load from file
        if (!serviceAccount) {
          try {
            const serviceAccountPath = path.join(process.cwd(), 'src', 'fcm', 'tolen-pos-2026-firebase-adminsdk-fbsvc-5c14f37599.json');
            
            if (fs.existsSync(serviceAccountPath)) {
              const serviceAccountFile = fs.readFileSync(serviceAccountPath, 'utf8');
              // console.log(serviceAccountFile);
              serviceAccount = JSON.parse(serviceAccountFile);
              strapi.log.info('🔥 Firebase service account loaded from file:', serviceAccountPath);
            } else {
              strapi.log.error('❌ Firebase service account file not found:', serviceAccountPath);
              return;
            }
          } catch (fileError) {
            strapi.log.error('❌ Failed to load Firebase service account from file:', fileError.message);
            return;
          }
        }
        
        if (serviceAccount && !admin.apps.length) {
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
          });
          
          // Make Firebase Admin available globally
          strapi.firebase = admin;
          strapi.log.info('🔥 Firebase Admin SDK initialized successfully');
        } else if (admin.apps.length > 0) {
          strapi.log.info('🔥 Firebase Admin SDK already initialized');
        }
      } catch (error) {
        strapi.log.error('❌ Firebase Admin SDK initialization failed:', error);
      }
    }
  }
};

export default fireBaseConfig;