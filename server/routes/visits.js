const express = require('express');
const router = express.Router();
const { authenticateToken, requireTeacher } = require('../middleware/auth');
const Visit = require('../models/Visit');
const Member = require('../models/Member');
const User = require('../models/User');
const Counter = require('../models/Counter');

// 심방 기록 CRUD

// 목록 조회
router.get('/', authenticateToken, requireTeacher, async (req, res) => {
    try {
        const { member_id, department_id } = req.query;
        let query = {};

        // 부서 및 권한 필터링
        if (member_id) {
            const memId = parseInt(member_id);
            const member = await Member.findById(memId);
            if (!member) return res.status(404).json({ error: '학생을 찾을 수 없습니다' });

            if (req.user.role !== 'super_admin' && req.user.department_id && member.department_id !== req.user.department_id) {
                return res.status(403).json({ error: '타 부서 학생의 기록은 볼 수 없습니다' });
            }
            query.member_id = memId;
        } else {
            // 전체/부서별 목록 조회
            if (req.user.role !== 'super_admin') {
                // 내 부서 학생만
                const myMembers = await Member.find({ department_id: req.user.department_id }).select('_id');
                const memberIds = myMembers.map(m => m._id);
                query.member_id = { $in: memberIds };
            } else if (department_id && department_id !== 'all') {
                const deptMembers = await Member.find({ department_id: parseInt(department_id) }).select('_id');
                const memberIds = deptMembers.map(m => m._id);
                query.member_id = { $in: memberIds };
            }
        }

        const visits = await Visit.find(query)
            .sort({ date: -1 })
            .populate('member_id', 'name')
            .populate('teacher_id', 'name');

        const result = visits.map(v => {
            const doc = v.toObject();
            return {
                ...doc,
                id: doc._id,
                member_name: doc.member_id ? doc.member_id.name : '알 수 없음',
                teacher_name: doc.teacher_id ? doc.teacher_id.name : '알 수 없음'
            };
        });

        res.json(result);
    } catch (error) {
        console.error('심방 기록 조회 오류:', error);
        res.status(500).json({ error: '서버 오류' });
    }
});

// 기록 등록
router.post('/', authenticateToken, requireTeacher, async (req, res) => {
    try {
        const { member_id, date, type, content } = req.body;

        if (!member_id || !date || !content) {
            return res.status(400).json({ error: '필수 항목이 누락되었습니다' });
        }

        const member = await Member.findById(member_id);
        if (!member) return res.status(404).json({ error: '학생을 찾을 수 없습니다' });

        if (req.user.role !== 'super_admin' && req.user.department_id && member.department_id !== req.user.department_id) {
            return res.status(403).json({ error: '타 부서 학생에게 기록할 수 없습니다' });
        }

        const counter = await Counter.findByIdAndUpdate('visits', { $inc: { seq: 1 } }, { new: true, upsert: true });

        const visit = await Visit.create({
            _id: counter.seq,
            member_id,
            teacher_id: req.user.id,
            department_id: member.department_id, // 저장 시 부서 ID도 함께 저장
            date,
            type: type || '심방',
            content
        });

        res.status(201).json({ ...visit.toObject(), id: visit._id });
    } catch (error) {
        console.error('심방 기록 등록 오류:', error);
        res.status(500).json({ error: '서버 오류' });
    }
});

// 기록 수정
router.put('/:id', authenticateToken, requireTeacher, async (req, res) => {
    try {
        const { date, type, content } = req.body;
        const visit = await Visit.findById(req.params.id);

        if (!visit) return res.status(404).json({ error: '기록을 찾을 수 없습니다' });

        // 권한 체크
        const isAuthor = visit.teacher_id === req.user.id;
        const isSuper = req.user.role === 'super_admin';

        let isDeptAdmin = false;
        if (req.user.role === 'department_admin') {
            const member = await Member.findById(visit.member_id);
            if (member && member.department_id === req.user.department_id) {
                isDeptAdmin = true;
            }
        }

        if (!isAuthor && !isSuper && !isDeptAdmin) {
            return res.status(403).json({ error: '수정 권한이 없습니다' });
        }

        visit.date = date;
        visit.type = type;
        visit.content = content;
        await visit.save();

        res.json({ ...visit.toObject(), id: visit._id });
    } catch (error) {
        console.error('심방 기록 수정 오류:', error);
        res.status(500).json({ error: '서버 오류' });
    }
});

// 기록 삭제
router.delete('/:id', authenticateToken, requireTeacher, async (req, res) => {
    try {
        const visit = await Visit.findById(req.params.id);
        if (!visit) return res.status(404).json({ error: '기록을 찾을 수 없습니다' });

        const isAuthor = visit.teacher_id === req.user.id;
        const isSuper = req.user.role === 'super_admin';

        let isDeptAdmin = false;
        if (req.user.role === 'department_admin') {
            const member = await Member.findById(visit.member_id);
            if (member && member.department_id === req.user.department_id) {
                isDeptAdmin = true;
            }
        }

        if (!isAuthor && !isSuper && !isDeptAdmin) {
            return res.status(403).json({ error: '삭제 권한이 없습니다' });
        }

        await Visit.findByIdAndDelete(req.params.id);
        res.json({ message: '기록이 삭제되었습니다' });
    } catch (error) {
        console.error('심방 기록 삭제 오류:', error);
        res.status(500).json({ error: '서버 오류' });
    }
});

module.exports = router;
