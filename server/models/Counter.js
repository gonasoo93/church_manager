const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
    _id: String, // 컬렉션 이름 (예: 'members', 'users')
    seq: { type: Number, default: 0 }
});

module.exports = mongoose.model('Counter', counterSchema);
