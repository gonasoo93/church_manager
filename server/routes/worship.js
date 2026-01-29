const express = require('express');
const { query } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// 모든 라우트에 인증 필요
router.use(authenticateToken);

// 예배 기록 목록 조회
router.get('/', (req, res) => {
    try {
        let worship = query.all('worship');

        // 부서 필터링 (총괄 관리자가 아니면 자신의 부서만)
        if (req.user.role !== 'super_admin' && req.user.department_id) {
            worship = worship.filter(w => w.department_id === req.user.department_id);
        }

        worship.sort((a, b) => {
            const dateCompare = b.date.localeCompare(a.date);
            if (dateCompare !== 0) return dateCompare;
            return (b.time || '').localeCompare(a.time || '');
        });
        res.json(worship);
    } catch (error) {
        console.error('예배 기록 조회 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 예배 기록 상세 조회
router.get('/:id', (req, res) => {
    try {
        const worship = query.get('worship', req.params.id);
        if (!worship) {
            return res.status(404).json({ error: '해당 예배 기록을 찾을 수 없습니다' });
        }

        // 권한 확인
        if (req.user.role !== 'super_admin' && req.user.department_id && worship.department_id !== req.user.department_id) {
            return res.status(403).json({ error: '해당 예배 기록에 접근 권한이 없습니다' });
        }

        res.json(worship);
    } catch (error) {
        console.error('예배 기록 상세 조회 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 예배 기록 등록
router.post('/', (req, res) => {
    try {
        const {
            date,
            time,
            sermon_title,
            sermon_text,
            preacher,
            worship_songs,
            special_events,
            attendance_count,
            notes,
            department_id
        } = req.body;

        if (!date) {
            return res.status(400).json({ error: '날짜는 필수입니다' });
        }

        // 부서 ID 설정
        let targetDeptId = department_id;
        if (req.user.role !== 'super_admin') {
            targetDeptId = req.user.department_id;
        }

        if (!targetDeptId) {
            targetDeptId = 3; // 기본값
        }

        const worship = query.insert('worship', {
            date,
            time,
            sermon_title,
            sermon_text,
            preacher,
            worship_songs,
            special_events,
            attendance_count,
            notes,
            department_id: targetDeptId
        });

        res.status(201).json({
            id: worship.id,
            message: '예배 기록이 등록되었습니다'
        });
    } catch (error) {
        console.error('예배 기록 등록 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 예배 기록 수정
router.put('/:id', (req, res) => {
    try {
        // 먼저 기존 기록 확인 (권한 체크)
        const existing = query.get('worship', req.params.id);
        if (!existing) {
            return res.status(404).json({ error: '해당 예배 기록을 찾을 수 없습니다' });
        }

        if (req.user.role !== 'super_admin' && req.user.department_id && existing.department_id !== req.user.department_id) {
            return res.status(403).json({ error: '수정 권한이 없습니다' });
        }

        const {
            date,
            time,
            sermon_title,
            sermon_text,
            preacher,
            worship_songs,
            special_events,
            attendance_count,
            notes
        } = req.body;

        const updated = query.update('worship', req.params.id, {
            date,
            time,
            sermon_title,
            sermon_text,
            preacher,
            worship_songs,
            special_events,
            attendance_count,
            notes
        });

        res.json({ message: '예배 기록이 수정되었습니다' });
    } catch (error) {
        console.error('예배 기록 수정 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 예배 기록 삭제
router.delete('/:id', (req, res) => {
    try {
        query.delete('worship', req.params.id);
        res.json({ message: '예배 기록이 삭제되었습니다' });
    } catch (error) {
        console.error('예배 기록 삭제 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

module.exports = router;
