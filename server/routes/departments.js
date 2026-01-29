const express = require('express');
const router = express.Router();
const Department = require('../models/Department');

// 부서 목록 조회
router.get('/', async (req, res) => {
    try {
        const departments = await Department.find().sort({ _id: 1 });
        res.json(departments);
    } catch (error) {
        console.error('부서 목록 조회 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

module.exports = router;
