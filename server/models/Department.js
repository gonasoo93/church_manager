const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
    _id: Number, // 기존 ID 체계 유지 (1, 2, 3...)
    name: {
        type: String,
        required: true
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('Department', departmentSchema);
