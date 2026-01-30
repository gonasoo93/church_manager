const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const Member = require('../models/Member');
const User = require('../models/User');
const Visit = require('../models/Visit');
const Meeting = require('../models/Meeting');
const Worship = require('../models/Worship');

router.use(authenticateToken);

// 통합 검색
router.get('/', async (req, res) => {
    try {
        const { q, type } = req.query;

        if (!q || q.trim().length < 2) {
            return res.json({ members: [], users: [], visits: [], meetings: [], worship: [] });
        }

        const query = q.trim();
        const results = {};

        // 부서 필터
        let deptFilter = {};
        if (req.user.role !== 'super_admin' && req.user.department_id) {
            deptFilter.department_id = req.user.department_id;
        }

        // 학생 검색
        if (!type || type === 'members') {
            const members = await Member.find({
                ...deptFilter,
                $or: [
                    { name: { $regex: query, $options: 'i' } },
                    { phone: { $regex: query, $options: 'i' } },
                    { parent_phone: { $regex: query, $options: 'i' } }
                ]
            }).limit(10);
            results.members = members.map(m => ({ ...m.toObject(), id: m._id }));
        }

        // 교사 검색
        if (!type || type === 'users') {
            const users = await User.find({
                ...deptFilter,
                name: { $regex: query, $options: 'i' }
            }).limit(10);
            results.users = users.map(u => ({ ...u.toObject(), id: u._id }));
        }

        // 심방 기록 검색
        if (!type || type === 'visits') {
            const visits = await Visit.find({
                ...deptFilter,
                content: { $regex: query, $options: 'i' }
            })
                .populate('member_id', 'name')
                .limit(10);
            results.visits = visits.map(v => ({
                ...v.toObject(),
                id: v._id,
                member_name: v.member_id ? v.member_id.name : '알 수 없음'
            }));
        }

        // 회의록 검색
        if (!type || type === 'meetings') {
            const meetings = await Meeting.find({
                ...deptFilter,
                $or: [
                    { title: { $regex: query, $options: 'i' } },
                    { content: { $regex: query, $options: 'i' } }
                ]
            }).limit(10);
            results.meetings = meetings.map(m => ({ ...m.toObject(), id: m._id }));
        }

        // 예배 기록 검색
        if (!type || type === 'worship') {
            const worship = await Worship.find({
                ...deptFilter,
                $or: [
                    { sermon_title: { $regex: query, $options: 'i' } },
                    { sermon_text: { $regex: query, $options: 'i' } },
                    { notes: { $regex: query, $options: 'i' } }
                ]
            }).limit(10);
            results.worship = worship.map(w => ({ ...w.toObject(), id: w._id }));
        }

        res.json(results);
    } catch (error) {
        console.error('검색 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

module.exports = router;
