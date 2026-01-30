const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const Attendance = require('../models/Attendance');
const AttendanceGoal = require('../models/AttendanceGoal');
const Member = require('../models/Member');
const Counter = require('../models/Counter');

// 모든 라우트에 인증 필요
router.use(authenticateToken);

// 월별/분기별 출석률 추이
router.get('/trends', async (req, res) => {
    try {
        const { department_id, period = 'monthly', months = 6 } = req.query;

        // 부서 필터링
        let deptId = department_id;
        if (req.user.role !== 'super_admin' && req.user.department_id) {
            deptId = req.user.department_id;
        }

        const monthsNum = parseInt(months);
        const now = new Date();
        const labels = [];
        const data = [];

        // 최근 N개월 데이터 생성
        for (let i = monthsNum - 1; i >= 0; i--) {
            const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const year = targetDate.getFullYear();
            const month = targetDate.getMonth() + 1;
            const monthStr = `${year}-${String(month).padStart(2, '0')}`;
            labels.push(monthStr);

            // 해당 월의 시작일과 종료일
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59);

            // 출석 데이터 조회
            let query = {
                date: {
                    $gte: startDate.toISOString().split('T')[0],
                    $lte: endDate.toISOString().split('T')[0]
                }
            };
            if (deptId) {
                query.department_id = parseInt(deptId);
            }

            const attendances = await Attendance.find(query);

            // 출석률 계산
            const totalRecords = attendances.length;
            const presentCount = attendances.filter(a => a.status === 'present').length;
            const rate = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0;

            data.push(rate);
        }

        res.json({ labels, data });
    } catch (error) {
        console.error('출석률 추이 조회 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 연속 결석자 조회
router.get('/absent-streak', async (req, res) => {
    try {
        const { department_id, weeks = 3 } = req.query;

        // 부서 필터링
        let deptId = department_id;
        if (req.user.role !== 'super_admin' && req.user.department_id) {
            deptId = req.user.department_id;
        }

        const weeksNum = parseInt(weeks);
        const now = new Date();
        const startDate = new Date(now);
        startDate.setDate(startDate.getDate() - (weeksNum * 7));

        // 해당 기간의 모든 출석 기록
        let query = {
            date: { $gte: startDate.toISOString().split('T')[0] }
        };
        if (deptId) {
            query.department_id = parseInt(deptId);
        }

        const attendances = await Attendance.find(query).populate('member_id', 'name');

        // 학생별로 그룹화
        const memberMap = {};
        attendances.forEach(a => {
            if (!a.member_id) return;
            const memberId = a.member_id._id;
            if (!memberMap[memberId]) {
                memberMap[memberId] = {
                    member_id: memberId,
                    member_name: a.member_id.name,
                    records: []
                };
            }
            memberMap[memberId].records.push({
                date: a.date,
                status: a.status
            });
        });

        // 연속 결석 확인
        const absentStreakMembers = [];
        for (const memberId in memberMap) {
            const member = memberMap[memberId];
            member.records.sort((a, b) => b.date.localeCompare(a.date));

            // 최근 기록부터 확인
            let consecutiveAbsent = 0;
            let lastAttendance = null;

            for (const record of member.records) {
                if (record.status === 'present') {
                    lastAttendance = record.date;
                    break;
                } else if (record.status === 'absent') {
                    consecutiveAbsent++;
                }
            }

            if (consecutiveAbsent >= weeksNum) {
                absentStreakMembers.push({
                    member_id: member.member_id,
                    member_name: member.member_name,
                    absent_weeks: consecutiveAbsent,
                    last_attendance: lastAttendance
                });
            }
        }

        // 결석 주수로 정렬 (많은 순)
        absentStreakMembers.sort((a, b) => b.absent_weeks - a.absent_weeks);

        res.json(absentStreakMembers);
    } catch (error) {
        console.error('연속 결석자 조회 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 부서별 출석률 비교
router.get('/department-comparison', async (req, res) => {
    try {
        // 총괄 관리자만 접근 가능
        if (req.user.role !== 'super_admin') {
            return res.status(403).json({ error: '권한이 없습니다' });
        }

        const { startDate, endDate } = req.query;
        const Department = require('../models/Department');

        const departments = await Department.find();
        const departmentNames = [];
        const rates = [];

        for (const dept of departments) {
            departmentNames.push(dept.name);

            let query = { department_id: dept._id };
            if (startDate && endDate) {
                query.date = { $gte: startDate, $lte: endDate };
            }

            const attendances = await Attendance.find(query);
            const totalRecords = attendances.length;
            const presentCount = attendances.filter(a => a.status === 'present').length;
            const rate = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0;

            rates.push(rate);
        }

        res.json({ departments: departmentNames, rates });
    } catch (error) {
        console.error('부서별 출석률 비교 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 목표 출석률 조회
router.get('/goals', async (req, res) => {
    try {
        let query = {};

        // 부서 필터링
        if (req.user.role !== 'super_admin' && req.user.department_id) {
            query.department_id = req.user.department_id;
        }

        const goals = await AttendanceGoal.find(query).sort({ created_at: -1 });
        const result = goals.map(g => ({ ...g.toObject(), id: g._id }));
        res.json(result);
    } catch (error) {
        console.error('목표 출석률 조회 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 목표 출석률 설정
router.post('/goals', async (req, res) => {
    try {
        const { department_id, target_rate, period } = req.body;

        // 부서 관리자는 자기 부서만 설정 가능
        if (req.user.role === 'department_admin' && department_id !== req.user.department_id) {
            return res.status(403).json({ error: '자신의 부서만 설정할 수 있습니다' });
        }

        const counter = await Counter.findByIdAndUpdate(
            'attendance_goals',
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );

        const goal = await AttendanceGoal.create({
            _id: counter.seq,
            department_id: parseInt(department_id),
            target_rate: parseFloat(target_rate),
            period: period || 'monthly'
        });

        res.json({ ...goal.toObject(), id: goal._id });
    } catch (error) {
        console.error('목표 출석률 설정 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

module.exports = router;
