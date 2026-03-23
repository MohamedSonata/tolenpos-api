import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({

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
});

export default config;
