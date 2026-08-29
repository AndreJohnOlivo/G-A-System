const http = require('http');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017')
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB:', error);
  });

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

const studentRecords = [
  { name: 'Ariana Cruz', course: 'BSCS 2A', attendance: '96%', grade: 'A', status: 'On Track', tone: 'success' },
  { name: 'Liam Santos', course: 'BSEd 3B', attendance: '92%', grade: 'A-', status: 'Excellent', tone: 'success' },
  { name: 'Janelle Ramos', course: 'BSBA 1A', attendance: '88%', grade: 'B+', status: 'Stable', tone: 'warning' },
  { name: 'Marcus Lee', course: 'BSCS 3C', attendance: '81%', grade: 'B', status: 'Monitoring', tone: 'warning' }
];

const activityFeed = [
  'Program Head approved the weekly attendance review.',
  'Faculty submitted updated grade entries for BSCS 2A.',
  'Student record verification completed for 14 entries.',
  'Class summary report was exported for the dean.'
];

const validUsers = {
  programhead: { username: 'programhead', password: 'ProgramHead2026', role: 'Program Head' },
  faculty: { username: 'faculty', password: 'Faculty2026', role: 'Faculty' }
};

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

// Optional MongoDB integration. If MONGO_URI is provided, the server will
// attempt to use the `students` and `activity` collections from that DB.
let mongoClient = null;
let mongoDb = null;
let useMongo = false;

async function connectToMongo(uri) {
  try {
    const { MongoClient } = require('mongodb');
    mongoClient = new MongoClient(uri, { connectTimeoutMS: 5000 });
    await mongoClient.connect();
    mongoDb = mongoClient.db();
    useMongo = true;
    console.log('Connected to MongoDB:', uri.replace(/:\/\/.*@/, '://***@'));
  } catch (err) {
    console.warn('MongoDB connection failed; falling back to in-memory data.', err.message || err);
    useMongo = false;
    mongoClient = null;
    mongoDb = null;
  }
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
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
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  if (url.pathname === '/api/students') {
    try {
      if (useMongo && mongoDb) {
        const docs = await mongoDb.collection('students').find({}).limit(500).toArray();
        sendJson(res, 200, { success: true, data: docs });
        return;
      }
    } catch (err) {
      console.error('Mongo query /api/students failed:', err.message || err);
    }

    sendJson(res, 200, { success: true, data: studentRecords });
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
        const docs = await mongoDb.collection('students').find({}).limit(1000).toArray();
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
                const student = await mongoDb.collection('students').findOne({ $or: [{ username }, { email: username }] });
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
              sendJson(res, 200, { success: true, role: user.role || role, message: `${user.role || role} login successful.` });
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
          sendJson(res, 200, {
            success: true,
            role: validUser.role,
            message: `${validUser.role} login successful.`
          });
          return;
        }

        sendJson(res, 401, { success: false, message: 'Invalid username or password.' });
      } catch (error) {
        sendJson(res, 400, { success: false, message: 'Invalid request body.' });
      }
    });
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

startServer(port);
