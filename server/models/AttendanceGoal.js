const mongoose = require('mongoose');

const attendanceGoalSchema = new mongoose.Schema({
    _id: Number,
    department_id: { type: Number, required: true },
    target_rate: { type: Number, required: true, min: 0, max: 100 },
    period: { type: String, enum: ['weekly', 'monthly', 'quarterly'], default: 'monthly' },
    created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AttendanceGoal', attendanceGoalSchema);
