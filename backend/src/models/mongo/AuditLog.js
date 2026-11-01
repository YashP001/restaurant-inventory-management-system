import mongoose from 'mongoose';

/**
 * MongoDB Atlas AuditLog Schema
 * Dedicated strictly to non-relational append-only compliance audit trails,
 * administrative event tracking, and operational telemetry.
 * 
 * SECURITY RULE:
 * Absolutely NO passwords, JWT tokens, credit card numbers, or database credentials
 * may be recorded in this collection.
 */
const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: Number,
      required: false,
      index: true,
      default: null
    },
    username: {
      type: String,
      required: false,
      index: true,
      default: null,
      trim: true
    },
    action: {
      type: String,
      required: true,
      index: true,
      uppercase: true,
      trim: true,
      // Examples: 'CREATE_ORDER', 'PROCESS_FEFO_ORDER', 'LOG_WASTE', 'CREATE_BATCH', 'UPDATE_PAR_LEVEL', 'USER_LOGIN'
    },
    resourceType: {
      type: String,
      required: true,
      index: true,
      uppercase: true,
      trim: true,
      // Examples: 'ORDER', 'INVENTORY_BATCH', 'WASTE_RECORD', 'MENU_ITEM', 'SUPPLIER_PO', 'AUTH'
    },
    resourceId: {
      type: String,
      required: false,
      default: null,
      index: true
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    },
    requestId: {
      type: String,
      required: false,
      default: null
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      // Sanitizer hook: strip any accidental credentials before saving
      set: function (meta) {
        if (!meta || typeof meta !== 'object') return meta;
        const sanitized = { ...meta };
        const sensitiveKeys = ['password', 'password_hash', 'token', 'jwt', 'secret', 'cardNumber', 'cvv'];
        sensitiveKeys.forEach(key => delete sanitized[key]);
        return sanitized;
      }
    }
  },
  {
    timestamps: true,
    collection: 'audit_logs'
  }
);

// Compound index for chronological querying by resource type
auditLogSchema.index({ resourceType: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });

/**
 * Static convenience method to asynchronously record an audit event without throwing
 * @param {object} params
 * @returns {Promise<AuditLog|null>}
 */
auditLogSchema.statics.record = async function ({
  userId = null,
  username = null,
  action,
  resourceType,
  resourceId = null,
  requestId = null,
  metadata = {}
}) {
  try {
    return await this.create({
      userId,
      username,
      action,
      resourceType,
      resourceId: resourceId !== null ? String(resourceId) : null,
      requestId,
      metadata
    });
  } catch (err) {
    console.warn(`[AuditLog] Warning: Failed to record audit log (${action}):`, err.message);
    return null;
  }
};

export const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
