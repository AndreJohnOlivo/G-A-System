/**
 * College Enrollment System - Optimized Backend API
 * 
 * Database Optimizations:
 * ✅ Unified Mongoose schemas with proper indexing
 * ✅ Connection pooling (maxPoolSize: 10, minPoolSize: 2)
 * ✅ Pagination on all GET endpoints
 * ✅ Field projections to reduce data transfer
 * ✅ Efficient text search with scoring
 * ✅ Activity logging to database (auto-cleanup after 30 days)
 * ✅ Aggregation pipelines for complex queries
 * ✅ Error handling middleware
 * ✅ Query optimization with indexes
 */

const tracer = require('dd-trace').init({
  service: 'college-enrollment-system',
  env: 'production',
  version: '2.0.0'
});

const StatsD = require('hot-shots');
const dogstatsd = new StatsD({
  host: '127.0.0.1',
  port: 8125,
  globalTags: { service: 'college-enrollment-system', env: 'production' },
});

const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { GridFSBucket } = require('mongodb');
const { GridFsStorage } = require('multer-gridfs-storage');
require('dotenv').config({ path: 'CollegeEnrollmenSystem/mongo.env' });

const {
  connectDatabase,
  disconnectDatabase,
  Student,
  Requirement,
  Subject,
  User,
  ActivityLog
} = require('./database');

const {
  paginationMiddleware,
  errorHandler,
  requestLogger,
  asyncHandler,
  buildFilter,
  buildSort,
  buildProjection,
  getPaginationMeta
} = require('./middleware');

const {
  logActivity,
  findWithPagination,
  findById,
  createWithLog,
  updateWithLog,
  deleteWithLog,
  bulkInsert,
  textSearch,
  getStats
} = require('./dbUtils');

// Express app setup
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, { cors: { origin: '*' } });

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Metrics middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;

    dogstatsd.timing('api.request.latency', duration, {
      route: req.path,
      method: req.method,
      status_code: res.statusCode,
    });

    if (res.statusCode >= 200 && res.statusCode < 400) {
      dogstatsd.increment('api.request.success', 1, { route: req.path });
    } else {
      dogstatsd.increment('api.request.failure', 1, { route: req.path, status_code: res.statusCode });
    }
  });
  next();
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(paginationMiddleware);
app.use(requestLogger);

// MongoDB storage setup
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/UCC_College_Repository';

const storage = new GridFsStorage({
  url: mongoUri,
  file: (req, file) => {
    return {
      filename: `${Date.now()}-${file.originalname}`,
      bucketName: 'photos',
    };
  }
});

const upload = multer({ storage });

// ============================================================================
// SOCKET.IO EVENT HANDLERS
// ============================================================================

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Send recent activities on connection
  ActivityLog.find()
    .sort({ timestamp: -1 })
    .limit(20)
    .exec((err, logs) => {
      if (!err) socket.emit('activity', logs || []);
    });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

/**
 * Broadcast activity to all connected clients
 */
async function broadcastActivity(message, type = 'system', resourceType = 'system') {
  const activity = {
    message,
    type,
    resourceType,
    timestamp: new Date()
  };

  io.emit('activity', [activity]);
  await logActivity(message, type, { resourceType });
}

// ============================================================================
// STUDENT ENDPOINTS
// ============================================================================

/**
 * GET /api/students - Fetch all students with pagination
 * Query params: page=1&limit=20&sort=-enrollmentDate&fields=name,email,course&course=CS&enrollmentStatus=active
 */
app.get('/api/students', asyncHandler(async (req, res) => {
  const { page, limit, skip } = req.pagination;
  const sort = buildSort(req.query.sort) || { _id: -1 };
  const projection = buildProjection(req.query.fields);

  const allowedFilters = ['course', 'year', 'enrollmentStatus'];
  const filter = buildFilter(req.query, allowedFilters);

  const result = await findWithPagination(Student, filter, {
    page,
    limit,
    sort,
    projection
  });

  res.json({
    data: result.data,
    pagination: result.pagination
  });
}));

/**
 * GET /api/students/:id - Fetch single student
 */
app.get('/api/students/:id', asyncHandler(async (req, res) => {
  const student = await findById(Student, req.params.id);

  if (!student) {
    return res.status(404).json({ error: 'Student not found' });
  }

  res.json(student);
}));

/**
 * POST /api/students - Create new student
 */
app.post('/api/students', asyncHandler(async (req, res) => {
  const student = await createWithLog(Student, req.body, req.user?.id);
  await broadcastActivity(`Student ${student.name} registered`, 'create', 'student');

  res.status(201).json({
    message: 'Student added successfully!',
    student
  });
}));

/**
 * PUT /api/students/:id - Update student
 */
app.put('/api/students/:id', asyncHandler(async (req, res) => {
  const student = await updateWithLog(Student, req.params.id, req.body, req.user?.id);

  if (!student) {
    return res.status(404).json({ error: 'Student not found' });
  }

  res.json({
    message: 'Student updated successfully!',
    student
  });
}));

/**
 * DELETE /api/students/:id - Delete student
 */
app.delete('/api/students/:id', asyncHandler(async (req, res) => {
  const student = await deleteWithLog(Student, req.params.id, req.user?.id);

  if (!student) {
    return res.status(404).json({ error: 'Student not found' });
  }

  await broadcastActivity('Student deleted', 'delete', 'student');

  res.json({
    message: 'Student deleted successfully!',
    id: student._id
  });
}));

/**
 * GET /api/students/search/:query - Full-text search students
 */
app.get('/api/students/search/:query', asyncHandler(async (req, res) => {
  const { page, limit, skip } = req.pagination;
  const results = await textSearch(Student, req.params.query, {}, {
    limit,
    skip
  });

  res.json({
    data: results,
    pagination: { page, limit, total: results.length }
  });
}));

// ============================================================================
// REQUIREMENTS/DOCUMENTS ENDPOINTS
// ============================================================================

/**
 * GET /api/requirements - Fetch all requirements with pagination
 * Query params: page=1&limit=20&studentId=xxx&status=pending
 */
app.get('/api/requirements', asyncHandler(async (req, res) => {
  const { page, limit } = req.pagination;
  const sort = buildSort(req.query.sort) || { uploadedAt: -1 };
  const projection = buildProjection(req.query.fields);

  const allowedFilters = ['studentId', 'status', 'docType'];
  const filter = buildFilter(req.query, allowedFilters);

  const result = await findWithPagination(Requirement, filter, {
    page,
    limit,
    sort,
    projection,
    populate: 'studentId'
  });

  res.json({
    data: result.data,
    pagination: result.pagination
  });
}));

/**
 * GET /api/requirements/:id - Fetch single requirement
 */
app.get('/api/requirements/:id', asyncHandler(async (req, res) => {
  const requirement = await findById(Requirement, req.params.id, 'studentId');

  if (!requirement) {
    return res.status(404).json({ error: 'Requirement not found' });
  }

  res.json(requirement);
}));

/**
 * POST /api/upload - Upload files and create requirement documents
 */
app.post('/api/upload', upload.any(), asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const requirementData = req.files.map((file) => ({
    studentId: req.body.studentId || null,
    filename: file.filename,
    fileId: file.id,
    docType: req.body.docType || 'document',
    status: 'pending',
    description: file.fieldname
  }));

  const requirements = await bulkInsert(Requirement, requirementData);
  await broadcastActivity(`${req.files.length} files uploaded`, 'create', 'requirement');

  res.status(201).json({
    message: 'Files uploaded successfully!',
    count: requirements.length,
    requirements
  });
}));

/**
 * GET /api/image/:filename - Download image from GridFS
 */
app.get('/api/image/:filename', asyncHandler(async (req, res) => {
  const { MongoClient } = require('mongodb');
  const client = new MongoClient(mongoUri);
  
  try {
    await client.connect();
    const db = client.db('UCC_College_Repository');
    const bucket = new GridFSBucket(db, { bucketName: 'photos' });
    
    const downloadStream = bucket.openDownloadStreamByName(req.params.filename);
    downloadStream.pipe(res);
  } catch (error) {
    res.status(404).json({ error: 'Image not found' });
  } finally {
    await client.close();
  }
}));

/**
 * PUT /api/requirements/:id - Update requirement status
 */
app.put('/api/requirements/:id', asyncHandler(async (req, res) => {
  const requirement = await updateWithLog(Requirement, req.params.id, req.body, req.user?.id);

  if (!requirement) {
    return res.status(404).json({ error: 'Requirement not found' });
  }

  res.json({
    message: 'Requirement updated successfully!',
    requirement
  });
}));

/**
 * DELETE /api/requirements/:id - Delete requirement
 */
app.delete('/api/requirements/:id', asyncHandler(async (req, res) => {
  const requirement = await deleteWithLog(Requirement, req.params.id, req.user?.id);

  if (!requirement) {
    return res.status(404).json({ error: 'Requirement not found' });
  }

  res.json({
    message: 'Requirement deleted successfully!',
    id: requirement._id
  });
}));

// ============================================================================
// SUBJECT/CURRICULUM ENDPOINTS
// ============================================================================

/**
 * GET /api/subjects - Fetch all subjects with pagination
 * Query params: page=1&limit=20&course=CS&year=1&semester=1&sort=code
 */
app.get('/api/subjects', asyncHandler(async (req, res) => {
  const { page, limit } = req.pagination;
  const sort = buildSort(req.query.sort) || { course: 1, year: 1, semester: 1, code: 1 };
  const projection = buildProjection(req.query.fields);

  const allowedFilters = ['course', 'year', 'semester', 'code'];
  const filter = buildFilter(req.query, allowedFilters);

  const result = await findWithPagination(Subject, filter, {
    page,
    limit,
    sort,
    projection
  });

  res.json({
    data: result.data,
    pagination: result.pagination
  });
}));

/**
 * GET /api/subjects/:id - Fetch single subject
 */
app.get('/api/subjects/:id', asyncHandler(async (req, res) => {
  const subject = await findById(Subject, req.params.id);

  if (!subject) {
    return res.status(404).json({ error: 'Subject not found' });
  }

  res.json(subject);
}));

/**
 * POST /api/subjects - Create new subject
 */
app.post('/api/subjects', asyncHandler(async (req, res) => {
  const subject = await createWithLog(Subject, req.body, req.user?.id);
  await broadcastActivity(`Subject ${subject.code} added`, 'create', 'subject');

  res.status(201).json({
    message: 'Subject added successfully!',
    subject
  });
}));

/**
 * PUT /api/subjects/:id - Update subject
 */
app.put('/api/subjects/:id', asyncHandler(async (req, res) => {
  const subject = await updateWithLog(Subject, req.params.id, req.body, req.user?.id);

  if (!subject) {
    return res.status(404).json({ error: 'Subject not found' });
  }

  res.json({
    message: 'Subject updated successfully!',
    subject
  });
}));

/**
 * DELETE /api/subjects/:id - Delete subject
 */
app.delete('/api/subjects/:id', asyncHandler(async (req, res) => {
  const subject = await deleteWithLog(Subject, req.params.id, req.user?.id);

  if (!subject) {
    return res.status(404).json({ error: 'Subject not found' });
  }

  res.json({
    message: 'Subject deleted successfully!',
    id: subject._id
  });
}));

/**
 * GET /api/subjects/curriculum/:course - Get curriculum by course
 * Returns organized by year and semester
 */
app.get('/api/subjects/curriculum/:course', asyncHandler(async (req, res) => {
  const curriculum = await Subject.aggregate([
    { $match: { course: req.params.course } },
    { $group: {
      _id: { year: '$year', semester: '$semester' },
      subjects: { $push: '$$ROOT' },
      totalUnits: { $sum: '$units' }
    }},
    { $sort: { '_id.year': 1, '_id.semester': 1 } }
  ]);

  res.json({
    course: req.params.course,
    curriculum
  });
}));

/**
 * GET /api/subjects/search/:query - Full-text search subjects
 */
app.get('/api/subjects/search/:query', asyncHandler(async (req, res) => {
  const { page, limit, skip } = req.pagination;
  const results = await textSearch(Subject, req.params.query, {}, {
    limit,
    skip
  });

  res.json({
    data: results,
    pagination: { page, limit, total: results.length }
  });
}));

// ============================================================================
// ACTIVITY LOG ENDPOINTS
// ============================================================================

/**
 * GET /api/activity - Fetch activity logs with pagination
 * Query params: page=1&limit=20&type=create&resourceType=student&sort=-timestamp
 */
app.get('/api/activity', asyncHandler(async (req, res) => {
  const { page, limit } = req.pagination;
  const sort = buildSort(req.query.sort) || { timestamp: -1 };

  const allowedFilters = ['type', 'resourceType', 'userId'];
  const filter = buildFilter(req.query, allowedFilters);

  const result = await findWithPagination(ActivityLog, filter, {
    page,
    limit,
    sort,
    populate: 'userId'
  });

  res.json({
    data: result.data,
    pagination: result.pagination
  });
}));

/**
 * GET /api/activity/stats - Get activity statistics
 */
app.get('/api/activity/stats', asyncHandler(async (req, res) => {
  const stats = await ActivityLog.aggregate([
    { $match: { timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
    { $group: {
      _id: '$type',
      count: { $sum: 1 }
    }},
    { $sort: { count: -1 } }
  ]);

  res.json({
    lastSevenDays: stats,
    timestamp: new Date()
  });
}));

// ============================================================================
// DATABASE STATISTICS ENDPOINTS
// ============================================================================

/**
 * GET /api/stats/database - Get database collection statistics
 */
app.get('/api/stats/database', asyncHandler(async (req, res) => {
  const studentStats = await getStats(Student);
  const subjectStats = await getStats(Subject);
  const requirementStats = await getStats(Requirement);

  res.json({
    students: studentStats,
    subjects: subjectStats,
    requirements: requirementStats
  });
}));

// ============================================================================
// SHELL ROUTES
// ============================================================================

app.use(express.static(path.join(__dirname, 'HTML')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'HTML', 'index2.html'));
});

app.get('/oldstudent', (req, res) => {
  res.sendFile(path.join(__dirname, 'HTML', 'courses.html'));
});

// ============================================================================
// ERROR HANDLING & SERVER STARTUP
// ============================================================================

// Apply global error handler
app.use(errorHandler);

// Healthcheck endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// System heartbeat
setInterval(() => {
  dogstatsd.increment('system.uptime.heartbeat');
}, 60000);

// ============================================================================
// SERVER INITIALIZATION
// ============================================================================

let isShuttingDown = false;

async function startServer() {
  try {
    // Connect to database
    await connectDatabase();

    const PORT = process.env.PORT || 5500;
    const HOST = process.env.HOST || 'localhost';

    server.listen(PORT, HOST, () => {
      console.log(`
╔════════════════════════════════════════════════════════════╗
║  College Enrollment System - Server Started                ║
║  📍 Address: http://${HOST}:${PORT}                              
║  🗄️  Database: Connected                                   
║  ⚡ Optimizations: Indexes, Pagination, Connection Pool   
╚════════════════════════════════════════════════════════════╝
      `);
    });

    // Graceful shutdown
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

async function gracefulShutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log('\n🛑 Gracefully shutting down...');

  server.close(async () => {
    await disconnectDatabase();
    dogstatsd.close();
    console.log('✅ Server shut down successfully');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('❌ Forced shutdown after 10s');
    process.exit(1);
  }, 10000);
}

// Start server
startServer();

module.exports = app;
