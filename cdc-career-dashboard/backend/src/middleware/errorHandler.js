function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd) {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} → ${status}: ${err.message}`);
  } else {
    console.error(err.stack);
  }

  res.status(status).json({
    error: isProd && status === 500 ? 'Internal server error' : err.message || 'Internal server error'
  });
}

module.exports = errorHandler;
