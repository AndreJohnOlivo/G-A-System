const http = require('http');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const port = process.env.PORT || 3000;
// Serve static files from a configurable folder. Use ROOT_DIR env var if provided,
// otherwise fall back to the parent project folder (where index.html lives).
const configuredRoot = process.env.ROOT_DIR && process.env.ROOT_DIR.trim();
const rootDir = configuredRoot
  ? path.resolve(configuredRoot)
  : path.join(__dirname, '..');

// Ensure the root directory exists; if not, log a warning (server will return 404s).
if (!fs.existsSync(rootDir)) {
  console.warn('Configured static root does not exist:', rootDir);
}

// In-memory fallback store for students is left empty so MongoDB is authoritative
const studentRecords = [];

// Minimal in-memory activity feed; prefer fetching from MongoDB
const activityFeed = [];

const validUsers = {
  programhead: { username: 'programhead', password: 'ProgramHead2026', role: 'Program Head' },
  faculty: { username: 'faculty', password: 'Faculty2026', role: 'Faculty' }
};

// Configurable collection names
const TARGET_DB_NAME = process.env.MONGO_DB_NAME || 'UCC_G&A_DB';
const STUDENT_COLLECTION_NAME = process.env.STUDENTS_COLLECTION || TARGET_DB_NAME;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// A replica set URI lets the driver discover the elected primary and reconnect
// after a member fails over. Set MONGO_URI to the deployment connection string.
let mongoClient = null;
let mongoDb = null;
let useMongo = false;

// Simple in-memory session store for demo purposes
const sessions = {};
const SESSION_TTL = 1000 * 60 * 60 * 4; // 4 hours
function generateSessionId() { return require('crypto').randomBytes(24).toString('hex'); }
function createSession(role, username) {
  const id = generateSessionId();
  sessions[id] = { role: role || '', username: username || '', expires: Date.now() + SESSION_TTL };
  return id;
}
function getSessionFromReq(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/(?:^|; )sessionId=([0-9a-fA-F]+)/);
  if (!match) return null;
  const id = match[1];
  const s = sessions[id];
  if (!s) return null;
  if (s.expires < Date.now()) { delete sessions[id]; return null; }
  return s;
}

async function connectToMongo(uri) {
  try {
    mongoClient = new MongoClient(uri, {
      connectTimeoutMS: 5000,
      serverSelectionTimeoutMS: 5000,
      retryReads: true,
      retryWrites: true
    });
    await mongoClient.connect();
    mongoDb = mongoClient.db(TARGET_DB_NAME);
    useMongo = true;
    console.log('Connected to MongoDB replica set:', uri.replace(/:\/\/.*@/, '://***@'));
    console.log('Using MongoDB database:', mongoDb.databaseName);
    console.log('Student collection name:', STUDENT_COLLECTION_NAME);
  } catch (err) {
    console.warn('MongoDB connection failed; falling back to in-memory data.', err.message || err);
    useMongo = false;
    mongoClient = null;
    mongoDb = null;
  }
}

function sendJson(res, statusCode, payload, additionalHeaders = {}) {
  const headers = Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  }, additionalHeaders);
  res.writeHead(statusCode, headers);
  res.end(JSON.stringify(payload));
}

function getStaticFile(filePath) {
  const safePath = path.normalize(filePath).replace(/^\.(?:\/|\\)/, '');
  const fullPath = path.join(rootDir, safePath);

  if (!fullPath.startsWith(rootDir)) {
    return null;
  }

  return fs.existsSync(fullPath) && fs.statSync(fullPath).isFile() ? fullPath : null;
}

function serveStaticFile(res, requestPath) {
  const normalizedPath = requestPath === '/' ? '/index.html' : requestPath;
  const relativePath = normalizedPath.replace(/^\//, '');
  const filePath = getStaticFile(relativePath);

  if (!filePath) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  const extension = path.extname(filePath).toLowerCase();
  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Server error');
      return;
    }

    res.writeHead(200, {
      'Content-Type': mimeTypes[extension] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Role'
    });
    res.end();
    return;
  }

  if (url.pathname === '/api/students') {
    // GET: list students. POST: add student record.
    if (req.method === 'GET') {
      try {
        if (useMongo && mongoDb) {
          const docs = await mongoDb.collection(STUDENT_COLLECTION_NAME).find({}).limit(500).toArray();
          sendJson(res, 200, { success: true, data: docs });
          return;
        }
      } catch (err) {
        console.error('Mongo query /api/students failed:', err.message || err);
      }

      sendJson(res, 200, { success: true, data: studentRecords });
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        try {
          // Server-side RBAC: require an authenticated session with Program Head role
          const sess = getSessionFromReq(req);
          const roleNormalized = (sess && sess.role ? String(sess.role).toLowerCase() : '');
          if (!sess || !(roleNormalized === 'program head' || roleNormalized === 'programhead')) {
            sendJson(res, 403, { success: false, message: 'Forbidden: insufficient role' });
            return;
          }
          const payload = body ? JSON.parse(body) : {};
          const newStudent = {
            name: payload.name || payload.fullName || 'Unknown',
            studentId: payload.studentId || payload.id || '',
            course: payload.course || '',
            year: payload.year || '',
            status: payload.status || 'Active',
            createdAt: new Date()
          };

          if (useMongo && mongoDb) {
            const result = await mongoDb.collection(STUDENT_COLLECTION_NAME).insertOne(newStudent);
            newStudent._id = result.insertedId;
            sendJson(res, 201, { success: true, data: newStudent });
            return;
          }

          // Fallback to in-memory store
          studentRecords.push(newStudent);
          sendJson(res, 201, { success: true, data: newStudent });
          return;
        } catch (err) {
          console.error('Failed to add student:', err);
          sendJson(res, 500, { success: false, message: 'Failed to add student.' });
          return;
        }
      });
      return;
    }

    // Method not allowed
    sendJson(res, 405, { success: false, message: 'Method not allowed' });
    return;
  }

  if (url.pathname === '/api/activity') {
    try {
        if (useMongo && mongoDb) {
        const items = await mongoDb.collection('activity').find({}).limit(200).toArray();
        sendJson(res, 200, { success: true, data: items });
        return;
      }
    } catch (err) {
      console.error('Mongo query /api/activity failed:', err.message || err);
    }

    sendJson(res, 200, { success: true, data: activityFeed });
    return;
  }

  if (url.pathname === '/api/records') {
    try {
        if (useMongo && mongoDb) {
        const docs = await mongoDb.collection(STUDENT_COLLECTION_NAME).find({}).limit(1000).toArray();
        sendJson(res, 200, { success: true, data: docs });
        return;
      }
    } catch (err) {
      console.error('Mongo query /api/records failed:', err.message || err);
    }

    sendJson(res, 200, { success: true, data: studentRecords });
    return;
  }

  if (url.pathname === '/api/login') {
    if (req.method !== 'POST') {
      sendJson(res, 405, { success: false, message: 'Method not allowed' });
      return;
    }

    let rawBody = '';
    req.on('data', (chunk) => {
      rawBody += chunk;
    });

    req.on('end', async () => {
      try {
        const payload = rawBody ? JSON.parse(rawBody) : {};
        const { role, username, password } = payload;

        if (role === 'student') {
          if (typeof username === 'string' && username.trim() && typeof password === 'string' && password.trim()) {
            // Try Mongo first
            if (useMongo && mongoDb) {
              try {
                const student = await mongoDb.collection(STUDENT_COLLECTION_NAME).findOne({ $or: [{ username }, { email: username }] });
                if (student) {
                  sendJson(res, 200, { success: true, role: 'Student', student });
                  return;
                }
              } catch (err) {
                console.error('Mongo lookup student login failed:', err.message || err);
              }
            }

            // Fallback: accept any non-empty student credentials (keeps behavior consistent with earlier simple server)
            sendJson(res, 200, {
              success: true,
              role: 'Student',
              student: { name: username.trim(), username: username.trim() }
            });
            return;
          }

          sendJson(res, 401, { success: false, message: 'Student credentials are required.' });
          return;
        }

        // Staff login: try Mongo users collection, then fallback to configured validUsers
        try {
          if (useMongo && mongoDb) {
            const user = await mongoDb.collection('users').findOne({ username, role });
            if (user && user.password === password) {
              // create session for staff
              const sessionId = createSession(user.role || role, username);
              const cookie = `sessionId=${sessionId}; HttpOnly; Path=/; Max-Age=${Math.floor(SESSION_TTL/1000)}; SameSite=Lax`;
              sendJson(res, 200, { success: true, role: user.role || role, message: `${user.role || role} login successful.` }, { 'Set-Cookie': cookie });
              return;
            }
          }
        } catch (err) {
          console.error('Mongo lookup staff login failed:', err.message || err);
        }

        const validUser = validUsers[role];
        if (!validUser) {
          sendJson(res, 401, { success: false, message: 'Role not authorized.' });
          return;
        }

        if (username === validUser.username && password === validUser.password) {
          const sessionId = createSession(validUser.role, username);
          const cookie = `sessionId=${sessionId}; HttpOnly; Path=/; Max-Age=${Math.floor(SESSION_TTL/1000)}; SameSite=Lax`;
          sendJson(res, 200, {
            success: true,
            role: validUser.role,
            message: `${validUser.role} login successful.`
          }, { 'Set-Cookie': cookie });
          return;
        }

        sendJson(res, 401, { success: false, message: 'Invalid username or password.' });
      } catch (error) {
        sendJson(res, 400, { success: false, message: 'Invalid request body.' });
      }
    });
    return;
  }

  // session info endpoint
  if (url.pathname === '/api/session') {
    if (req.method === 'GET') {
      const s = getSessionFromReq(req);
      sendJson(res, 200, { success: true, session: s ? { username: s.username, role: s.role } : null });
      return;
    }
    sendJson(res, 405, { success: false, message: 'Method not allowed' });
    return;
  }

  // logout
  if (url.pathname === '/api/logout') {
    if (req.method === 'POST') {
      const cookie = req.headers.cookie || '';
      const match = cookie.match(/(?:^|; )sessionId=([0-9a-fA-F]+)/);
      if (match) { delete sessions[match[1]]; }
      // clear cookie
      sendJson(res, 200, { success: true }, { 'Set-Cookie': 'sessionId=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax' });
      return;
    }
    sendJson(res, 405, { success: false, message: 'Method not allowed' });
    return;
  }

  serveStaticFile(res, url.pathname);
});

function startServer(attemptPort) {
  const p = Number(attemptPort) || Number(process.env.PORT) || 3000;

  server.once('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.warn(`Port ${p} in use, trying ${p + 1}...`);
      setTimeout(() => startServer(p + 1), 200);
      return;
    }
    console.error('Server error:', err);
    process.exit(1);
  });

  server.listen(p, () => {
    console.log(`UCC local backend is running at http://localhost:${p}`);
  });
}

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ucc_backend_db';

connectToMongo(mongoUri)
  .finally(() => startServer(port));

async function shutdown() {
  if (mongoClient) {
    await mongoClient.close();
  }
  server.close(() => process.exit(0));
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
