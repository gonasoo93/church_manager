const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    _id: Number,
    department_id: { type: Number, required: true },
    title: { type: String, required: true },
    description: String,
    event_date: { type: String, required: true },
    location: String,
    max_participants: Number,
    created_by: { type: Number, ref: 'User' },
    created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Event', eventSchema);
