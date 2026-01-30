const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
    _id: Number,
    department_id: { type: Number, required: true },
    author_id: { type: Number, ref: 'User', required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    priority: { type: String, enum: ['normal', 'important', 'urgent'], default: 'normal' },
    pinned: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Announcement', announcementSchema);
