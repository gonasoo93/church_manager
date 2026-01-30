const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const Visit = require('../models/Visit');
const VisitTemplate = require('../models/VisitTemplate');
const Member = require('../models/Member');
const Attendance = require('../models/Attendance');
const Counter = require('../models/Counter');

// 모든 라우트에 인증 필요
router.use(authenticateToken);

// 심방 필요 학생 추천
router.get('/recommendations', async (req, res) => {
    try {
        // 부서 필터링
        let deptId = req.query.department_id;
        if (req.user.role !== 'super_admin' && req.user.department_id) {
            deptId = req.user.department_id;
        }

        const recommendations = [];

        // 30일 이상 미심방 학생
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

        let memberQuery = {};
        if (deptId) {
            memberQuery.department_id = parseInt(deptId);
        }

        const members = await Member.find(memberQuery);

        for (const member of members) {
            // 최근 심방 기록 확인
            const lastVisit = await Visit.findOne({ member_id: member._id })
                .sort({ date: -1 })
                .limit(1);

            if (!lastVisit || lastVisit.date < thirtyDaysAgoStr) {
                recommendations.push({
                    member_id: member._id,
                    member_name: member.name,
                    reason: lastVisit ? `${Math.floor((new Date() - new Date(lastVisit.date)) / (1000 * 60 * 60 * 24))}일 미심방` : '심방 기록 없음',
                    priority: 'high',
                    last_visit: lastVisit ? lastVisit.date : null
                });
            }
        }

        // 3주 이상 연속 결석자
        const threeWeeksAgo = new Date();
        threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21);
        const threeWeeksAgoStr = threeWeeksAgo.toISOString().split('T')[0];

        let attendanceQuery = {
            date: { $gte: threeWeeksAgoStr }
        };
        if (deptId) {
            attendanceQuery.department_id = parseInt(deptId);
        }

        const attendances = await Attendance.find(attendanceQuery);

        // 학생별로 그룹화
        const memberAttendanceMap = {};
        attendances.forEach(a => {
            if (!memberAttendanceMap[a.member_id]) {
                memberAttendanceMap[a.member_id] = [];
            }
            memberAttendanceMap[a.member_id].push(a);
        });

        for (const memberId in memberAttendanceMap) {
            const records = memberAttendanceMap[memberId].sort((a, b) => b.date.localeCompare(a.date));
            let consecutiveAbsent = 0;

            for (const record of records) {
                if (record.status === 'absent') {
                    consecutiveAbsent++;
                } else {
                    break;
                }
            }

            if (consecutiveAbsent >= 3) {
                const member = await Member.findById(parseInt(memberId));
                if (member && !recommendations.find(r => r.member_id === member._id)) {
                    recommendations.push({
                        member_id: member._id,
                        member_name: member.name,
                        reason: `${consecutiveAbsent}주 연속 결석`,
                        priority: 'high',
                        last_visit: null
                    });
                }
            }
        }

        // 우선순위로 정렬
        recommendations.sort((a, b) => {
            if (a.priority === b.priority) return 0;
            return a.priority === 'high' ? -1 : 1;
        });

        res.json(recommendations);
    } catch (error) {
        console.error('심방 추천 조회 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 심방 템플릿 조회
router.get('/templates', async (req, res) => {
    try {
        let query = {};

        // 부서 필터링
        if (req.user.role !== 'super_admin' && req.user.department_id) {
            query.department_id = req.user.department_id;
        }

        const templates = await VisitTemplate.find(query).sort({ created_at: -1 });
        const result = templates.map(t => ({ ...t.toObject(), id: t._id }));
        res.json(result);
    } catch (error) {
        console.error('템플릿 조회 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 심방 템플릿 생성
router.post('/templates', async (req, res) => {
    try {
        const { title, content, category } = req.body;

        const counter = await Counter.findByIdAndUpdate(
            'visit_templates',
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );

        const template = await VisitTemplate.create({
            _id: counter.seq,
            user_id: req.user.id,
            department_id: req.user.department_id,
            title,
            content,
            category: category || '전화'
        });

        res.json({ ...template.toObject(), id: template._id });
    } catch (error) {
        console.error('템플릿 생성 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 심방 템플릿 삭제
router.delete('/templates/:id', async (req, res) => {
    try {
        await VisitTemplate.findByIdAndDelete(req.params.id);
        res.json({ message: '템플릿이 삭제되었습니다' });
    } catch (error) {
        console.error('템플릿 삭제 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 심방 통계
router.get('/statistics', async (req, res) => {
    try {
        const { startDate, endDate, department_id } = req.query;

        // 부서 필터링
        let deptId = department_id;
        if (req.user.role !== 'super_admin' && req.user.department_id) {
            deptId = req.user.department_id;
        }

        let query = {};
        if (deptId) {
            query.department_id = parseInt(deptId);
        }
        if (startDate && endDate) {
            query.date = { $gte: startDate, $lte: endDate };
        }

        const visits = await Visit.find(query)
            .populate('teacher_id', 'name')
            .populate('member_id', 'name');

        // 교사별 통계
        const byTeacher = {};
        visits.forEach(v => {
            const teacherName = v.teacher_id ? v.teacher_id.name : '알 수 없음';
            if (!byTeacher[teacherName]) {
                byTeacher[teacherName] = 0;
            }
            byTeacher[teacherName]++;
        });

        // 학생별 통계
        const byMember = {};
        visits.forEach(v => {
            const memberName = v.member_id ? v.member_id.name : '알 수 없음';
            if (!byMember[memberName]) {
                byMember[memberName] = 0;
            }
            byMember[memberName]++;
        });

        // 월별 통계
        const byMonth = {};
        visits.forEach(v => {
            const month = v.date.substring(0, 7); // YYYY-MM
            if (!byMonth[month]) {
                byMonth[month] = 0;
            }
            byMonth[month]++;
        });

        res.json({
            by_teacher: Object.entries(byTeacher).map(([name, count]) => ({ teacher_name: name, count })),
            by_member: Object.entries(byMember).map(([name, count]) => ({ member_name: name, count })),
            by_month: byMonth
        });
    } catch (error) {
        console.error('심방 통계 조회 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

module.exports = router;
