const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    _id: Number,
    member_id: { type: Number, ref: 'Member', required: true },
    department_id: { type: Number, ref: 'Department' },
    date: { type: String, required: true }, // YYYY-MM-DD
    status: { type: String, enum: ['present', 'late', 'absent'], required: true },
    notes: String,
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// 복합 인덱스 (날짜 + 멤버) -> 중복 방지? 기존 upsert 로직 지원
attendanceSchema.index({ date: 1, member_id: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
