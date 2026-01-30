const mongoose = require('mongoose');

const memberGroupSchema = new mongoose.Schema({
    member_id: { type: Number, ref: 'Member', required: true },
    group_id: { type: Number, ref: 'Group', required: true },
    joined_at: { type: Date, default: Date.now }
});

memberGroupSchema.index({ member_id: 1, group_id: 1 }, { unique: true });

module.exports = mongoose.model('MemberGroup', memberGroupSchema);
