// Script to migrate all documents from the 'subjects' and 'test' collections to 'College_SubjectLists'
// Usage: node migrate_subjects.js

const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/UCC_College_Repository';
const dbName = 'UCC_College_Repository';
const targetCollection = 'College_SubjectLists';

const subjectSchema = new mongoose.Schema({
  course: String,
  year: String,
  semester: String,
  code: String,
  title: String,
  units: String,
}, { strict: false });

async function migrate() {
  await mongoose.connect(uri, { dbName });
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  const sourceNames = collections.map(c => c.name).filter(name => ['subjects', 'test'].includes(name));
  if (sourceNames.length === 0) {
    console.log('No source collections (subjects, test) found.');
    process.exit(0);
  }
  const Target = mongoose.model('TargetSubject', subjectSchema, targetCollection);
  for (const name of sourceNames) {
    const docs = await db.collection(name).find({}).toArray();
    if (docs.length === 0) {
      console.log(`No documents in ${name}`);
      continue;
    }
    // Remove _id to avoid duplicate key errors
    const cleaned = docs.map(d => { const c = { ...d }; delete c._id; return c; });
    const result = await Target.insertMany(cleaned);
    console.log(`Migrated ${result.length} documents from ${name} to ${targetCollection}`);
  }
  await mongoose.disconnect();
  console.log('Migration complete.');
}

migrate().catch(e => { console.error(e); process.exit(1); });
