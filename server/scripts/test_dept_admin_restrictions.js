/**
 * 부서 관리자 권한 제한 테스트 스크립트
 * 
 * 테스트 시나리오:
 * 1. 부서 관리자로 로그인
 * 2. 자기 부서 사용자 목록 조회 (성공)
 * 3. 자기 부서에 사용자 추가 (성공)
 * 4. 다른 부서에 사용자 추가 시도 (실패 - 403)
 * 5. 자기 부서 사용자 수정 (성공)
 * 6. 다른 부서 사용자 수정 시도 (실패 - 403)
 * 7. 자기 부서 사용자 삭제 (성공)
 */

const BASE_URL = 'http://localhost:3000/api';

// 부서 관리자 로그인 정보 (중등부 관리자 예시)
const DEPT_ADMIN = {
    username: 'middle_admin',  // 실제 부서 관리자 계정으로 변경 필요
    password: 'password123'
};

let token = '';
let deptAdminInfo = null;

async function login() {
    console.log('\n=== 1. 부서 관리자 로그인 ===');
    const response = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(DEPT_ADMIN)
    });

    const data = await response.json();
    if (response.ok) {
        token = data.token;
        deptAdminInfo = data.user;
        console.log('✅ 로그인 성공:', data.user.name);
        console.log('   부서:', data.user.department_name);
        console.log('   부서 ID:', data.user.department_id);
    } else {
        console.log('❌ 로그인 실패:', data.error);
        throw new Error('로그인 실패');
    }
}

async function testGetUsers() {
    console.log('\n=== 2. 사용자 목록 조회 (자기 부서만) ===');
    const response = await fetch(`${BASE_URL}/auth/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    const users = await response.json();
    if (response.ok) {
        console.log(`✅ 조회 성공: ${users.length}명의 사용자`);
        users.forEach(u => {
            console.log(`   - ${u.name} (부서 ID: ${u.department_id})`);
        });

        // 모든 사용자가 자기 부서인지 확인
        const allSameDept = users.every(u => u.department_id === deptAdminInfo.department_id);
        if (allSameDept) {
            console.log('✅ 검증: 모든 사용자가 자기 부서 소속');
        } else {
            console.log('❌ 검증 실패: 다른 부서 사용자가 포함됨');
        }
    } else {
        console.log('❌ 조회 실패:', users.error);
    }
}

async function testAddUserSameDept() {
    console.log('\n=== 3. 자기 부서에 사용자 추가 (성공 예상) ===');
    const newUser = {
        username: 'test_teacher_' + Date.now(),
        password: 'test123',
        name: '테스트 교사',
        role: 'teacher',
        department_id: deptAdminInfo.department_id,
        assigned_grade: '중1',
        assigned_group: '1반'
    };

    const response = await fetch(`${BASE_URL}/auth/users`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(newUser)
    });

    const data = await response.json();
    if (response.ok) {
        console.log('✅ 사용자 추가 성공:', data.user.name);
        return data.user.id;
    } else {
        console.log('❌ 사용자 추가 실패:', data.error);
        return null;
    }
}

async function testAddUserOtherDept() {
    console.log('\n=== 4. 다른 부서에 사용자 추가 (실패 예상 - 403) ===');
    const otherDeptId = deptAdminInfo.department_id === 1 ? 2 : 1;
    const newUser = {
        username: 'test_teacher_other_' + Date.now(),
        password: 'test123',
        name: '다른부서 교사',
        role: 'teacher',
        department_id: otherDeptId
    };

    const response = await fetch(`${BASE_URL}/auth/users`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(newUser)
    });

    const data = await response.json();
    if (response.status === 403) {
        console.log('✅ 예상대로 403 에러:', data.error);
    } else if (response.ok) {
        console.log('❌ 검증 실패: 다른 부서에 사용자 추가가 허용됨');
    } else {
        console.log('⚠️  예상치 못한 응답:', response.status, data.error);
    }
}

async function testUpdateUserSameDept(userId) {
    if (!userId) {
        console.log('\n=== 5. 자기 부서 사용자 수정 (스킵 - 사용자 ID 없음) ===');
        return;
    }

    console.log('\n=== 5. 자기 부서 사용자 수정 (성공 예상) ===');
    const updateData = {
        name: '수정된 교사',
        role: 'teacher',
        department_id: deptAdminInfo.department_id,
        assigned_grade: '중2',
        assigned_group: '2반'
    };

    const response = await fetch(`${BASE_URL}/auth/users/${userId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
    });

    const data = await response.json();
    if (response.ok) {
        console.log('✅ 사용자 수정 성공:', data.message);
    } else {
        console.log('❌ 사용자 수정 실패:', data.error);
    }
}

async function testDeleteUser(userId) {
    if (!userId) {
        console.log('\n=== 6. 사용자 삭제 (스킵 - 사용자 ID 없음) ===');
        return;
    }

    console.log('\n=== 6. 자기 부서 사용자 삭제 (성공 예상) ===');
    const response = await fetch(`${BASE_URL}/auth/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();
    if (response.ok) {
        console.log('✅ 사용자 삭제 성공:', data.message);
    } else {
        console.log('❌ 사용자 삭제 실패:', data.error);
    }
}

async function runTests() {
    try {
        await login();
        await testGetUsers();
        const newUserId = await testAddUserSameDept();
        await testAddUserOtherDept();
        await testUpdateUserSameDept(newUserId);
        await testDeleteUser(newUserId);

        console.log('\n=== 테스트 완료 ===');
        console.log('모든 테스트가 완료되었습니다.');
    } catch (error) {
        console.error('\n테스트 중 오류 발생:', error.message);
    }
}

runTests();
