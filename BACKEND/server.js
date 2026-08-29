const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 3000;
const rootDir = __dirname;

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

const server = http.createServer((req, res) => {
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
    sendJson(res, 200, { success: true, data: studentRecords });
    return;
  }

  if (url.pathname === '/api/activity') {
    sendJson(res, 200, { success: true, data: activityFeed });
    return;
  }

  if (url.pathname === '/api/records') {
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

    req.on('end', () => {
      try {
        const payload = rawBody ? JSON.parse(rawBody) : {};
        const { role, username, password } = payload;

        if (role === 'student') {
          if (typeof username === 'string' && username.trim() && typeof password === 'string' && password.trim()) {
            sendJson(res, 200, {
              success: true,
              role: 'Student',
              student: {
                name: username.trim(),
                username: username.trim()
              }
            });
            return;
          }

          sendJson(res, 401, { success: false, message: 'Student credentials are required.' });
          return;
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

server.listen(port, () => {
  console.log(`UCC local backend is running at http://localhost:${port}`);
});
