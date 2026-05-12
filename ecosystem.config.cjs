/** @type {import('pm2').StartOptions} */
const WEB_PORT = Number(process.env.PORT || 3000);
const API_PORT = Number(process.env.API_PORT || 4000);

module.exports = {
  apps: [
    {
      name: 'oyama-crm-web',
      script: './node_modules/.bin/next',
      args: 'start',
      instances: 'max',
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: WEB_PORT,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: WEB_PORT,
      },
    },
    {
      name: 'oyama-crm-api',
      script: 'tsx',
      args: 'server/src/index.ts',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        API_PORT,
      },
      env_development: {
        NODE_ENV: 'development',
        API_PORT,
      },
    },
  ],
};
