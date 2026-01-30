const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const Worship = require('../models/Worship');
const Counter = require('../models/Counter');

// 모든 라우트에 인증 필요
router.use(authenticateToken);

// 예배 일지 목록 조회
router.get('/', async (req, res) => {
    try {
        let query = {};

        // 검색 조건 (department_id)
        if (req.query.department_id && req.query.department_id !== 'all' && req.query.department_id !== 'undefined') {
            query.department_id = req.query.department_id;
        }

        // 권한 체크: super_admin이 아니면 본인 부서만 조회
        if (req.user.role !== 'super_admin') {
            query.department_id = req.user.department_id;
        }

        const worships = await Worship.find(query).sort({ date: -1 });
        const result = worships.map(w => ({ ...w.toObject(), id: w._id }));
        res.json(result);
    } catch (error) {
        console.error('예배 일지 조회 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 예배 일지 상세 조회
router.get('/:id', async (req, res) => {
    try {
        const worship = await Worship.findById(req.params.id);
        if (!worship) {
            return res.status(404).json({ error: '해당 예배 일지를 찾을 수 없습니다' });
        }

        if (req.user.role !== 'super_admin' && req.user.department_id && worship.department_id !== req.user.department_id) {
            return res.status(403).json({ error: '접근 권한이 없습니다' });
        }

        res.json({ ...worship.toObject(), id: worship._id });
    } catch (error) {
        console.error('예배 일지 상세 조회 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 예배 일지 등록
router.post('/', async (req, res) => {
    try {
        const { date, time, title, preacher, scripture, content, worship_songs, special_events, attendance_count, offering, notes, department_id } = req.body;

        if (!date || !title) {
            return res.status(400).json({ error: '날짜와 제목은 필수입니다' });
        }

        let targetDeptId = department_id;
        if (req.user.role !== 'super_admin') {
            targetDeptId = req.user.department_id;
        }
        if (!targetDeptId) targetDeptId = 3;

        const counter = await Counter.findByIdAndUpdate('worship', { $inc: { seq: 1 } }, { new: true, upsert: true });

        const worship = await Worship.create({
            _id: counter.seq,
            date,
            time,
            title,
            preacher,
            scripture,
            content,
            worship_songs,
            special_events,
            attendance_count: attendance_count || 0,
            offering: offering || 0,
            notes,
            department_id: targetDeptId
        });

        res.status(201).json({
            id: worship._id,
            message: '예배 일지가 등록되었습니다'
        });
    } catch (error) {
        console.error('예배 일지 등록 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 예배 일지 수정
router.put('/:id', async (req, res) => {
    try {
        const worship = await Worship.findById(req.params.id);
        if (!worship) {
            return res.status(404).json({ error: '해당 예배 일지를 찾을 수 없습니다' });
        }

        if (req.user.role !== 'super_admin' && req.user.department_id && worship.department_id !== req.user.department_id) {
            return res.status(403).json({ error: '수정 권한이 없습니다' });
        }

        const { date, time, title, preacher, scripture, content, worship_songs, special_events, attendance_count, offering, notes } = req.body;

        worship.date = date;
        worship.time = time;
        worship.title = title;
        worship.preacher = preacher;
        worship.scripture = scripture;
        worship.content = content;
        worship.worship_songs = worship_songs;
        worship.special_events = special_events;
        worship.attendance_count = attendance_count;
        worship.offering = offering;
        worship.notes = notes;
        worship.updated_at = Date.now();

        await worship.save();

        res.json({ message: '예배 일지가 수정되었습니다' });
    } catch (error) {
        console.error('예배 일지 수정 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 예배 일지 삭제
router.delete('/:id', async (req, res) => {
    try {
        await Worship.findByIdAndDelete(req.params.id);
        res.json({ message: '예배 일지가 삭제되었습니다' });
    } catch (error) {
        console.error('예배 일지 삭제 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

module.exports = router;
