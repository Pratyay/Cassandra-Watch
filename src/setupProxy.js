const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:3001',
      changeOrigin: true,
      pathRewrite: function (path, req) {
        return path; // Keep the original path including /api
      }
    })
  );
  
  app.use(
    '/ws',
    createProxyMiddleware({
      target: 'http://localhost:3001',
      changeOrigin: true,
      ws: true,
    })
  );
};
