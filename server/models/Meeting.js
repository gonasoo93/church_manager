const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
    _id: Number, // Auto Increment
    title: { type: String, required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    time: String,
    attendees: String,
    content: String,
    decisions: String,
    next_meeting: String,
    department_id: { type: Number, ref: 'Department', default: 3 },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
}, { _id: false });

module.exports = mongoose.model('Meeting', meetingSchema);
