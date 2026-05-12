/** @type {import('pm2').StartOptions} */
const WEB_PORT = Number(process.env.PORT || 3650);
const API_PORT = Number(process.env.API_PORT || 4000);

module.exports = {
  apps: [
    {
      name: 'oyama-crm-web',
      script: './node_modules/next/dist/bin/next',
      interpreter: 'node',
      args: `start -p ${WEB_PORT}`,
      instances: 1,
      exec_mode: 'fork',
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
      env_production: {
        NODE_ENV: 'production',
        PORT: WEB_PORT,
      },
    },
    {
      name: 'oyama-crm-api',
      script: 'tsx',
      interpreter: 'none',
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
      env_production: {
        NODE_ENV: 'production',
        API_PORT,
      },
    },
  ],
};
