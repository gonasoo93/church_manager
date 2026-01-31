const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
    _id: Number,
    name: { type: String, required: true },
    birth_date: String,
    phone: String,
    parent_phone: String,
    grade: String, // 학년
    group: String, // 반
    department_id: { type: Number, ref: 'Department', required: true },
    department: String, // 부서명 (옵션)
    teacher_id: { type: Number, ref: 'User' }, // 담당 교사
    status: { type: String, default: 'active' }, // active, inactive, long_term_absent
    address: String,
    notes: String,
    profile_photo: String, // 프로필 사진 경로
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('Member', memberSchema);
