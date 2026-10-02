const http = require('http');
const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');

const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-me';
const PROGRAM_HEAD_PASSWORD = process.env.PROGRAM_HEAD_PASSWORD || 'nimfa.silla1';

// Serve static files from configurable folder
const configuredRoot = process.env.ROOT_DIR && process.env.ROOT_DIR.trim();
const rootDir = configuredRoot ? path.resolve(configuredRoot) : path.join(__dirname, '..');

// Mongo setup
let mongoClient = null;
let mongoDb = null;
let useMongo = false;

const nimfaSillaAccount = {
  name: 'Nimfa Silla',
  username: 'nimfa.silla',
  role: 'Program Head'
};

async function seedProgramHeadAccount() {
  const passwordHash = await bcryptjs.hash(PROGRAM_HEAD_PASSWORD, 12);
  await mongoDb.collection('users').updateOne(
    { username: nimfaSillaAccount.username },
    {
      $set: {
        name: nimfaSillaAccount.name,
        role: nimfaSillaAccount.role,
        password: passwordHash
      },
      $setOnInsert: { createdAt: new Date() }
    },
    { upsert: true }
  );
}

async function copyAndRemove(sourceName, targetName, filter = {}) {
  const source = mongoDb.collection(sourceName);
  const documents = await source.find(filter).toArray();

  if (!documents.length) return;

  await mongoDb.collection(targetName).bulkWrite(documents.map((document) => ({
    replaceOne: { filter: { _id: document._id }, replacement: document, upsert: true }
  })));
  await source.deleteMany({ _id: { $in: documents.map((document) => document._id) } });
}

async function migrateStudentCollections() {
  await copyAndRemove('students', 'student_logins', { password: { $exists: true } });
  await copyAndRemove('studentRecords', 'students');
}

async function connectToMongo(uri) {
  try {
    mongoClient = new MongoClient(uri);
    await mongoClient.connect();
    mongoDb = mongoClient.db(process.env.MONGO_DB_NAME || 'UCC_G&A_DB');
    await Promise.all([
      mongoDb.collection('users').createIndex({ username: 1 }, { unique: true }),
      mongoDb.collection('students').createIndex({ studentId: 1 }, { unique: true, sparse: true }),
      mongoDb.collection('attendance_logs').createIndex({ studentId: 1, subject: 1, date: 1 }, { unique: true }),
      mongoDb.collection('grade_records').createIndex({ studentId: 1, subject: 1, term: 1 }, { unique: true }),
      mongoDb.collection('audit_logs').createIndex({ createdAt: -1 })
    ]);
    await seedProgramHeadAccount();
    await migrateStudentCollections();
    useMongo = true;
    console.log('Connected to MongoDB and prepared user accounts and student records');
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

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => body += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
  });
}

function requireProgramHead(req, res) {
  const user = authenticateToken(req);
  if (!requireRole(user, 'Program Head')) {
    sendJson(res, 403, { success: false, message: 'Program Head access is required.' });
    return null;
  }
  return user;
}

function asText(value) {
  return String(value || '').trim();
}

function normalizeSubjects(subjects) {
  const values = Array.isArray(subjects) ? subjects : String(subjects || '').split(',');
  return [...new Set(values.map(asText).filter(Boolean))];
}

async function getFacultyAccount(user) {
  if (!requireRole(user, 'Faculty')) return null;
  return mongoDb.collection('users').findOne({ username: user.username, role: 'Faculty', active: { $ne: false } });
}

async function requireSubjectAccess(user, subject) {
  if (requireRole(user, 'Program Head')) return true;
  const faculty = await getFacultyAccount(user);
  return Boolean(faculty?.assignedSubjects?.some((assignedSubject) => assignedSubject.toLowerCase() === subject.toLowerCase()));
}

async function getAcademicFilter(user, requestedSubject) {
  if (requireRole(user, 'Program Head')) return requestedSubject ? { subject: requestedSubject } : {};
  const faculty = await getFacultyAccount(user);
  if (!faculty) return null;
  if (requestedSubject) return await requireSubjectAccess(user, requestedSubject) ? { subject: requestedSubject } : null;
  return { subject: { $in: faculty.assignedSubjects || [] } };
}

async function saveGradeRecord(student, subject, term, grades) {
  const now = new Date();
  const filter = { studentId: student.studentId, subject, term };
  const update = [
    {
      $set: {
        studentId: student.studentId,
        studentName: student.name,
        subject,
        term,
        ...(Object.hasOwn(grades, 'midterm') ? { midterm: grades.midterm } : {}),
        ...(Object.hasOwn(grades, 'final') ? { final: grades.final } : {}),
        updatedAt: now,
        createdAt: { $ifNull: ['$createdAt', now] }
      }
    },
    {
      $set: {
        average: {
          $cond: [
            { $and: [{ $isNumber: '$midterm' }, { $isNumber: '$final' }] },
            { $round: [{ $divide: [{ $add: ['$midterm', '$final'] }, 2] }, 2] },
            '$$REMOVE'
          ]
        }
      }
    }
  ];

  try {
    const result = await mongoDb.collection('grade_records').findOneAndUpdate(filter, update, { upsert: true, returnDocument: 'before' });
    return { previous: result.value, record: await mongoDb.collection('grade_records').findOne(filter) };
  } catch (err) {
    if (err.code !== 11000) throw err;
    const result = await mongoDb.collection('grade_records').findOneAndUpdate(filter, update, { returnDocument: 'before' });
    return { previous: result.value, record: await mongoDb.collection('grade_records').findOne(filter) };
  }
}

async function createAuditLog(user, action, target, previous, changes) {
  await mongoDb.collection('audit_logs').insertOne({
    action,
    actor: { username: user.username, role: user.role },
    target,
    previous: previous || null,
    changes,
    createdAt: new Date()
  });
}

async function getStudentByIdentifier(identifier) {
  return mongoDb.collection('students').findOne({
    $or: [{ _id: ObjectId.isValid(identifier) ? new ObjectId(identifier) : null }, { studentId: identifier }]
  });
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
  '/students.html': ['Program Head'],
  '/faculty.html': ['Program Head']
};

// Server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/health' && req.method === 'GET') {
    if (!useMongo || !mongoDb) return sendJson(res, 503, { success: false, status: 'database unavailable' });
    try {
      await mongoDb.command({ ping: 1 });
      return sendJson(res, 200, { success: true, status: 'ok' });
    } catch {
      return sendJson(res, 503, { success: false, status: 'database unavailable' });
    }
  }

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
            const student = await mongoDb.collection('student_logins').findOne({ $or: [{ username: identifier }, { email: identifier }] });
            if (student && student.password && await bcryptjs.compare(password, student.password)) {
              const token = generateToken({ username: student.username, role: 'Student' });
              return sendAuthenticatedJson(res, 200, { success: true, role: 'Student', token, student: { name: student.name } }, token);
            }
          }
          return sendJson(res, 401, { success: false, message: 'Invalid student credentials' });
        }

        // Staff login
        if (useMongo && mongoDb) {
          const staffUsername = String(username || '').trim().toLowerCase();
          const staffRole = role === 'programhead' ? 'Program Head' : role === 'faculty' ? 'Faculty' : role;
          const user = await mongoDb.collection('users').findOne({ username: staffUsername, role: staffRole, active: { $ne: false } });
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
    return sendJson(res, 403, { success: false, message: 'Student accounts are provisioned by the registrar.' });
  }

  if (url.pathname === '/api/attendance') {
    const user = authenticateToken(req);
    if (!user || (!requireRole(user, 'Program Head') && !requireRole(user, 'Faculty'))) {
      return sendJson(res, 403, { success: false, message: 'Staff access is required.' });
    }
    if (req.method === 'GET') {
      const requestedSubject = asText(url.searchParams.get('subject'));
      const filter = await getAcademicFilter(user, requestedSubject);
      if (!filter) return sendJson(res, 403, { success: false, message: 'You are not assigned to this subject.' });
      if (url.searchParams.get('date')) filter.date = url.searchParams.get('date');
      const data = useMongo ? await mongoDb.collection('attendance_logs').find(filter).sort({ date: -1 }).toArray() : [];
      return sendJson(res, 200, { success: true, data });
    }
    if (req.method === 'POST') {
      try {
        const { studentId, subject, date, status } = await readJsonBody(req);
        if (!asText(studentId) || !asText(subject) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !['Present', 'Absent', 'Late'].includes(status)) {
          return sendJson(res, 400, { success: false, message: 'Student, subject, date, and a valid status are required.' });
        }
        if (!await requireSubjectAccess(user, asText(subject))) {
          return sendJson(res, 403, { success: false, message: 'You are not assigned to this subject.' });
        }
        const student = await getStudentByIdentifier(asText(studentId));
        if (!student) return sendJson(res, 404, { success: false, message: 'Student record not found.' });
        const record = { studentId: student.studentId, studentName: student.name, subject: asText(subject), date, status, updatedAt: new Date() };
        const result = await mongoDb.collection('attendance_logs').findOneAndUpdate(
          { studentId: record.studentId, subject: record.subject, date: record.date },
          { $set: record, $setOnInsert: { createdAt: new Date() } },
          { upsert: true, returnDocument: 'before' }
        );
        await createAuditLog(user, 'attendance.saved', { studentId: record.studentId, subject: record.subject, date }, result.value, { status });
        return sendJson(res, 200, { success: true, data: record });
      } catch {
        return sendJson(res, 400, { success: false, message: 'Invalid attendance request.' });
      }
    }
  }

  if (url.pathname === '/api/grades') {
    const user = authenticateToken(req);
    if (!user || (!requireRole(user, 'Program Head') && !requireRole(user, 'Faculty'))) {
      return sendJson(res, 403, { success: false, message: 'Staff access is required.' });
    }
    if (req.method === 'GET') {
      const requestedSubject = asText(url.searchParams.get('subject'));
      const filter = await getAcademicFilter(user, requestedSubject);
      if (!filter) return sendJson(res, 403, { success: false, message: 'You are not assigned to this subject.' });
      if (url.searchParams.get('term')) filter.term = url.searchParams.get('term');
      const data = useMongo ? await mongoDb.collection('grade_records').find(filter).sort({ updatedAt: -1 }).toArray() : [];
      return sendJson(res, 200, { success: true, data });
    }
    if (req.method === 'POST') {
      try {
        const payload = await readJsonBody(req);
        const student = await getStudentByIdentifier(asText(payload.studentId));
        const subject = asText(payload.subject);
        const term = asText(payload.term) || 'Term 1 2026';
        if (!student || !subject) return sendJson(res, 400, { success: false, message: 'A valid student and subject are required.' });
        if (!await requireSubjectAccess(user, subject)) {
          return sendJson(res, 403, { success: false, message: 'You are not assigned to this subject.' });
        }
        const grades = {};
        for (const field of ['midterm', 'final']) {
          if (payload[field] === '' || payload[field] === undefined) continue;
          const score = Number(payload[field]);
          if (!Number.isFinite(score) || score < 0 || score > 100) return sendJson(res, 400, { success: false, message: 'Grades must be between 0 and 100.' });
          grades[field] = score;
        }
        const result = await saveGradeRecord(student, subject, term, grades);
        await createAuditLog(user, 'grade.saved', { studentId: student.studentId, subject, term }, result.previous, grades);
        return sendJson(res, 200, { success: true, data: result.record });
      } catch {
        return sendJson(res, 400, { success: false, message: 'Invalid grade request.' });
      }
    }
  }

  if (url.pathname === '/api/summary' && req.method === 'GET') {
    const user = authenticateToken(req);
    if (!user || (!requireRole(user, 'Program Head') && !requireRole(user, 'Faculty'))) return sendJson(res, 403, { success: false, message: 'Staff access is required.' });
    const [studentCount, attendance, grades] = await Promise.all([
      mongoDb.collection('students').countDocuments(),
      mongoDb.collection('attendance_logs').find({}).toArray(),
      mongoDb.collection('grade_records').find({ average: { $exists: true } }).toArray()
    ]);
    const present = attendance.filter((record) => record.status === 'Present').length;
    const late = attendance.filter((record) => record.status === 'Late').length;
    const classAverage = grades.length ? Number((grades.reduce((total, record) => total + record.average, 0) / grades.length).toFixed(2)) : null;
    return sendJson(res, 200, { success: true, data: { studentCount, present, late, attendanceRate: attendance.length ? Math.round((present / attendance.length) * 100) : null, classAverage, atRisk: grades.filter((record) => record.average < 75).length, pendingGrades: studentCount - new Set(grades.map((record) => record.studentId)).size } });
  }

  if (url.pathname === '/api/audit-logs' && req.method === 'GET') {
    if (!requireProgramHead(req, res)) return;
    const data = await mongoDb.collection('audit_logs').find({}).sort({ createdAt: -1 }).limit(200).toArray();
    return sendJson(res, 200, { success: true, data });
  }

  if (url.pathname === '/api/my-records' && req.method === 'GET') {
    const user = authenticateToken(req);
    if (!requireRole(user, 'Student')) return sendJson(res, 403, { success: false, message: 'Student access is required.' });
    const login = await mongoDb.collection('student_logins').findOne({ username: user.username });
    if (!login) return sendJson(res, 404, { success: false, message: 'Student account not found.' });
    const [student, attendance, grades] = await Promise.all([
      mongoDb.collection('students').findOne({ studentId: login.studentId }),
      mongoDb.collection('attendance_logs').find({ studentId: login.studentId }).sort({ date: -1 }).toArray(),
      mongoDb.collection('grade_records').find({ studentId: login.studentId }).sort({ updatedAt: -1 }).toArray()
    ]);
    return sendJson(res, 200, { success: true, data: { student, attendance, grades } });
  }

  if (url.pathname === '/api/change-password' && req.method === 'POST') {
    const user = authenticateToken(req);
    if (!user) return sendJson(res, 401, { success: false, message: 'Unauthorized' });
    try {
      const { currentPassword, newPassword } = await readJsonBody(req);
      if (!newPassword || newPassword.length < 8) return sendJson(res, 400, { success: false, message: 'New password must have at least 8 characters.' });
      const collection = requireRole(user, 'Student') ? 'student_logins' : 'users';
      const account = await mongoDb.collection(collection).findOne({ username: user.username });
      if (!account || !await bcryptjs.compare(currentPassword || '', account.password)) return sendJson(res, 401, { success: false, message: 'Current password is incorrect.' });
      await mongoDb.collection(collection).updateOne({ _id: account._id }, { $set: { password: await bcryptjs.hash(newPassword, 12), mustChangePassword: false, passwordChangedAt: new Date() } });
      return sendJson(res, 200, { success: true, message: 'Password updated.' });
    } catch {
      return sendJson(res, 400, { success: false, message: 'Invalid password request.' });
    }
  }

  const facultyUpdateMatch = url.pathname.match(/^\/api\/faculty\/([a-f\d]{24})$/i);
  if (facultyUpdateMatch && req.method === 'PATCH') {
    const user = requireProgramHead(req, res);
    if (!user) return;
    try {
      const payload = await readJsonBody(req);
      const facultyCollection = mongoDb.collection('users');
      const faculty = await facultyCollection.findOne({ _id: new ObjectId(facultyUpdateMatch[1]), role: 'Faculty' });
      if (!faculty) return sendJson(res, 404, { success: false, message: 'Faculty account not found.' });

      const updates = {};
      if (Object.hasOwn(payload, 'assignedSubjects')) updates.assignedSubjects = normalizeSubjects(payload.assignedSubjects);
      if (Object.hasOwn(payload, 'active')) {
        if (typeof payload.active !== 'boolean') return sendJson(res, 400, { success: false, message: 'Active must be true or false.' });
        updates.active = payload.active;
      }
      if (!Object.keys(updates).length) return sendJson(res, 400, { success: false, message: 'No faculty updates were provided.' });

      updates.updatedAt = new Date();
      await facultyCollection.updateOne({ _id: faculty._id }, { $set: updates });
      await createAuditLog(user, 'faculty.updated', { username: faculty.username }, { assignedSubjects: faculty.assignedSubjects, active: faculty.active }, updates);
      const updatedFaculty = await facultyCollection.findOne({ _id: faculty._id }, { projection: { password: 0 } });
      return sendJson(res, 200, { success: true, data: updatedFaculty });
    } catch {
      return sendJson(res, 400, { success: false, message: 'Invalid faculty update request.' });
    }
  }

  if (url.pathname === '/api/faculty') {
    const user = requireProgramHead(req, res);
    if (!user) return;

    if (req.method === 'GET') {
      const data = await mongoDb.collection('users')
        .find({ role: 'Faculty' }, { projection: { password: 0 } })
        .sort({ name: 1, username: 1 })
        .toArray();
      return sendJson(res, 200, { success: true, data });
    }

    if (req.method === 'POST') {
      try {
        const payload = await readJsonBody(req);
        const name = asText(payload.name);
        const username = asText(payload.username).toLowerCase();
        const password = String(payload.password || '');
        if (!name || !username || password.length < 8) {
          return sendJson(res, 400, { success: false, message: 'Name, username, and a password of at least 8 characters are required.' });
        }

        const faculty = {
          name,
          username,
          role: 'Faculty',
          password: await bcryptjs.hash(password, 12),
          assignedSubjects: normalizeSubjects(payload.assignedSubjects),
          active: true,
          mustChangePassword: true,
          createdAt: new Date()
        };
        const result = await mongoDb.collection('users').insertOne(faculty);
        await createAuditLog(user, 'faculty.created', { username }, null, { name, assignedSubjects: faculty.assignedSubjects });
        const { password: passwordHash, ...responseFaculty } = { ...faculty, _id: result.insertedId };
        return sendJson(res, 201, { success: true, data: responseFaculty });
      } catch (error) {
        if (error.code === 11000) return sendJson(res, 409, { success: false, message: 'That username is already in use.' });
        return sendJson(res, 400, { success: false, message: 'Invalid faculty request.' });
      }
    }
  }

  const studentUpdateMatch = url.pathname.match(/^\/api\/students\/([a-f\d]{24})$/i);
  if (studentUpdateMatch && req.method === 'DELETE') {
    if (!requireProgramHead(req, res)) return;
    const studentCollection = mongoDb.collection('students');
    const student = await studentCollection.findOne({ _id: new ObjectId(studentUpdateMatch[1]) });
    if (!student) return sendJson(res, 404, { success: false, message: 'Student record not found.' });
    await Promise.all([
      studentCollection.deleteOne({ _id: student._id }),
      mongoDb.collection('attendance_logs').deleteMany({ studentId: student.studentId }),
      mongoDb.collection('grade_records').deleteMany({ studentId: student.studentId })
    ]);
    return sendJson(res, 204, {});
  }

  if (studentUpdateMatch && req.method === 'PATCH') {
    const user = authenticateToken(req);
    if (!requireRole(user, 'Program Head')) return sendJson(res, 403, { success: false, message: 'Forbidden' });

    let body = '';
    req.on('data', (chunk) => body += chunk);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const updates = {};
        const studentCollection = mongoDb.collection('students');
        const existingStudent = await studentCollection.findOne({ _id: new ObjectId(studentUpdateMatch[1]) });
        if (!existingStudent) return sendJson(res, 404, { success: false, message: 'Student record not found.' });

        for (const field of ['name', 'course', 'year', 'status', 'email']) {
          if (Object.hasOwn(payload, field) && asText(payload[field])) updates[field] = asText(payload[field]);
        }
        if (Object.hasOwn(payload, 'studentId') && asText(payload.studentId) && asText(payload.studentId) !== existingStudent.studentId) {
          const studentId = asText(payload.studentId);
          if (await studentCollection.findOne({ studentId, _id: { $ne: existingStudent._id } })) {
            return sendJson(res, 409, { success: false, message: 'That student ID is already in use.' });
          }
          updates.studentId = studentId;
        }

        if (Object.hasOwn(payload, 'attendance')) {
          const attendanceOptions = ['Present', 'Absent', 'Late', 'Not recorded'];
          if (!attendanceOptions.includes(payload.attendance)) {
            return sendJson(res, 400, { success: false, message: 'Invalid attendance value.' });
          }
          updates.attendance = payload.attendance;
        }

        if (Object.hasOwn(payload, 'midterm') || Object.hasOwn(payload, 'final')) {
          for (const field of ['midterm', 'final']) {
            if (!Object.hasOwn(payload, field) || payload[field] === '') continue;
            const score = Number(payload[field]);
            if (!Number.isFinite(score) || score < 0 || score > 100) {
              return sendJson(res, 400, { success: false, message: 'Grades must be between 0 and 100.' });
            }
            updates[field] = score;
          }

          const midterm = updates.midterm ?? existingStudent.midterm;
          const final = updates.final ?? existingStudent.final;
          if (Number.isFinite(midterm) && Number.isFinite(final)) {
            updates.grade = ((midterm + final) / 2).toFixed(2);
          }
        }

        if (!Object.keys(updates).length) {
          return sendJson(res, 400, { success: false, message: 'No record updates were provided.' });
        }

        updates.updatedAt = new Date();
        const result = await studentCollection.findOneAndUpdate(
          { _id: new ObjectId(studentUpdateMatch[1]) },
          { $set: updates },
          { returnDocument: 'after' }
        );
        return sendJson(res, 200, { success: true, data: result.value });
      } catch {
        return sendJson(res, 400, { success: false, message: 'Invalid student update request.' });
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
        try {
          const payload = JSON.parse(body || '{}');
          const studentId = asText(payload.studentId);
          const name = asText(payload.name);
          if (!studentId || !name) return sendJson(res, 400, { success: false, message: 'Student ID and name are required.' });
          if (await mongoDb.collection('students').findOne({ studentId })) return sendJson(res, 409, { success: false, message: 'That student ID is already in use.' });
          const newStudent = { ...payload, studentId, name, createdAt: new Date() };
          const result = await mongoDb.collection('students').insertOne(newStudent);
          sendJson(res, 201, { success: true, data: { ...newStudent, _id: result.insertedId } });
        } catch {
          sendJson(res, 400, { success: false, message: 'Invalid student request.' });
        }
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

async function closeMongo() {
  if (mongoClient) await mongoClient.close();
  mongoClient = null;
  mongoDb = null;
  useMongo = false;
}

// Start server
if (require.main === module) {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ucc_backend_db';
  connectToMongo(mongoUri).finally(() => {
    server.listen(port, () => console.log(`Server running at http://localhost:${port}`));
  });
}

module.exports = { server, connectToMongo, closeMongo };