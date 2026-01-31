const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Meeting = require('../models/Meeting');
const Counter = require('../models/Counter');

// 모든 라우트에 인증 필요
router.use(authenticateToken);

// Gemini AI 초기화
let genAI;
if (process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

// 회의 기록 목록 조회
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

        const meetings = await Meeting.find(query).sort({ date: -1, time: -1 });
        const result = meetings.map(m => ({ ...m.toObject(), id: m._id }));
        res.json(result);
    } catch (error) {
        console.error('회의 기록 조회 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 회의 기록 상세 조회
router.get('/:id', async (req, res) => {
    try {
        const meeting = await Meeting.findById(req.params.id);
        if (!meeting) {
            return res.status(404).json({ error: '해당 회의 기록을 찾을 수 없습니다' });
        }

        if (req.user.role !== 'super_admin' && req.user.department_id && meeting.department_id !== req.user.department_id) {
            return res.status(403).json({ error: '해당 회의 기록에 접근 권한이 없습니다' });
        }

        res.json({ ...meeting.toObject(), id: meeting._id });
    } catch (error) {
        console.error('회의 기록 상세 조회 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// AI 요약 생성
router.post('/summarize', async (req, res) => {
    try {
        const { content } = req.body;
        if (!content) {
            return res.status(400).json({ error: '회의 내용이 없습니다' });
        }

        if (!genAI) {
            return res.status(503).json({ error: 'AI 서비스가 설정되지 않았습니다 (API 키 누락)' });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        const prompt = `
            다음은 청소년교회 회의록 내용입니다. 이 내용을 분석하여 다음 JSON 형식으로 요약해주세요:
            
            회의 내용:
            ${content}

            응답 형식 (JSON):
            {
                "summary": "전체 회의 내용을 2-3문장으로 요약",
                "discussions": ["주요 논의사항1", "주요 논의사항2", ...],
                "decisions": ["결정사항1", "결정사항2", ...],
                "actions": ["실행계획1", "실행계획2", ...]
            }
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // JSON 파싱 (마크다운 코드 블록 제거)
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const summaryData = JSON.parse(jsonStr);

        res.json(summaryData);

    } catch (error) {
        console.error('AI 요약 오류:', error);
        res.status(500).json({ error: 'AI 요약 중 오류가 발생했습니다', details: error.message });
    }
});


// 회의 기록 등록
router.post('/', async (req, res) => {
    try {
        const { title, date, time, attendees, content, decisions, next_meeting, department_id } = req.body;

        if (!title || !date) {
            return res.status(400).json({ error: '제목과 날짜는 필수입니다' });
        }

        let targetDeptId = department_id;
        if (req.user.role !== 'super_admin') {
            targetDeptId = req.user.department_id;
        }
        if (!targetDeptId) targetDeptId = 3;

        const counter = await Counter.findByIdAndUpdate('meetings', { $inc: { seq: 1 } }, { new: true, upsert: true });

        const meeting = await Meeting.create({
            _id: counter.seq,
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
            id: meeting._id,
            message: '회의 기록이 등록되었습니다'
        });
    } catch (error) {
        console.error('회의 기록 등록 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 회의 기록 수정
router.put('/:id', async (req, res) => {
    try {
        const meeting = await Meeting.findById(req.params.id);
        if (!meeting) {
            return res.status(404).json({ error: '해당 회의 기록을 찾을 수 없습니다' });
        }

        if (req.user.role !== 'super_admin' && req.user.department_id && meeting.department_id !== req.user.department_id) {
            return res.status(403).json({ error: '수정 권한이 없습니다' });
        }

        const { title, date, time, attendees, content, decisions, next_meeting } = req.body;

        meeting.title = title;
        meeting.date = date;
        meeting.time = time;
        meeting.attendees = attendees;
        meeting.content = content;
        meeting.decisions = decisions;
        meeting.next_meeting = next_meeting;
        meeting.updated_at = Date.now();

        await meeting.save();

        res.json({ message: '회의 기록이 수정되었습니다' });
    } catch (error) {
        console.error('회의 기록 수정 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 회의 기록 삭제
router.delete('/:id', async (req, res) => {
    try {
        const meeting = await Meeting.findById(req.params.id);
        if (!meeting) {
            return res.status(404).json({ error: '해당 회의 기록을 찾을 수 없습니다' });
        }

        // 권한 체크: 부서관리자 이상만 삭제 가능
        if (req.user.role !== 'super_admin' && req.user.role !== 'department_admin' && req.user.role !== 'admin') {
            return res.status(403).json({ error: '삭제 권한이 없습니다' });
        }

        // 부서가 다른 경우 체크
        if (req.user.role !== 'super_admin' && meeting.department_id !== req.user.department_id) {
            return res.status(403).json({ error: '다른 부서의 기록은 삭제할 수 없습니다' });
        }

        await Meeting.findByIdAndDelete(req.params.id);
        res.json({ message: '회의 기록이 삭제되었습니다' });
    } catch (error) {
        console.error('회의 기록 삭제 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

module.exports = router;
