let local = {};
try {
  local = require('./audit.integration.local.json');
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
}

module.exports = {
  token: local.hubIntegrationToken || process.env.HUB_INTEGRATION_TOKEN || '',
  httpOrigin: local.hubLaunchHttpOrigin || process.env.HUB_LAUNCH_HTTP_ORIGIN || '',
};
