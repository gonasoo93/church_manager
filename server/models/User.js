const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    _id: Number, // Auto Increment (직접 관리)
    username: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['super_admin', 'department_admin', 'teacher', 'admin'], // legacy 'admin' included
        default: 'teacher'
    },
    department_id: {
        type: Number,
        ref: 'Department',
        default: null
    },
    assigned_grade: String, // 담당 학년
    assigned_group: String, // 담당 반
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('User', userSchema);
