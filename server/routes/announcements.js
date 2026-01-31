const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const Announcement = require('../models/Announcement');
const Comment = require('../models/Comment');
const Counter = require('../models/Counter');

router.use(authenticateToken);

// 공지사항 조회
router.get('/', async (req, res) => {
    try {
        let query = {};
        if (req.user.role !== 'super_admin' && req.user.department_id) {
            query.department_id = req.user.department_id;
        }

        const announcements = await Announcement.find(query)
            .populate('author_id', 'name')
            .sort({ pinned: -1, created_at: -1 });

        const result = announcements.map(a => ({
            ...a.toObject(),
            id: a._id,
            author_name: a.author_id ? a.author_id.name : '알 수 없음'
        }));

        res.json(result);
    } catch (error) {
        console.error('공지사항 조회 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 공지사항 생성
router.post('/', async (req, res) => {
    try {
        const { title, content, priority } = req.body;

        const counter = await Counter.findByIdAndUpdate(
            'announcements',
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );

        const announcement = await Announcement.create({
            _id: counter.seq,
            department_id: req.user.department_id,
            author_id: req.user.id,
            title,
            content,
            priority: priority || 'normal'
        });

        res.json({ ...announcement.toObject(), id: announcement._id });
    } catch (error) {
        console.error('공지사항 생성 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 공지사항 수정
router.put('/:id', async (req, res) => {
    try {
        const { title, content, priority } = req.body;
        const announcement = await Announcement.findByIdAndUpdate(
            req.params.id,
            { title, content, priority, updated_at: new Date() },
            { new: true }
        );

        res.json({ ...announcement.toObject(), id: announcement._id });
    } catch (error) {
        console.error('공지사항 수정 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 공지사항 삭제
router.delete('/:id', async (req, res) => {
    try {
        const announcement = await Announcement.findById(req.params.id);
        if (!announcement) {
            return res.status(404).json({ error: '해당 공지사항을 찾을 수 없습니다' });
        }

        // 권한 체크: 작성자 또는 부서관리자 이상만 삭제 가능
        const isAuthor = announcement.author_id && announcement.author_id.toString() === req.user.id.toString();
        const isAdmin = req.user.role === 'super_admin' || req.user.role === 'department_admin' || req.user.role === 'admin';

        if (!isAuthor && !isAdmin) {
            return res.status(403).json({ error: '삭제 권한이 없습니다' });
        }

        // 부서가 다른 경우 체크 (관리자가 아닌 경우)
        if (!isAdmin && req.user.role !== 'super_admin' && announcement.department_id !== req.user.department_id) {
            return res.status(403).json({ error: '다른 부서의 공지사항은 삭제할 수 없습니다' });
        }

        await Announcement.findByIdAndDelete(req.params.id);
        res.json({ message: '공지사항이 삭제되었습니다' });
    } catch (error) {
        console.error('공지사항 삭제 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 공지사항 고정/해제
router.post('/:id/pin', async (req, res) => {
    try {
        const announcement = await Announcement.findById(req.params.id);
        announcement.pinned = !announcement.pinned;
        await announcement.save();

        res.json({ message: announcement.pinned ? '고정되었습니다' : '고정이 해제되었습니다' });
    } catch (error) {
        console.error('공지사항 고정 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 댓글 조회
router.get('/:targetType/:targetId/comments', async (req, res) => {
    try {
        const { targetType, targetId } = req.params;
        const comments = await Comment.find({
            target_type: targetType,
            target_id: parseInt(targetId)
        })
            .populate('user_id', 'name')
            .sort({ created_at: 1 });

        const result = comments.map(c => ({
            ...c.toObject(),
            id: c._id,
            user_name: c.user_id ? c.user_id.name : '알 수 없음'
        }));

        res.json(result);
    } catch (error) {
        console.error('댓글 조회 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 댓글 작성
router.post('/:targetType/:targetId/comments', async (req, res) => {
    try {
        const { targetType, targetId } = req.params;
        const { content } = req.body;

        const counter = await Counter.findByIdAndUpdate(
            'comments',
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );

        const comment = await Comment.create({
            _id: counter.seq,
            target_type: targetType,
            target_id: parseInt(targetId),
            user_id: req.user.id,
            content
        });

        const populated = await Comment.findById(comment._id).populate('user_id', 'name');
        res.json({
            ...populated.toObject(),
            id: populated._id,
            user_name: populated.user_id.name
        });
    } catch (error) {
        console.error('댓글 작성 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 댓글 삭제
router.delete('/comments/:id', async (req, res) => {
    try {
        await Comment.findByIdAndDelete(req.params.id);
        res.json({ message: '댓글이 삭제되었습니다' });
    } catch (error) {
        console.error('댓글 삭제 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

module.exports = router;
