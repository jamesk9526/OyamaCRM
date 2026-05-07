/** @type {import('pm2').StartOptions} */
module.exports = {
  apps: [
    {
      name: 'oyama-crm',
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
  ],
};
