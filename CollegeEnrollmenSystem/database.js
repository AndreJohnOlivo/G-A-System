/**
 * Database Schemas and Connection Management
 * Unified Mongoose schemas with optimized indexes and methods
 */

const mongoose = require('mongoose');

// ============================================================================
// STUDENT SCHEMA
// ============================================================================
const studentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      index: true,
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      default: null
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      index: true,
      match: [/.+@.+\..+/, 'Please provide a valid email address'],
      default: null
    },
    studentId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      trim: true
    },
    course: {
      type: String,
      index: true,
      trim: true
    },
    year: {
      type: Number,
      index: true
    },
    enrollmentStatus: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active',
      index: true
    },
    enrollmentDate: {
      type: Date,
      default: Date.now,
      index: true
    },
    lastModified: {
      type: Date,
      default: Date.now
    }
  },
  {
    collection: 'Collge_Student_Repository',
    timestamps: true
  }
);

// Compound indexes for common queries
studentSchema.index({ course: 1, year: 1, enrollmentStatus: 1 });
studentSchema.index({ enrollmentDate: -1 });

studentSchema.pre('findOneAndUpdate', function () {
  this.set({ lastModified: new Date() });
});

const Student = mongoose.models.Student || mongoose.model('Student', studentSchema);

// ============================================================================
// REQUIREMENTS SCHEMA
// ============================================================================
const requirementsSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      index: true
    },
    filename: {
      type: String,
      required: true,
      index: true
    },
    fileId: {
      type: String,
      required: true,
      unique: true,
      sparse: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    description: {
      type: String,
      trim: true
    },
    docType: {
      type: String,
      enum: ['certificate', 'transcript', 'document', 'other'],
      index: true
    },
    status: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
      index: true
    }
  },
  {
    collection: 'UCC_Requirements_Repository',
    timestamps: true
  }
);

// Compound index for common queries
requirementsSchema.index({ studentId: 1, status: 1 });
requirementsSchema.index({ uploadedAt: -1 });

const Requirement = mongoose.models.Requirement || mongoose.model('Requirement', requirementsSchema);

// ============================================================================
// SUBJECT SCHEMA
// ============================================================================
const subjectSchema = new mongoose.Schema(
  {
    course: {
      type: String,
      required: true,
      index: true,
      trim: true
    },
    year: {
      type: String,
      required: true,
      index: true
    },
    semester: {
      type: String,
      required: true,
      enum: ['1', '2', '3'],
      index: true
    },
    code: {
      type: String,
      required: true,
      unique: true,
      sparse: true,
      index: true,
      trim: true,
      uppercase: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    units: {
      type: Number,
      required: true,
      min: 0
    },
    description: {
      type: String,
      trim: true
    },
    prerequisites: [{
      type: String,
      trim: true
    }],
    createdAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    collection: 'College_SubjectLists',
    timestamps: true
  }
);

// Compound indexes for course curriculum queries
subjectSchema.index({ course: 1, year: 1, semester: 1 });
subjectSchema.index({ code: 1, course: 1 });

const Subject = mongoose.models.Subject || mongoose.model('Subject', subjectSchema);

// ============================================================================
// USER SCHEMA
// ============================================================================
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
      index: true,
      minlength: 3
    },
    password: {
      type: String,
      required: true
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      index: true
    },
    role: {
      type: String,
      enum: ['staff', 'admin', 'registrar', 'student'],
      default: 'staff',
      index: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    lastLogin: {
      type: Date
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    collection: 'users',
    timestamps: true
  }
);

const User = mongoose.models.User || mongoose.model('User', userSchema);

// ============================================================================
// ACTIVITY LOG SCHEMA (Replaces in-memory log)
// ============================================================================
const activityLogSchema = new mongoose.Schema(
  {
    message: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['create', 'update', 'delete', 'login', 'error', 'system'],
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resourceType: {
      type: String,
      enum: ['student', 'subject', 'requirement', 'user', 'system'],
      index: true
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
      expires: 2592000 // Auto-delete after 30 days
    }
  },
  {
    collection: 'activity_logs'
  }
);

// Compound index for efficient activity log queries
activityLogSchema.index({ timestamp: -1, resourceType: 1 });
activityLogSchema.index({ userId: 1, timestamp: -1 });

const ActivityLog = mongoose.models.ActivityLog || mongoose.model('ActivityLog', activityLogSchema);

// ============================================================================
// DATABASE CONNECTION & INITIALIZATION
// ============================================================================
async function connectDatabase() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/UCC_College_Repository';
    
    if (!uri.startsWith('mongodb')) {
      console.error('Invalid or undefined MongoDB URI. Please check your .env file.');
      process.exit(1);
    }

    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      minPoolSize: 2,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 5000,
    });

    console.log('✅ Connected to MongoDB successfully');
    
    // Create indexes
    await createIndexes();
    
    return {
      Student,
      Requirement,
      Subject,
      User,
      ActivityLog,
      connection: mongoose.connection
    };
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    process.exit(1);
  }
}

/**
 * Create all database indexes
 */
async function createIndexes() {
  try {
    await Student.collection.createIndex({ name: 'text' });
    await Subject.collection.createIndex({ title: 'text', code: 'text' });
    console.log('✅ Indexes created successfully');
  } catch (error) {
    console.error('⚠️  Warning: Error creating text indexes:', error.message);
  }
}

/**
 * Gracefully close database connection
 */
async function disconnectDatabase() {
  try {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error disconnecting from MongoDB:', error.message);
  }
}

module.exports = {
  connectDatabase,
  disconnectDatabase,
  Student,
  Requirement,
  Subject,
  User,
  ActivityLog
};
