const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const User = require('../models/User');
const Department = require('../models/Department');
const Counter = require('../models/Counter');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

// 로그인
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(401).json({ error: '아이디 또는 비밀번호가 잘못되었습니다' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: '아이디 또는 비밀번호가 잘못되었습니다' });
        }

        const token = jwt.sign(
            { id: user._id, username: user.username, role: user.role, department_id: user.department_id },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // 부서명 조회
        let department_name = null;
        if (user.department_id) {
            const dept = await Department.findById(user.department_id);
            if (dept) department_name = dept.name;
        } else if (user.role === 'super_admin') {
            department_name = '교회학교 통합관리';
        }

        res.json({
            token,
            user: {
                id: user._id,
                username: user.username,
                name: user.name,
                role: user.role,
                department_id: user.department_id,
                department_name
            }
        });
    } catch (error) {
        console.error('로그인 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 내 정보 조회
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다' });
        }

        let department_name = null;
        if (user.department_id) {
            const dept = await Department.findById(user.department_id);
            if (dept) department_name = dept.name;
        } else if (user.role === 'super_admin') {
            department_name = '교회학교 통합관리';
        }

        res.json({
            ...user.toObject(),
            id: user._id,
            department_name
        });
    } catch (error) {
        console.error('내 정보 조회 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 사용자 목록 조회 (관리자용)
router.get('/users', authenticateToken, authorizeRole(['super_admin', 'department_admin']), async (req, res) => {
    try {
        let query = {};

        // 부서 관리자는 자기 부서만 조회
        if (req.user.role === 'department_admin') {
            query.department_id = req.user.department_id;
        }

        const users = await User.find(query).select('-password').sort({ created_at: -1 });
        const result = users.map(u => ({ ...u.toObject(), id: u._id }));
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: '서버 오류' });
    }
});

// 사용자 추가 (관리자용)
router.post('/users', authenticateToken, authorizeRole(['super_admin', 'department_admin']), async (req, res) => {
    try {
        const { username, password, name, role, department_id, assigned_grade, assigned_group } = req.body;

        if (!username || !password || !name) {
            return res.status(400).json({ error: '필수 정보를 입력해주세요' });
        }

        // 부서 관리자 권한 검증
        if (req.user.role === 'department_admin') {
            // 부서 ID가 없거나 자기 부서가 아니면 거부
            if (!department_id || parseInt(department_id) !== req.user.department_id) {
                return res.status(403).json({ error: '자신의 부서에만 사용자를 추가할 수 있습니다' });
            }
            // 부서 관리자는 teacher 역할만 추가 가능
            if (role && role !== 'teacher') {
                return res.status(403).json({ error: '교사 역할만 추가할 수 있습니다' });
            }
        }

        const exists = await User.findOne({ username });
        if (exists) {
            return res.status(400).json({ error: '이미 존재하는 아이디입니다' });
        }

        const counter = await Counter.findByIdAndUpdate('users', { $inc: { seq: 1 } }, { new: true, upsert: true });

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await User.create({
            _id: counter.seq,
            username,
            password: hashedPassword,
            name,
            role: role || 'teacher',
            department_id: department_id ? parseInt(department_id) : null,
            assigned_grade,
            assigned_group
        });

        // 비밀번호 제외 반환
        const responseUser = newUser.toObject();
        delete responseUser.password;
        responseUser.id = newUser._id;

        res.status(201).json(responseUser);
    } catch (error) {
        console.error('사용자 추가 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 프로필 수정
router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const { name, current_password, new_password } = req.body;
        const userId = req.user.id;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다' });
        }

        // 비밀번호 변경 시 현재 비밀번호 확인
        if (new_password) {
            if (!current_password) {
                return res.status(400).json({ error: '현재 비밀번호를 입력해주세요' });
            }

            const validPassword = await bcrypt.compare(current_password, user.password);
            if (!validPassword) {
                return res.status(401).json({ error: '현재 비밀번호가 올바르지 않습니다' });
            }

            user.password = await bcrypt.hash(new_password, 10);
        }

        if (name) user.name = name;

        await user.save();

        res.json({ message: '프로필이 수정되었습니다' });
    } catch (error) {
        console.error('프로필 수정 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 사용자 수정 (관리자용)
router.put('/users/:id', authenticateToken, authorizeRole(['super_admin', 'department_admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, role, department_id, assigned_grade, assigned_group, password } = req.body;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다' });
        }

        // 부서 관리자 권한 검증
        if (req.user.role === 'department_admin') {
            // 자기 부서 사용자만 수정 가능
            if (user.department_id !== req.user.department_id) {
                return res.status(403).json({ error: '자신의 부서 사용자만 수정할 수 있습니다' });
            }
            // 부서 변경 불가
            if (department_id && parseInt(department_id) !== req.user.department_id) {
                return res.status(403).json({ error: '다른 부서로 이동할 수 없습니다' });
            }
            // 역할 변경 불가 (teacher만 유지)
            if (role && role !== 'teacher') {
                return res.status(403).json({ error: '역할을 변경할 수 없습니다' });
            }
        }

        user.name = name;
        user.role = role;
        user.department_id = department_id ? parseInt(department_id) : null;
        user.assigned_grade = assigned_grade || null;
        user.assigned_group = assigned_group || null;

        if (password) {
            user.password = await bcrypt.hash(password, 10);
        }

        await user.save();
        res.json({ message: '사용자 정보가 수정되었습니다' });
    } catch (error) {
        console.error('사용자 수정 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// 사용자 삭제 (관리자용)
router.delete('/users/:id', authenticateToken, authorizeRole(['super_admin', 'department_admin']), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (id === req.user.id) {
            return res.status(400).json({ error: '자기 자신은 삭제할 수 없습니다' });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다' });
        }

        // 부서 관리자는 자기 부서 사용자만 삭제 가능
        if (req.user.role === 'department_admin') {
            if (user.department_id !== req.user.department_id) {
                return res.status(403).json({ error: '자신의 부서 사용자만 삭제할 수 있습니다' });
            }
        }

        await User.findByIdAndDelete(id);
        res.json({ message: '사용자가 삭제되었습니다' });
    } catch (error) {
        res.status(500).json({ error: '서버 오류' });
    }
});

module.exports = router;
