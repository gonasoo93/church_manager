const mongoose = require('mongoose');

const visitTemplateSchema = new mongoose.Schema({
    _id: Number,
    user_id: { type: Number, ref: 'User', required: true },
    department_id: { type: Number, required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    category: { type: String, enum: ['전화', '방문', '문자', '기타'], default: '전화' },
    created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('VisitTemplate', visitTemplateSchema);
