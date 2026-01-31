const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const Member = require('../models/Member');
const Counter = require('../models/Counter');

// 모든 라우트에 인증 필요
router.use(authenticateToken);

// 명부 목록 조회
router.get('/', async (req, res) => {
    try {

        const { department_id, status } = req.query;
        let query = {};

        // 부서 필터링: 그룹 리더도 부서 전체를 조회 가능 (Read 권한)
        if (req.user.role !== 'super_admin' && req.user.department_id) {
            query.department_id = req.user.department_id;
        } else if (req.user.role === 'super_admin' && department_id && department_id !== 'all') {
            query.department_id = parseInt(department_id);
        }

        // 상태 필터링
        if (status && status !== 'all') {
            query.status = status;
        }

        const members = await Member.find(query).sort({ name: 1 });
        const result = members.map(m => ({ ...m.toObject(), id: m._id }));
        res.json(result);
    } catch (error) {
        console.error('명부 조회 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 명부 상세 조회
router.get('/:id', async (req, res) => {
    try {
        const member = await Member.findById(req.params.id);
        if (!member) {
            return res.status(404).json({ error: '해당 청소년을 찾을 수 없습니다' });
        }

        // 권한 체크
        if (req.user.role !== 'super_admin' && req.user.department_id && member.department_id !== req.user.department_id) {
            return res.status(403).json({ error: '타 부서 학생 정보는 볼 수 없습니다' });
        }

        res.json({ ...member.toObject(), id: member._id });
    } catch (error) {
        console.error('명부 상세 조회 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 명부 등록
router.post('/', async (req, res) => {
    try {
        const { name, birth_date, phone, parent_phone, grade, department, address, notes, department_id, status } = req.body;

        if (!name) {
            return res.status(400).json({ error: '이름은 필수입니다' });
        }

        // 부서 ID 설정
        let targetDeptId = department_id;
        if (req.user.role !== 'super_admin') {
            targetDeptId = req.user.department_id;
        }
        if (!targetDeptId) targetDeptId = 3; // 기본값

        const counter = await Counter.findByIdAndUpdate('members', { $inc: { seq: 1 } }, { new: true, upsert: true });

        const member = await Member.create({
            _id: counter.seq,
            name,
            birth_date,
            phone,
            parent_phone,
            grade,
            department, // DB에는 저장되지만 view에서는 department_id 사용이 권장됨
            department_id: targetDeptId,
            status: status || 'active',
            address,
            notes
        });

        res.status(201).json({ ...member.toObject(), id: member._id });
    } catch (error) {
        console.error('명부 등록 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 명부 수정
router.put('/:id', async (req, res) => {
    try {
        const { name, birth_date, phone, parent_phone, grade, department, address, notes, status } = req.body;

        const member = await Member.findByIdAndUpdate(req.params.id, {
            name,
            birth_date,
            phone,
            parent_phone,
            grade,
            department,
            status,
            address,
            notes
        }, { new: true });

        if (!member) {
            return res.status(404).json({ error: '해당 청소년을 찾을 수 없습니다' });
        }

        res.json({ message: '명부가 수정되었습니다' });
    } catch (error) {
        console.error('명부 수정 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 명부 삭제
router.delete('/:id', async (req, res) => {
    try {
        await Member.findByIdAndDelete(req.params.id);
        res.json({ message: '명부가 삭제되었습니다' });
    } catch (error) {
        console.error('명부 삭제 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

module.exports = router;
