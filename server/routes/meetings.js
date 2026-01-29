const express = require('express');
const { query } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const router = express.Router();

// 모든 라우트에 인증 필요
router.use(authenticateToken);

// Gemini AI 초기화
let genAI;
if (process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

// 회의 기록 목록 조회
router.get('/', (req, res) => {
    try {
        let meetings = query.all('meetings');

        // 부서 필터링 (총괄 관리자가 아니면 자신의 부서만)
        if (req.user.role !== 'super_admin' && req.user.department_id) {
            meetings = meetings.filter(m => m.department_id === req.user.department_id);
        }

        meetings.sort((a, b) => {
            const dateCompare = b.date.localeCompare(a.date);
            if (dateCompare !== 0) return dateCompare;
            return (b.time || '').localeCompare(a.time || '');
        });
        res.json(meetings);
    } catch (error) {
        console.error('회의 기록 조회 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 회의 기록 상세 조회
router.get('/:id', (req, res) => {
    try {
        const meeting = query.get('meetings', req.params.id);
        if (!meeting) {
            return res.status(404).json({ error: '해당 회의 기록을 찾을 수 없습니다' });
        }

        // 권한 확인
        if (req.user.role !== 'super_admin' && req.user.department_id && meeting.department_id !== req.user.department_id) {
            return res.status(403).json({ error: '해당 회의 기록에 접근 권한이 없습니다' });
        }

        res.json(meeting);
    } catch (error) {
        console.error('회의 기록 상세 조회 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// ... AI 요약 (중간 생략) ...

// 회의 기록 등록
router.post('/', (req, res) => {
    try {
        const { title, date, time, attendees, content, decisions, next_meeting, department_id } = req.body;

        if (!title || !date) {
            return res.status(400).json({ error: '제목과 날짜는 필수입니다' });
        }

        // 부서 ID 설정
        let targetDeptId = department_id;
        if (req.user.role !== 'super_admin') {
            targetDeptId = req.user.department_id;
        }

        if (!targetDeptId) {
            targetDeptId = 3; // 기본값
        }

        const meeting = query.insert('meetings', {
            title,
            date,
            time,
            attendees,
            content,
            decisions,
            next_meeting,
            department_id: targetDeptId
        });

        res.status(201).json({
            id: meeting.id,
            message: '회의 기록이 등록되었습니다'
        });
    } catch (error) {
        console.error('회의 기록 등록 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 회의 기록 수정
router.put('/:id', (req, res) => {
    try {
        // 먼저 기존 기록 확인 (권한 체크)
        const existing = query.get('meetings', req.params.id);
        if (!existing) {
            return res.status(404).json({ error: '해당 회의 기록을 찾을 수 없습니다' });
        }

        if (req.user.role !== 'super_admin' && req.user.department_id && existing.department_id !== req.user.department_id) {
            return res.status(403).json({ error: '수정 권한이 없습니다' });
        }

        const { title, date, time, attendees, content, decisions, next_meeting } = req.body;

        const updated = query.update('meetings', req.params.id, {
            title,
            date,
            time,
            attendees,
            content,
            decisions,
            next_meeting
        });

        res.json({ message: '회의 기록이 수정되었습니다' });
    } catch (error) {
        console.error('회의 기록 수정 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 회의 기록 삭제
router.delete('/:id', (req, res) => {
    try {
        query.delete('meetings', req.params.id);
        res.json({ message: '회의 기록이 삭제되었습니다' });
    } catch (error) {
        console.error('회의 기록 삭제 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

module.exports = router;
