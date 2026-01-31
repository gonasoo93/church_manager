const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const Attendance = require('../models/Attendance');
const Member = require('../models/Member');

// 모든 라우트에 인증 필요
router.use(authenticateToken);

// 출석 기록 조회 (날짜별)
router.get('/', async (req, res) => {
    try {
        const Group = require('../models/Group');
        const MemberGroup = require('../models/MemberGroup');

        const { date } = req.query;
        let query = {};

        // 그룹 리더인 경우: 자신의 그룹 멤버만 조회
        const userGroups = await Group.find({ leader_id: req.user.id });
        if (userGroups.length > 0 && req.user.role !== 'super_admin' && req.user.role !== 'admin') {
            const groupIds = userGroups.map(g => g._id);
            const memberGroups = await MemberGroup.find({ group_id: { $in: groupIds } });
            const memberIds = memberGroups.map(mg => mg.member_id);
            query.member_id = { $in: memberIds };
        }
        // 부서 필터링
        else if (req.user.role !== 'super_admin' && req.user.department_id) {
            query.department_id = req.user.department_id;
        }

        if (date) {
            query.date = date;
        }

        const attendance = await Attendance.find(query).populate('member_id', 'name');

        const result = attendance.map(a => {
            const doc = a.toObject();
            return {
                ...doc,
                id: doc._id,
                member_name: doc.member_id ? doc.member_id.name : '알 수 없음',
                member_id: doc.member_id ? doc.member_id._id : null
            };
        });

        // 날짜별 정렬 (단일 날짜 조회인 경우 의미 없지만 전체 조회 시 유용)
        result.sort((a, b) => b.date.localeCompare(a.date));

        res.json(result);
    } catch (error) {
        console.error('출석 조회 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 출석 통계 조회
router.get('/stats', async (req, res) => {
    try {
        const { startDate, endDate, department_id } = req.query;

        let memberQuery = {};
        let attQuery = {};

        // 부서 필터링
        if (req.user.role !== 'super_admin' && req.user.department_id) {
            memberQuery.department_id = req.user.department_id;
            attQuery.department_id = req.user.department_id;
        } else if (req.user.role === 'super_admin' && department_id && department_id !== 'all') {
            const deptId = parseInt(department_id);
            memberQuery.department_id = deptId;
            attQuery.department_id = deptId;
        }

        // 날짜 필터링
        if (startDate && endDate) {
            attQuery.date = { $gte: startDate, $lte: endDate };
        }

        const members = await Member.find(memberQuery);
        const attendance = await Attendance.find(attQuery);

        // 통계 계산
        const stats = members.map(member => {
            const memberAttendance = attendance.filter(a => a.member_id === member._id);
            return {
                id: member._id,
                name: member.name,
                present_count: memberAttendance.filter(a => a.status === 'present').length,
                absent_count: memberAttendance.filter(a => a.status === 'absent').length,
                late_count: memberAttendance.filter(a => a.status === 'late').length,
                total_count: memberAttendance.length
            };
        });

        res.json(stats);
    } catch (error) {
        console.error('출석 통계 조회 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 날짜별 출석 통계 조회
router.get('/stats/daily', async (req, res) => {
    try {
        const { startDate, endDate, department_id } = req.query;
        let query = {};

        if (req.user.role !== 'super_admin' && req.user.department_id) {
            query.department_id = req.user.department_id;
        } else if (req.user.role === 'super_admin' && department_id && department_id !== 'all') {
            query.department_id = parseInt(department_id);
        }

        if (startDate && endDate) {
            query.date = { $gte: startDate, $lte: endDate };
        }

        const attendance = await Attendance.find(query);

        const dailyStats = {};
        attendance.forEach(a => {
            if (!dailyStats[a.date]) {
                dailyStats[a.date] = { date: a.date, present: 0, late: 0, absent: 0 };
            }
            if (a.status === 'present') dailyStats[a.date].present++;
            else if (a.status === 'late') dailyStats[a.date].late++;
            else if (a.status === 'absent') dailyStats[a.date].absent++;
        });

        const result = Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date));
        res.json(result);
    } catch (error) {
        console.error('날짜별 통계 조회 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 출석 기록 등록/수정
router.post('/', async (req, res) => {
    try {
        const { member_id, date, status, notes } = req.body;

        if (!member_id || !date || !status) {
            return res.status(400).json({ error: '필수 정보를 입력해주세요' });
        }

        let department_id = req.user.department_id;
        if (!department_id) {
            const member = await Member.findById(member_id);
            department_id = member ? member.department_id : 3;
        }

        // upsert
        await Attendance.findOneAndUpdate(
            { member_id, date },
            { member_id, date, status, notes, department_id },
            { upsert: true, new: true }
        );

        res.status(201).json({ message: '출석이 기록되었습니다' });
    } catch (error) {
        console.error('출석 기록 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 일괄 출석 체크
router.post('/bulk', async (req, res) => {
    try {
        const { date, records } = req.body;

        if (!date || !Array.isArray(records)) {
            return res.status(400).json({ error: '잘못된 요청입니다' });
        }

        const userDeptId = req.user.department_id;

        // Mongoose Bulk Operations
        const operations = [];

        // 학생 정보를 미리 조회할 수도 있지만, loop 안에서 처리하거나
        // records가 많지 않으므로 개별 처리.
        // 최적화를 위해 records의 ID 목록으로 Members 조회 후 매핑.
        let memberMap = {};
        if (!userDeptId) {
            const memberIds = records.map(r => r.member_id);
            const members = await Member.find({ _id: { $in: memberIds } });
            members.forEach(m => memberMap[m._id] = m.department_id);
        }

        for (const record of records) {
            let targetDeptId = userDeptId;
            if (!targetDeptId) {
                targetDeptId = memberMap[record.member_id] || 3;
            }

            operations.push({
                updateOne: {
                    filter: { member_id: record.member_id, date },
                    update: {
                        $set: {
                            status: record.status,
                            notes: record.notes || null,
                            department_id: targetDeptId
                        }
                    },
                    upsert: true
                }
            });
        }

        if (operations.length > 0) {
            await Attendance.bulkWrite(operations);
        }

        res.status(201).json({ message: '출석이 일괄 기록되었습니다' });
    } catch (error) {
        console.error('일괄 출석 기록 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 날짜별 출석 기록 일괄 삭제
router.delete('/date/:date', async (req, res) => {
    try {
        const { date } = req.params;

        if (!date) {
            return res.status(400).json({ error: '날짜를 입력해주세요' });
        }

        // 권한 체크: 해당 부서의 출석만 삭제 가능
        let query = { date };

        if (req.user.role !== 'super_admin' && req.user.department_id) {
            query.department_id = req.user.department_id;
        }

        const result = await Attendance.deleteMany(query);

        res.json({
            message: '출석 기록이 삭제되었습니다',
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error('날짜별 출석 삭제 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 출석 기록 삭제
router.delete('/:id', async (req, res) => {
    try {
        await Attendance.findByIdAndDelete(req.params.id);
        res.json({ message: '출석 기록이 삭제되었습니다' });
    } catch (error) {
        console.error('출석 삭제 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

module.exports = router;
