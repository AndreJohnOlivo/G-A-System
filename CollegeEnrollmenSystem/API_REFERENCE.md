# Complete API Reference - College Enrollment System 2.0

## Base URL
```
http://localhost:5500
```

---

## 📘 Common Query Parameters

### Pagination
```
?page=1          # Page number (default: 1)
?limit=20        # Records per page (default: 20, max: 100)
```

### Sorting
```
?sort=name       # Sort ascending by name
?sort=-name      # Sort descending by name
?sort=course,year # Multiple fields
```

### Field Selection
```
?fields=name,email,course    # Only return these fields
?fields=name,email           # Reduces payload size
```

### Filtering
```
?course=CS              # Filter by course
?enrollmentStatus=active # Filter by status
?status=pending         # Combine with other params
```

---

## 👥 Students API

### List Students
```
GET /api/students
```

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Records per page (default: 20)
- `sort` - Field to sort by
- `fields` - Specific fields to return
- `course` - Filter by course
- `year` - Filter by year
- `enrollmentStatus` - Filter by status (active, inactive, suspended)

**Example:**
```bash
GET /api/students?course=CS&enrollmentStatus=active&sort=-enrollmentDate&page=1&limit=20&fields=name,email,course
```

**Response:**
```json
{
  "data": [
    {
      "name": "John Doe",
      "email": "john@example.com",
      "course": "CS"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

### Get Single Student
```
GET /api/students/:id
```

**Example:**
```bash
GET /api/students/6023f7c7b1e4f2a1c8d9e9f1
```

**Response:**
```json
{
  "_id": "6023f7c7b1e4f2a1c8d9e9f1",
  "name": "John Doe",
  "email": "john@example.com",
  "studentId": "STU-001",
  "course": "CS",
  "year": 2,
  "enrollmentStatus": "active",
  "enrollmentDate": "2023-01-15T00:00:00.000Z",
  "lastModified": "2024-02-22T10:30:00.000Z",
  "createdAt": "2023-01-15T00:00:00.000Z",
  "updatedAt": "2024-02-22T10:30:00.000Z"
}
```

---

### Create Student
```
POST /api/students
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "studentId": "STU-002",
  "course": "CS",
  "year": 1,
  "enrollmentStatus": "active"
}
```

**Response (201 Created):**
```json
{
  "message": "Student added successfully!",
  "student": {
    "_id": "6023f7c7b1e4f2a1c8d9e9f2",
    ...student data...
  }
}
```

---

### Update Student
```
PUT /api/students/:id
Content-Type: application/json
```

**Request Body (any fields):**
```json
{
  "enrollmentStatus": "inactive",
  "year": 2
}
```

**Response:**
```json
{
  "message": "Student updated successfully!",
  "student": {...}
}
```

---

### Delete Student
```
DELETE /api/students/:id
```

**Response (200 OK):**
```json
{
  "message": "Student deleted successfully!",
  "id": "6023f7c7b1e4f2a1c8d9e9f2"
}
```

---

### Search Students
```
GET /api/students/search/:query
```

**Query Parameters:**
- Full-text search across name and other text fields
- `page` - Pagination
- `limit` - Items per page

**Example:**
```bash
GET /api/students/search/john?page=1&limit=20
```

**Response:**
```json
{
  "data": [
    {
      "_id": "...",
      "name": "John Doe",
      ...
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5
  }
}
```

---

## 📚 Subjects API

### List Subjects
```
GET /api/subjects
```

**Query Parameters:**
- `course` - Filter by course
- `year` - Filter by year
- `semester` - Filter by semester
- `sort` - Sort field
- `fields` - Select specific fields
- `page` - Pagination
- `limit` - Records per page

**Example:**
```bash
GET /api/subjects?course=CS&year=1&semester=1&sort=code&limit=50
```

**Response:**
```json
{
  "data": [
    {
      "_id": "...",
      "code": "CS101",
      "title": "Introduction to Programming",
      "course": "CS",
      "year": "1",
      "semester": "1",
      "units": 3,
      "description": "..."
    }
  ],
  "pagination": {...}
}
```

---

### Get Subject
```
GET /api/subjects/:id
```

---

### Create Subject
```
POST /api/subjects
Content-Type: application/json
```

**Request Body:**
```json
{
  "course": "CS",
  "year": "1",
  "semester": "1",
  "code": "CS101",
  "title": "Introduction to Programming",
  "units": 3,
  "description": "Learn programming fundamentals",
  "prerequisites": ["MATH101"]
}
```

---

### Update Subject
```
PUT /api/subjects/:id
```

---

### Delete Subject
```
DELETE /api/subjects/:id
```

---

### Get Curriculum by Course
```
GET /api/subjects/curriculum/:course
```

**Example:**
```bash
GET /api/subjects/curriculum/CS
```

**Response:**
```json
{
  "course": "CS",
  "curriculum": [
    {
      "_id": {
        "year": "1",
        "semester": "1"
      },
      "subjects": [
        {
          "code": "CS101",
          "title": "Programming",
          "units": 3
        },
        ...
      ],
      "totalUnits": 24
    },
    {
      "_id": {
        "year": "1",
        "semester": "2"
      },
      "subjects": [...],
      "totalUnits": 22
    }
  ]
}
```

---

### Search Subjects
```
GET /api/subjects/search/:query
```

**Example:**
```bash
GET /api/subjects/search/database?page=1&limit=20
```

---

## 📄 Requirements/Documents API

### List Requirements
```
GET /api/requirements
```

**Query Parameters:**
- `studentId` - Filter by student
- `status` - Filter by status (pending, verified, rejected)
- `docType` - Filter by type (certificate, transcript, document, other)
- `page` - Pagination
- `limit` - Records per page

**Example:**
```bash
GET /api/requirements?status=pending&page=1&limit=20
```

---

### Get Single Requirement
```
GET /api/requirements/:id
```

---

### Upload Files
```
POST /api/upload
Content-Type: multipart/form-data
```

**Form Data:**
- `file` - One or more files to upload
- `studentId` - Associated student ID (optional)
- `docType` - Document type (certificate, transcript, document, other)

**Example:**
```bash
curl -X POST http://localhost:5500/api/upload \
  -F "file=@certificate.pdf" \
  -F "file=@transcript.pdf" \
  -F "studentId=6023f7c7b1e4f2a1c8d9e9f1" \
  -F "docType=certificate"
```

**Response:**
```json
{
  "message": "Files uploaded successfully!",
  "count": 2,
  "requirements": [...]
}
```

---

### Get Image/File
```
GET /api/image/:filename
```

**Example:**
```bash
GET /api/image/1708618200000-certificate.pdf
```

---

### Update Requirement
```
PUT /api/requirements/:id
```

**Request Body:**
```json
{
  "status": "verified"
}
```

---

### Delete Requirement
```
DELETE /api/requirements/:id
```

---

## 📊 Activity Log API

### List Activity Logs
```
GET /api/activity
```

**Query Parameters:**
- `type` - Filter by type (create, update, delete, login, error, system)
- `resourceType` - Filter by resource (student, subject, requirement, user, system)
- `userId` - Filter by user
- `sort` - Sort field
- `page` - Pagination
- `limit` - Records per page

**Example:**
```bash
GET /api/activity?type=create&resourceType=student&sort=-timestamp&page=1&limit=20
```

**Response:**
```json
{
  "data": [
    {
      "_id": "...",
      "message": "Student John Doe registered",
      "type": "create",
      "resourceType": "student",
      "resourceId": "6023f7c7b1e4f2a1c8d9e9f1",
      "userId": null,
      "metadata": {},
      "timestamp": "2024-02-22T10:30:00.000Z"
    }
  ],
  "pagination": {...}
}
```

---

### Get Activity Statistics
```
GET /api/activity/stats
```

**Response:**
```json
{
  "lastSevenDays": [
    { "_id": "create", "count": 45 },
    { "_id": "update", "count": 23 },
    { "_id": "delete", "count": 8 }
  ],
  "timestamp": "2024-02-22T10:30:00.000Z"
}
```

---

## 📈 Statistics API

### Get Database Statistics
```
GET /api/stats/database
```

**Response:**
```json
{
  "students": {
    "documentCount": 1250,
    "avgDocSize": 450,
    "totalSize": 562500,
    "indexSizes": {
      "_id_": 8200,
      "name_1": 12400,
      "email_1": 11800,
      ...
    }
  },
  "subjects": {
    ...similar fields...
  },
  "requirements": {
    ...similar fields...
  }
}
```

---

## 🏥 Health Check API

### Server Health
```
GET /api/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-02-22T10:30:00.000Z"
}
```

---

## 🔴 Error Responses

### Validation Error (400)
```json
{
  "error": "Validation error",
  "details": [
    "Email is required",
    "Course must be a string"
  ]
}
```

### Duplicate Entry (409)
```json
{
  "error": "Duplicate entry: email already exists"
}
```

### Not Found (404)
```json
{
  "error": "Student not found"
}
```

### Invalid ID Format (400)
```json
{
  "error": "Invalid ID format"
}
```

### Server Error (500)
```json
{
  "error": "Internal server error"
}
```

---

## 🎯 Common Use Cases

### Get CS Students, 2nd Year, Paginated
```bash
curl "http://localhost:5500/api/students?course=CS&year=2&page=1&limit=50"
```

### Get Curriculum for Computer Science
```bash
curl "http://localhost:5500/api/subjects/curriculum/CS"
```

### Find Pending Document Verifications
```bash
curl "http://localhost:5500/api/requirements?status=pending&sort=-uploadedAt"
```

### Monitor System Activity (Last 24 hours)
```bash
curl "http://localhost:5500/api/activity?resourceType=system&sort=-timestamp"
```

### Search for a Specific Student
```bash
curl "http://localhost:5500/api/students/search/john%20doe"
```

### Get Database Performance Info
```bash
curl "http://localhost:5500/api/stats/database"
```

---

## 🔐 Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success - GET/PUT/DELETE |
| 201 | Created - POST success |
| 400 | Bad Request - Invalid parameters |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Duplicate entry |
| 500 | Server Error - Contact admin |

---

## 📝 Field Enums

### Enrollment Status
- `active`
- `inactive`
- `suspended`

### User Roles
- `staff`
- `admin`
- `registrar`
- `student`

### Document Types
- `certificate`
- `transcript`
- `document`
- `other`

### Requirement Status
- `pending`
- `verified`
- `rejected`

### Activity Types
- `create`
- `update`
- `delete`
- `login`
- `error`
- `system`

### Resource Types
- `student`
- `subject`
- `requirement`
- `user`
- `system`

---

**API Version:** 2.0  
**Last Updated:** February 2026  
**Status:** Production Ready
