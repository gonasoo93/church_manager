const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const { authenticateToken } = require('../middleware/auth');
const Member = require('../models/Member');
const Attendance = require('../models/Attendance');
const Visit = require('../models/Visit');

router.use(authenticateToken);

// 명부 엑셀 내보내기
router.get('/members', async (req, res) => {
    try {
        let query = {};
        if (req.user.role !== 'super_admin' && req.user.department_id) {
            query.department_id = req.user.department_id;
        }

        const members = await Member.find(query).sort({ name: 1 });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('학생 명부');

        worksheet.columns = [
            { header: '이름', key: 'name', width: 15 },
            { header: '학년', key: 'grade', width: 10 },
            { header: '반', key: 'group', width: 10 },
            { header: '전화번호', key: 'phone', width: 15 },
            { header: '부모 전화번호', key: 'parent_phone', width: 15 },
            { header: '주소', key: 'address', width: 30 },
            { header: '생년월일', key: 'birth_date', width: 12 },
            { header: '상태', key: 'status', width: 10 }
        ];

        members.forEach(member => {
            worksheet.addRow({
                name: member.name,
                grade: member.grade,
                group: member.group,
                phone: member.phone || '',
                parent_phone: member.parent_phone || '',
                address: member.address || '',
                birth_date: member.birth_date || '',
                status: member.status
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=members.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('명부 내보내기 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 출석부 엑셀 내보내기
router.get('/attendance', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        let query = {};
        if (req.user.role !== 'super_admin' && req.user.department_id) {
            query.department_id = req.user.department_id;
        }
        if (startDate && endDate) {
            query.date = { $gte: startDate, $lte: endDate };
        }

        const attendances = await Attendance.find(query)
            .populate('member_id', 'name')
            .sort({ date: -1 });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('출석부');

        worksheet.columns = [
            { header: '날짜', key: 'date', width: 12 },
            { header: '학생 이름', key: 'member_name', width: 15 },
            { header: '상태', key: 'status', width: 10 },
            { header: '비고', key: 'notes', width: 30 }
        ];

        attendances.forEach(att => {
            worksheet.addRow({
                date: att.date,
                member_name: att.member_id ? att.member_id.name : '알 수 없음',
                status: att.status === 'present' ? '출석' : att.status === 'late' ? '지각' : '결석',
                notes: att.notes || ''
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=attendance.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('출석부 내보내기 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

module.exports = router;
