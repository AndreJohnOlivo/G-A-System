const http = require('http');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');

const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

// Serve static files from configurable folder
const configuredRoot = process.env.ROOT_DIR && process.env.ROOT_DIR.trim();
const rootDir = configuredRoot ? path.resolve(configuredRoot) : path.join(__dirname, '..');

// Mongo setup
let mongoClient = null;
let mongoDb = null;
let useMongo = false;

async function connectToMongo(uri) {
  try {
    mongoClient = new MongoClient(uri);
    await mongoClient.connect();
    mongoDb = mongoClient.db(process.env.MONGO_DB_NAME || 'UCC_G&A_DB');
    useMongo = true;
    console.log('Connected to MongoDB');
  } catch (err) {
    console.warn('MongoDB connection failed, fallback to memory:', err.message);
    useMongo = false;
  }
}

// JWT helpers
function generateToken(user) {
  return jwt.sign(
    { username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '4h' }
  );
}

function authenticateToken(req) {
  const authHeader = req.headers['authorization'];
  const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const cookieToken = (req.headers.cookie || '')
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith('ucc_session='));
  const token = bearerToken || (cookieToken && decodeURIComponent(cookieToken.slice('ucc_session='.length)));
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function requireRole(user, role) {
  return user && user.role.toLowerCase() === role.toLowerCase();
}

// Utility: send JSON
function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function sendAuthenticatedJson(res, statusCode, payload, token) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Set-Cookie': `ucc_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=14400`
  });
  res.end(JSON.stringify(payload));
}

// Static file serving
function getStaticFile(filePath) {
  const safePath = path.normalize(filePath).replace(/^\.(?:\/|\\)/, '');
  const fullPath = path.join(rootDir, safePath);
  return fs.existsSync(fullPath) && fs.statSync(fullPath).isFile() ? fullPath : null;
}

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon'
};

function serveStaticFile(res, requestPath) {
  const normalizedPath = requestPath === '/' ? '/index.html' : requestPath;
  const filePath = getStaticFile(normalizedPath.replace(/^\//, ''));
  if (!filePath) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  const extension = path.extname(filePath).toLowerCase();
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Server error');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentTypes[extension] || 'application/octet-stream' });
    res.end(content);
  });
}

const protectedPages = {
  '/attendance.html': ['Program Head', 'Faculty'],
  '/grades.html': ['Program Head', 'Faculty'],
  '/reports.html': ['Program Head', 'Faculty'],
  '/students.html': ['Program Head']
};

// Server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Login endpoint
  if (url.pathname === '/api/login' && req.method === 'POST') {
    let rawBody = '';
    req.on('data', chunk => rawBody += chunk);
    req.on('end', async () => {
      try {
        const { role, username, password } = JSON.parse(rawBody);

        if (role === 'student') {
          if (useMongo && mongoDb) {
            const identifier = String(username || '').trim().toLowerCase();
            const student = await mongoDb.collection('students').findOne({ $or: [{ username: identifier }, { email: identifier }] });
            if (student && student.password && await bcryptjs.compare(password, student.password)) {
              const token = generateToken({ username: student.username, role: 'Student' });
              return sendAuthenticatedJson(res, 200, { success: true, role: 'Student', token, student: { name: student.name } }, token);
            }
          }
          return sendJson(res, 401, { success: false, message: 'Invalid student credentials' });
        }

        // Staff login
        if (useMongo && mongoDb) {
          const user = await mongoDb.collection('users').findOne({ username, role });
          if (user && await bcryptjs.compare(password, user.password)) {
            const token = generateToken({ username, role: user.role });
            return sendAuthenticatedJson(res, 200, { success: true, role: user.role, token }, token);
          }
        }
        return sendJson(res, 401, { success: false, message: 'Invalid staff credentials' });
      } catch {
        sendJson(res, 400, { success: false, message: 'Invalid request body' });
      }
    });
    return;
  }

  if (url.pathname === '/api/student-registration' && req.method === 'POST') {
    let rawBody = '';
    req.on('data', chunk => rawBody += chunk);
    req.on('end', async () => {
      try {
        const { name, studentId, email, password } = JSON.parse(rawBody);
        const normalizedEmail = String(email || '').trim().toLowerCase();
        const normalizedUsername = normalizedEmail.split('@')[0];

        if (!name || !studentId || !normalizedEmail || !password || !normalizedUsername) {
          return sendJson(res, 400, { success: false, message: 'All registration fields are required.' });
        }
        if (!useMongo || !mongoDb) {
          return sendJson(res, 503, { success: false, message: 'Student registration is temporarily unavailable.' });
        }

        const existingStudent = await mongoDb.collection('students').findOne({
          $or: [{ username: normalizedUsername }, { email: normalizedEmail }, { studentId: String(studentId).trim() }]
        });
        if (existingStudent) {
          return sendJson(res, 409, { success: false, message: 'A student account with those details already exists.' });
        }

        const student = {
          name: String(name).trim(),
          studentId: String(studentId).trim(),
          username: normalizedUsername,
          email: normalizedEmail,
          password: await bcryptjs.hash(password, 12),
          createdAt: new Date()
        };
        await mongoDb.collection('students').insertOne(student);
        return sendJson(res, 201, { success: true, message: 'Registration successful. Please sign in.' });
      } catch {
        return sendJson(res, 400, { success: false, message: 'Invalid registration request.' });
      }
    });
    return;
  }

  // Students API
  if (url.pathname === '/api/students') {
    const user = authenticateToken(req);
    if (!user) return sendJson(res, 401, { success: false, message: 'Unauthorized' });

    if (req.method === 'GET') {
      if (!requireRole(user, 'Program Head') && !requireRole(user, 'Faculty')) {
        return sendJson(res, 403, { success: false, message: 'Forbidden' });
      }
      const docs = useMongo ? await mongoDb.collection('students').find({}).limit(500).toArray() : [];
      return sendJson(res, 200, { success: true, data: docs });
    }

    if (req.method === 'POST') {
      if (!requireRole(user, 'Program Head')) return sendJson(res, 403, { success: false, message: 'Forbidden' });
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        const payload = JSON.parse(body);
        const newStudent = { ...payload, createdAt: new Date() };
        const result = await mongoDb.collection('students').insertOne(newStudent);
        sendJson(res, 201, { success: true, data: { ...newStudent, _id: result.insertedId } });
      });
      return;
    }
  }

  // Activity API
  if (url.pathname === '/api/activity') {
    const user = authenticateToken(req);
    if (!user) return sendJson(res, 401, { success: false, message: 'Unauthorized' });
    if (!requireRole(user, 'Program Head') && !requireRole(user, 'Faculty')) {
      return sendJson(res, 403, { success: false, message: 'Forbidden' });
    }
    const items = useMongo ? await mongoDb.collection('activity').find({}).limit(200).toArray() : [];
    return sendJson(res, 200, { success: true, data: items });
  }

  // Session info
  if (url.pathname === '/api/session') {
    const user = authenticateToken(req);
    return sendJson(res, 200, { success: true, session: user || null });
  }

  if (url.pathname === '/api/logout' && req.method === 'POST') {
    res.writeHead(204, {
      'Set-Cookie': 'ucc_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'
    });
    return res.end();
  }

  if (protectedPages[url.pathname]) {
    const user = authenticateToken(req);
    if (!user) {
      res.writeHead(302, { Location: '/' });
      return res.end();
    }
    if (!protectedPages[url.pathname].some((role) => requireRole(user, role))) {
      return sendJson(res, 403, { success: false, message: 'Forbidden' });
    }
  }

  // Default: serve static
  serveStaticFile(res, url.pathname);
});

// Start server
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ucc_backend_db';
connectToMongo(mongoUri).finally(() => {
  server.listen(port, () => console.log(`Server running at http://localhost:${port}`));
});
