const mongoose = require('mongoose');

const worshipSchema = new mongoose.Schema({
    _id: Number,
    date: { type: String, required: true },
    time: String,
    title: { type: String, required: true }, // 설교 제목
    scripture: String, // 본문 말씀
    preacher: String,
    content: String,
    worship_songs: String,
    special_events: String,
    attendance_count: { type: Number, default: 0 },
    offering: { type: Number, default: 0 },
    notes: String,
    department_id: { type: Number, ref: 'Department', default: 3 },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
}, { _id: false });

module.exports = mongoose.model('Worship', worshipSchema);
