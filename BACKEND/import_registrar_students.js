const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const bcryptjs = require('bcryptjs');

const csvPath = process.argv[2];
const temporaryPassword = process.env.STUDENT_TEMPORARY_PASSWORD || 'ChangeMe2026!';
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ucc_backend_db';
const databaseName = process.env.MONGO_DB_NAME || 'UCC_G&A_DB';
const requiredColumns = ['studentId', 'name', 'email', 'course', 'year', 'status'];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

async function importStudents() {
  if (!csvPath) throw new Error('Usage: node import_registrar_students.js <registrar-students.csv>');
  const rows = parseCsv(fs.readFileSync(path.resolve(csvPath), 'utf8'));
  const headers = rows.shift();
  if (!headers) throw new Error('The CSV file is empty.');
  const headerIndexes = Object.fromEntries(headers.map((header, index) => [header.trim(), index]));
  const missing = requiredColumns.filter((column) => headerIndexes[column] === undefined);
  if (missing.length) throw new Error(`Missing CSV columns: ${missing.join(', ')}`);

  const students = rows.map((row, rowIndex) => {
    const student = Object.fromEntries(requiredColumns.map((column) => [column, String(row[headerIndexes[column]] || '').trim()]));
    if (requiredColumns.some((column) => !student[column])) throw new Error(`CSV row ${rowIndex + 2} has missing required data.`);
    student.email = student.email.toLowerCase();
    student.username = student.studentId.toLowerCase();
    return student;
  });

  const client = new MongoClient(mongoUri);
  await client.connect();
  try {
    const database = client.db(databaseName);
    const password = await bcryptjs.hash(temporaryPassword, 12);
    for (const student of students) {
      await database.collection('students').updateOne(
        { studentId: student.studentId },
        { $set: { name: student.name, email: student.email, course: student.course, year: student.year, status: student.status, updatedAt: new Date() }, $setOnInsert: { studentId: student.studentId, createdAt: new Date() } },
        { upsert: true }
      );
      await database.collection('student_logins').updateOne(
        { studentId: student.studentId },
        { $set: { name: student.name, email: student.email, username: student.username, password, mustChangePassword: true, updatedAt: new Date() }, $setOnInsert: { studentId: student.studentId, createdAt: new Date() } },
        { upsert: true }
      );
    }
    console.log(`Imported ${students.length} student record(s).`);
  } finally {
    await client.close();
  }
}

importStudents().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
