import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Admin => ({
  url: env('ADMIN_URL', '/admin'),
  serveAdminPanel: env.bool('SERVE_ADMIN', true),
  auth: {
    secret: env('ADMIN_JWT_SECRET'),
    sessions: {
      // How long admin session is valid
      maxSessionLifespan: 60 * 60 * 24, // 24 hours (in seconds)

      // How long refresh token is valid
      maxRefreshTokenLifespan: 60 * 60 * 24 * 7, // 7 days
    },
  },
  apiToken: {
    salt: env('API_TOKEN_SALT'),
  },
  transfer: {
    token: {
      salt: env('TRANSFER_TOKEN_SALT'),
    },
  },
  secrets: {
    encryptionKey: env('ENCRYPTION_KEY'),
  },
  flags: {
    nps: env.bool('FLAG_NPS', true),
    promoteEE: env.bool('FLAG_PROMOTE_EE', true),
  },
});

export default config;
