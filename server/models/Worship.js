const mongoose = require('mongoose');

const worshipSchema = new mongoose.Schema({
    _id: Number,
    date: { type: String, required: true },
    title: String,
    preacher: String,
    notes: String,
    attendance_count: { type: Number, default: 0 },
    offering: { type: Number, default: 0 },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('Worship', worshipSchema);
