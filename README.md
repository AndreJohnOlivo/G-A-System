# UCC Grading and Attendance System

A Node.js and MongoDB portal for managing student records, attendance, grades, reports, and student self-service access.

## Features

- Program Head account seeded for Nimfa Silla
- Student directory with add, edit, and delete operations
- Attendance records by student, subject, and date
- Grade records by student, subject, and term
- Optional Midterm and Final grade entry
- Live dashboard and report summaries
- CSV export for reports
- Student read-only access to personal attendance and grades
- Student password change endpoint

## Requirements

- Node.js 18 or later
- MongoDB running locally or a MongoDB connection string

## Setup

From the backend directory:

```powershell
cd "GradingAndAttendance\G-A-System\BACKEND"
npm install
```

Set environment variables before starting the server. In PowerShell:

```powershell
$env:MONGO_URI = "mongodb://127.0.0.1:27017/ucc_backend_db"
$env:MONGO_DB_NAME = "UCC_G&A_DB"
$env:JWT_SECRET = "replace-with-a-long-random-secret"
$env:PROGRAM_HEAD_PASSWORD = "replace-with-a-secure-password"
```

Start the application:

```powershell
npm start
```

Open `http://localhost:3000` in a browser.

## Load-Balanced Deployment

The included Docker Compose stack starts MongoDB, Nginx, and two backend instances. Nginx distributes requests between the instances at one public address, while MongoDB is the shared data store. The backend is stateless: all replicas must use the same `JWT_SECRET`.

Install Docker Desktop, then from the `G-A-System` directory create a local secrets file and start two backend replicas:

```powershell
Copy-Item .env.example .env
# Replace both placeholder values in .env before continuing.
docker compose up --build --scale backend=2
```

Open `http://localhost:8080`. To increase capacity, replace `2` with the desired number of backend instances. The `/health` endpoint reports whether an instance can reach MongoDB.

Grade writes are atomic at the database level. A midterm update and a final update submitted at the same time are merged into one grade record instead of one update overwriting the other.

## Program Head Access

The server creates or updates the Program Head account at startup:

Set `PROGRAM_HEAD_PASSWORD` before the first startup, and do not commit passwords or secrets.

For local testing, the server also creates a Faculty account assigned to `CS 101` at startup. Sign in as Faculty with username `test.faculty` and password `faculty.test1`. Override this password through `TEST_FACULTY_PASSWORD`, and replace or remove the account before production deployment.

## Using The Portal

Program Heads can use the Students page to add and maintain academic student records. The Faculty page lets Program Heads create Faculty accounts and assign a comma-separated list of subjects. Faculty can read and save attendance and grades only for their assigned subjects; unassigned subjects are blocked by the server. Attendance is saved per selected subject and date. Grades are saved per selected subject and term; either Midterm or Final may be left blank.

Students can view only their own records after an account has been provisioned. Program Heads can retrieve the 200 most recent academic changes through `GET /api/audit-logs`; each entry includes the acting user, target record, prior value, submitted change, and timestamp.

## Data Collections

- `users`: Staff credentials, roles, account status, and faculty subject assignments
- `students`: Academic student records
- `student_logins`: Student credentials
- `attendance_logs`: Dated subject attendance entries
- `grade_records`: Subject and term grade entries
- `audit_logs`: Immutable attendance and grade change history

The server automatically migrates legacy credential records out of `students` and legacy academic records from `studentRecords` when it starts.

## Registrar CSV Import

Student import is optional and can be used when a registrar CSV is available. The CSV must include this header:

```csv
studentId,name,email,course,year,status
```

From the backend directory, run:

```powershell
$env:STUDENT_TEMPORARY_PASSWORD = "replace-with-a-temporary-password"
npm run import:students -- "C:\full\path\to\registrar-students.csv"
```

The import upserts academic records in `students`, creates matching logins in `student_logins`, and marks the account to change its temporary password.

## Security Notes

- Use a strong `JWT_SECRET` outside local development.
- Configure `PROGRAM_HEAD_PASSWORD` and `STUDENT_TEMPORARY_PASSWORD` through environment variables.
- Keep credentials, registrar exports, and `.env` files out of version control.
