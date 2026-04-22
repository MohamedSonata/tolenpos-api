import type { Core } from '@strapi/strapi';
import cronTasks from './cron-tasks';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Server => {
  const cronEnabled = env.bool('CRON_ENABLED', true);
  
  console.log('[ServerConfig] Cron configuration:', {
    enabled: cronEnabled,
    snapshotSchedule: env('TELEMETRY_SNAPSHOT_SCHEDULE', '*/1 * * * *'),
    cleanupSchedule: env('TELEMETRY_CLEANUP_SCHEDULE', '0 3 * * 0'),
    timezone: env('TZ', 'UTC')
  });

  return {
    host: env('HOST', '0.0.0.0'),
    port: env.int('PORT', 1334),
    app: {
      keys: env.array('APP_KEYS'),
    },
    url: env('APP_URL', 'http://localhost:1334'),
    proxy: env.bool('IS_PROXIED', true),
    cron: {
      enabled: cronEnabled,
      tasks: cronTasks,
    },
  };
};

export default config;
