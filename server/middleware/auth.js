const jwt = require('jsonwebtoken');

// JWT 토큰 검증 미들웨어
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: '인증 토큰이 필요합니다' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: '유효하지 않은 토큰입니다' });
        }
        req.user = user;
        next();
    });
}

// 특정 역할 권한 확인 (배열 지원)
function authorizeRole(roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: '인증이 필요합니다' });
        }
        if (typeof roles === 'string') {
            roles = [roles];
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: '접근 권한이 없습니다' });
        }
        next();
    };
}

// 총괄 관리자 권한 확인 미들웨어
function requireSuperAdmin(req, res, next) {
    if (req.user.role !== 'super_admin') {
        return res.status(403).json({ error: '총괄 관리자 권한이 필요합니다' });
    }
    next();
}

// 부서 관리자 이상 권한 확인 미들웨어
function requireDepartmentAdmin(req, res, next) {
    if (req.user.role !== 'super_admin' && req.user.role !== 'department_admin') {
        return res.status(403).json({ error: '관리자 권한이 필요합니다' });
    }
    next();
}

// 관리자 권한 확인 미들웨어 (하위 호환성)
function requireAdmin(req, res, next) {
    if (req.user.role !== 'super_admin' && req.user.role !== 'department_admin' && req.user.role !== 'admin') {
        return res.status(403).json({ error: '관리자 권한이 필요합니다' });
    }
    next();
}

// 부서 접근 권한 확인 미들웨어
function checkDepartmentAccess(req, res, next) {
    const departmentId = parseInt(req.params.departmentId || req.body.department_id || req.query.department_id);

    // 총괄 관리자는 모든 부서 접근 가능
    if (req.user.role === 'super_admin') {
        return next();
    }

    // 부서 관리자/일반 사용자는 자신의 부서만 접근 가능
    if (req.user.department_id && req.user.department_id === departmentId) {
        return next();
    }

    return res.status(403).json({ error: '해당 부서에 접근 권한이 없습니다' });
}

// 교사 이상 권한 확인
function requireTeacher(req, res, next) {
    if (['super_admin', 'department_admin', 'teacher', 'admin'].includes(req.user.role)) {
        return next();
    }
    return res.status(403).json({ error: '접근 권한이 없습니다' });
}

// 그룹 리더 권한 체크 미들웨어
async function authorizeGroupLeader(req, res, next) {
    try {
        const Group = require('../models/Group');
        const MemberGroup = require('../models/MemberGroup');

        // 관리자는 모든 접근 허용
        if (req.user.role === 'super_admin' || req.user.role === 'admin') {
            return next();
        }

        // 그룹 리더인지 확인
        const userGroups = await Group.find({ leader_id: req.user.id });

        if (userGroups.length === 0) {
            return res.status(403).json({ error: '그룹 리더 권한이 없습니다' });
        }

        // 요청에 그룹 정보 추가
        req.userGroups = userGroups;
        req.userGroupIds = userGroups.map(g => g._id);

        // 그룹 멤버 ID 목록 가져오기
        const memberGroups = await MemberGroup.find({
            group_id: { $in: req.userGroupIds }
        });
        req.groupMemberIds = memberGroups.map(mg => mg.member_id);

        next();
    } catch (error) {
        console.error('그룹 리더 권한 체크 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
}

module.exports = {
    authenticateToken,
    authorizeRole,
    authorizeGroupLeader,
    requireAdmin,
    requireSuperAdmin,
    requireDepartmentAdmin,
    requireTeacher,
    checkDepartmentAccess
};
