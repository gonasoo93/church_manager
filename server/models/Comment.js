const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
    _id: Number,
    target_type: { type: String, enum: ['announcement', 'meeting', 'worship'], required: true },
    target_id: { type: Number, required: true },
    user_id: { type: Number, ref: 'User', required: true },
    content: { type: String, required: true },
    created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Comment', commentSchema);
