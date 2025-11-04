import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    deadline: { type: Date, required: true },
    endDate: { type: Date },
    reminderType: { type: String, enum: ['once', 'weekly'], default: 'once' },
    reminderOffset: { type: String, enum: ['3d', '1d', '3h'], required: true },
    status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
    jobId: { type: String },
    lastSentAt: { type: Date },
  },
  { timestamps: true }
);

export const Task = mongoose.model('Task', taskSchema);
