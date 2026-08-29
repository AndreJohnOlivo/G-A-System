/**
 * Express Middleware for Pagination, Error Handling, and Utilities
 */

/**
 * Pagination middleware
 * Usage: app.use(paginationMiddleware);
 * Access with: req.pagination = { page, limit, skip }
 */
function paginationMiddleware(req, res, next) {
  let page = parseInt(req.query.page) || 1;
  let limit = parseInt(req.query.limit) || 20;

  if (page < 1) page = 1;
  if (limit < 1) limit = 20;
  if (limit > 100) limit = 100; // Cap at 100 for performance

  const skip = (page - 1) * limit;

  req.pagination = { page, limit, skip };
  next();
}

/**
 * Global error handling middleware
 * Should be placed at the end of all other middleware
 */
function errorHandler(err, req, res, next) {
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ error: 'Validation error', details: messages });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({ error: `Duplicate entry: ${field} already exists` });
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid ID format' });
  }

  // Default error
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

/**
 * Request logging middleware
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log({
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.id || 'anonymous'
    });
  });
  
  next();
}

/**
 * Async route wrapper to catch errors in async handlers
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Build MongoDB query filter with support for multiple fields
 */
function buildFilter(queryParams, allowedFields) {
  const filter = {};
  
  allowedFields.forEach(field => {
    if (queryParams[field]) {
      filter[field] = queryParams[field];
    }
  });
  
  return filter;
}

/**
 * Build MongoDB sort object from query string
 * Usage: ?sort=-enrollmentDate,name
 */
function buildSort(sortString) {
  const sort = {};
  
  if (!sortString) return sort;
  
  sortString.split(',').forEach(field => {
    if (field.startsWith('-')) {
      sort[field.slice(1)] = -1;
    } else {
      sort[field] = 1;
    }
  });
  
  return sort;
}

/**
 * Build projection object to limit fields returned
 * Usage: ?fields=name,email,course
 */
function buildProjection(fieldsString) {
  const projection = {};
  
  if (!fieldsString) return projection;
  
  fieldsString.split(',').forEach(field => {
    projection[field.trim()] = 1;
  });
  
  return projection;
}

/**
 * Calculate pagination metadata
 */
function getPaginationMeta(page, limit, total) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page < Math.ceil(total / limit),
    hasPrevPage: page > 1
  };
}

module.exports = {
  paginationMiddleware,
  errorHandler,
  requestLogger,
  asyncHandler,
  buildFilter,
  buildSort,
  buildProjection,
  getPaginationMeta
};
