const mongoose = require('mongoose');

const visitSchema = new mongoose.Schema({
    _id: Number,
    member_id: { type: Number, ref: 'Member', required: true },
    teacher_id: { type: Number, ref: 'User' },
    department_id: { type: Number, ref: 'Department' },
    date: { type: String, required: true },
    type: String, // 심방, 전화, 문자 등
    content: String,
    next_visit_date: { type: String },
    template_id: { type: Number },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('Visit', visitSchema);
