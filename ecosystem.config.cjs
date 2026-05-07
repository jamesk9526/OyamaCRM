/** @type {import('pm2').StartOptions} */
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
        PORT: 3000,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000,
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
        API_PORT: 4000,
      },
      env_development: {
        NODE_ENV: 'development',
        API_PORT: 4000,
      },
    },
  ],
};
