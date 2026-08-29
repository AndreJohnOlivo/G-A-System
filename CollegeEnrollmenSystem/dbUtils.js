/**
 * Database Utility Functions for Optimized Queries
 */

const { ActivityLog } = require('./database');

/**
 * Log activity to database
 */
async function logActivity(message, type = 'system', options = {}) {
  try {
    const { userId, resourceType, resourceId, metadata } = options;
    
    await ActivityLog.create({
      message,
      type,
      userId,
      resourceType,
      resourceId,
      metadata: metadata || {},
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error logging activity:', error.message);
  }
}

/**
 * Fetch with pagination, sorting, and field selection
 */
async function findWithPagination(Model, filter = {}, options = {}) {
  const {
    page = 1,
    limit = 20,
    sort = { _id: -1 },
    projection = {},
    populate = null
  } = options;

  const skip = (page - 1) * limit;

  try {
    let query = Model.find(filter, projection);

    if (populate) {
      if (Array.isArray(populate)) {
        populate.forEach(p => query = query.populate(p));
      } else {
        query = query.populate(populate);
      }
    }

    const data = await query
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .exec();

    const total = await Model.countDocuments(filter);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
      }
    };
  } catch (error) {
    throw new Error(`Error fetching ${Model.collection.name}: ${error.message}`);
  }
}

/**
 * Fetch single document by ID with optional population
 */
async function findById(Model, id, populate = null) {
  try {
    let query = Model.findById(id);
    
    if (populate) {
      if (Array.isArray(populate)) {
        populate.forEach(p => query = query.populate(p));
      } else {
        query = query.populate(populate);
      }
    }
    
    return await query.exec();
  } catch (error) {
    throw new Error(`Error finding document: ${error.message}`);
  }
}

/**
 * Create document with activity logging
 */
async function createWithLog(Model, data, userId = null) {
  try {
    const doc = await Model.create(data);
    
    await logActivity(
      `${Model.collection.name.replace('_', ' ')} created`,
      'create',
      {
        userId,
        resourceType: Model.collection.name,
        resourceId: doc._id,
        metadata: { documentName: data.name || data.code || data.username }
      }
    );

    return doc;
  } catch (error) {
    throw new Error(`Error creating document: ${error.message}`);
  }
}

/**
 * Update document with activity logging
 */
async function updateWithLog(Model, id, updateData, userId = null) {
  try {
    const doc = await Model.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!doc) {
      throw new Error('Document not found');
    }

    await logActivity(
      `${Model.collection.name.replace('_', ' ')} updated`,
      'update',
      {
        userId,
        resourceType: Model.collection.name,
        resourceId: doc._id,
        metadata: { changedFields: Object.keys(updateData) }
      }
    );

    return doc;
  } catch (error) {
    throw new Error(`Error updating document: ${error.message}`);
  }
}

/**
 * Delete document with activity logging
 */
async function deleteWithLog(Model, id, userId = null) {
  try {
    const doc = await Model.findByIdAndDelete(id);

    if (!doc) {
      throw new Error('Document not found');
    }

    await logActivity(
      `${Model.collection.name.replace('_', ' ')} deleted`,
      'delete',
      {
        userId,
        resourceType: Model.collection.name,
        resourceId: id,
        metadata: { deletedDocument: doc.toObject ? doc.toObject() : doc }
      }
    );

    return doc;
  } catch (error) {
    throw new Error(`Error deleting document: ${error.message}`);
  }
}

/**
 * Bulk insert with error handling
 */
async function bulkInsert(Model, data) {
  try {
    const result = await Model.insertMany(data, { ordered: false });
    await logActivity(
      `Bulk insert: ${result.length} documents`,
      'create',
      { resourceType: Model.collection.name, metadata: { count: result.length } }
    );
    return result;
  } catch (error) {
    throw new Error(`Error in bulk insert: ${error.message}`);
  }
}

/**
 * Aggregation pipeline helper
 */
async function aggregate(Model, pipeline) {
  try {
    return await Model.aggregate(pipeline).exec();
  } catch (error) {
    throw new Error(`Error in aggregation: ${error.message}`);
  }
}

/**
 * Get collection statistics
 */
async function getStats(Model) {
  try {
    const count = await Model.countDocuments();
    const stats = await Model.collection.stats();
    
    return {
      documentCount: count,
      avgDocSize: stats.avgObjSize,
      totalSize: stats.size,
      indexSizes: stats.indexSizes
    };
  } catch (error) {
    throw new Error(`Error getting statistics: ${error.message}`);
  }
}

/**
 * Text search with relevance scoring
 */
async function textSearch(Model, query, filter = {}, options = {}) {
  const { limit = 20, skip = 0 } = options;

  try {
    const results = await Model.find(
      { ...filter, $text: { $search: query } },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .skip(skip)
      .limit(limit)
      .exec();

    return results;
  } catch (error) {
    throw new Error(`Error in text search: ${error.message}`);
  }
}

/**
 * Efficient count with filter
 */
async function countDocuments(Model, filter = {}) {
  try {
    return await Model.countDocuments(filter);
  } catch (error) {
    throw new Error(`Error counting documents: ${error.message}`);
  }
}

module.exports = {
  logActivity,
  findWithPagination,
  findById,
  createWithLog,
  updateWithLog,
  deleteWithLog,
  bulkInsert,
  aggregate,
  getStats,
  textSearch,
  countDocuments
};
