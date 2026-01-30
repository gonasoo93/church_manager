const mongoose = require('mongoose');

const tagSchema = new mongoose.Schema({
    _id: Number,
    name: { type: String, required: true },
    color: { type: String, default: '#667eea' },
    department_id: { type: Number, required: true },
    created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Tag', tagSchema);
