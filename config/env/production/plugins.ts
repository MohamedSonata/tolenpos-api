
export default  ({ env }) => ({
    // To Send MailGun Email we just need (MAILGUN_DOMAIN,MAILGUN_APIKEY,username="api")
    email: {
      config: {
        provider: 'mailgun',
        providerOptions: {
           username: "api",
          key: env('MAILGUN_APIKEY'), // Required
          domain: env('MAILGUN_DOMAIN'), // Required
        },
        settings: {
          defaultFrom: 'noreply@xefro.net',
          defaultReplyTo: 'help@xefro.net',
        },
      },
    },
      'users-permissions': {
    config: {
      jwtManagement: 'refresh',
      sessions: {
        accessTokenLifespan: 2592000, // 30 days
        maxRefreshTokenLifespan: 31536000, // 365 days (1 year)
        idleRefreshTokenLifespan: 15552000, // 180 days (6 months)
        httpOnly: false, // Set to true for HTTP-only cookies
        cookie: {
          name: 'strapi_up_refresh',
          sameSite: 'lax',
          path: '/',
          secure: false, // true in production
        },
      },
    },
  },
    // ...
  });