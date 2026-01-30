const mongoose = require('mongoose');

const eventParticipantSchema = new mongoose.Schema({
    event_id: { type: Number, ref: 'Event', required: true },
    member_id: { type: Number, ref: 'Member', required: true },
    status: { type: String, enum: ['registered', 'attended', 'absent'], default: 'registered' },
    registered_at: { type: Date, default: Date.now }
});

eventParticipantSchema.index({ event_id: 1, member_id: 1 }, { unique: true });

module.exports = mongoose.model('EventParticipant', eventParticipantSchema);
