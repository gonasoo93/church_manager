const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
    _id: Number,
    department_id: { type: Number, required: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['cell', 'class', 'team'], default: 'cell' },
    leader_id: { type: Number, ref: 'User' },
    created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Group', groupSchema);
