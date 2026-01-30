const mongoose = require('mongoose');

const memberTagSchema = new mongoose.Schema({
    member_id: { type: Number, ref: 'Member', required: true },
    tag_id: { type: Number, ref: 'Tag', required: true }
});

memberTagSchema.index({ member_id: 1, tag_id: 1 }, { unique: true });

module.exports = mongoose.model('MemberTag', memberTagSchema);
