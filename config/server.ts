import type { Core } from '@strapi/strapi';
import cronTasks from './cron-tasks';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Server => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1334),
  app: {
    keys: env.array('APP_KEYS'),
  },
  url: env('APP_URL', 'http://localhost:1334'),
  proxy: env.bool('IS_PROXIED', true),
  cron: {
    enabled: true,
    tasks: cronTasks,
  },
});

export default config;
