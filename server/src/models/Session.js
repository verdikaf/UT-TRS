import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema(
  {
    jti: { type: String, required: true, unique: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    lastActivityAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    revoked: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

// TTL index via expiresAt
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session = mongoose.model('Session', sessionSchema);
