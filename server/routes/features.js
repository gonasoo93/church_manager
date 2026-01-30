const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const Group = require('../models/Group');
const MemberGroup = require('../models/MemberGroup');
const Tag = require('../models/Tag');
const MemberTag = require('../models/MemberTag');
const Event = require('../models/Event');
const EventParticipant = require('../models/EventParticipant');
const Counter = require('../models/Counter');

router.use(authenticateToken);

// ===== 그룹 관리 =====

// 그룹 조회
router.get('/groups', async (req, res) => {
    try {
        let query = {};
        if (req.user.role !== 'super_admin' && req.user.department_id) {
            query.department_id = req.user.department_id;
        }

        const groups = await Group.find(query).populate('leader_id', 'name');
        res.json(groups.map(g => ({
            ...g.toObject(),
            id: g._id,
            leader_name: g.leader_id ? g.leader_id.name : null
        })));
    } catch (error) {
        console.error('그룹 조회 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 그룹 생성
router.post('/groups', async (req, res) => {
    try {
        const { name, type, leader_id } = req.body;
        const counter = await Counter.findByIdAndUpdate('groups', { $inc: { seq: 1 } }, { new: true, upsert: true });

        const group = await Group.create({
            _id: counter.seq,
            department_id: req.user.department_id,
            name,
            type,
            leader_id: leader_id || null
        });

        res.json({ ...group.toObject(), id: group._id });
    } catch (error) {
        console.error('그룹 생성 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 그룹 삭제
router.delete('/groups/:id', async (req, res) => {
    try {
        await Group.findByIdAndDelete(req.params.id);
        await MemberGroup.deleteMany({ group_id: parseInt(req.params.id) });
        res.json({ message: '그룹이 삭제되었습니다' });
    } catch (error) {
        console.error('그룹 삭제 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 그룹 멤버 추가
router.post('/groups/:id/members', async (req, res) => {
    try {
        const { member_id } = req.body;
        await MemberGroup.create({
            group_id: parseInt(req.params.id),
            member_id: parseInt(member_id)
        });
        res.json({ message: '멤버가 추가되었습니다' });
    } catch (error) {
        console.error('그룹 멤버 추가 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 그룹 멤버 제거
router.delete('/groups/:groupId/members/:memberId', async (req, res) => {
    try {
        await MemberGroup.deleteOne({
            group_id: parseInt(req.params.groupId),
            member_id: parseInt(req.params.memberId)
        });
        res.json({ message: '멤버가 제거되었습니다' });
    } catch (error) {
        console.error('그룹 멤버 제거 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// ===== 태그 관리 =====

// 태그 조회
router.get('/tags', async (req, res) => {
    try {
        let query = {};
        if (req.user.role !== 'super_admin' && req.user.department_id) {
            query.department_id = req.user.department_id;
        }

        const tags = await Tag.find(query);
        res.json(tags.map(t => ({ ...t.toObject(), id: t._id })));
    } catch (error) {
        console.error('태그 조회 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 태그 생성
router.post('/tags', async (req, res) => {
    try {
        const { name, color } = req.body;
        const counter = await Counter.findByIdAndUpdate('tags', { $inc: { seq: 1 } }, { new: true, upsert: true });

        const tag = await Tag.create({
            _id: counter.seq,
            name,
            color: color || '#667eea',
            department_id: req.user.department_id
        });

        res.json({ ...tag.toObject(), id: tag._id });
    } catch (error) {
        console.error('태그 생성 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 태그 삭제
router.delete('/tags/:id', async (req, res) => {
    try {
        await Tag.findByIdAndDelete(req.params.id);
        await MemberTag.deleteMany({ tag_id: parseInt(req.params.id) });
        res.json({ message: '태그가 삭제되었습니다' });
    } catch (error) {
        console.error('태그 삭제 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 멤버에 태그 추가
router.post('/members/:memberId/tags', async (req, res) => {
    try {
        const { tag_id } = req.body;
        await MemberTag.create({
            member_id: parseInt(req.params.memberId),
            tag_id: parseInt(tag_id)
        });
        res.json({ message: '태그가 추가되었습니다' });
    } catch (error) {
        console.error('태그 추가 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 멤버에서 태그 제거
router.delete('/members/:memberId/tags/:tagId', async (req, res) => {
    try {
        await MemberTag.deleteOne({
            member_id: parseInt(req.params.memberId),
            tag_id: parseInt(req.params.tagId)
        });
        res.json({ message: '태그가 제거되었습니다' });
    } catch (error) {
        console.error('태그 제거 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// ===== 이벤트 관리 =====

// 이벤트 조회
router.get('/events', async (req, res) => {
    try {
        let query = {};
        if (req.user.role !== 'super_admin' && req.user.department_id) {
            query.department_id = req.user.department_id;
        }

        const events = await Event.find(query).populate('created_by', 'name').sort({ event_date: -1 });
        res.json(events.map(e => ({
            ...e.toObject(),
            id: e._id,
            creator_name: e.created_by ? e.created_by.name : null
        })));
    } catch (error) {
        console.error('이벤트 조회 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 이벤트 생성
router.post('/events', async (req, res) => {
    try {
        const { title, description, event_date, location, max_participants } = req.body;
        const counter = await Counter.findByIdAndUpdate('events', { $inc: { seq: 1 } }, { new: true, upsert: true });

        const event = await Event.create({
            _id: counter.seq,
            department_id: req.user.department_id,
            title,
            description,
            event_date,
            location,
            max_participants,
            created_by: req.user.id
        });

        res.json({ ...event.toObject(), id: event._id });
    } catch (error) {
        console.error('이벤트 생성 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 이벤트 삭제
router.delete('/events/:id', async (req, res) => {
    try {
        await Event.findByIdAndDelete(req.params.id);
        await EventParticipant.deleteMany({ event_id: parseInt(req.params.id) });
        res.json({ message: '이벤트가 삭제되었습니다' });
    } catch (error) {
        console.error('이벤트 삭제 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 이벤트 참가 신청
router.post('/events/:id/participants', async (req, res) => {
    try {
        const { member_id } = req.body;
        await EventParticipant.create({
            event_id: parseInt(req.params.id),
            member_id: parseInt(member_id),
            status: 'registered'
        });
        res.json({ message: '참가 신청이 완료되었습니다' });
    } catch (error) {
        console.error('참가 신청 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 이벤트 참가자 목록
router.get('/events/:id/participants', async (req, res) => {
    try {
        const participants = await EventParticipant.find({ event_id: parseInt(req.params.id) })
            .populate('member_id', 'name');

        res.json(participants.map(p => ({
            member_id: p.member_id._id,
            member_name: p.member_id.name,
            status: p.status,
            registered_at: p.registered_at
        })));
    } catch (error) {
        console.error('참가자 조회 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

module.exports = router;
