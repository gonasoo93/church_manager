// 로그인 처리
async function login(username, password) {
    try {
        const data = await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });

        saveToken(data.token);
        state.user = data.user;

        // 사용자 정보 표시
        updateUserInfo();

        // 앱 페이지로 전환
        showPage('app');
        initApp();

    } catch (error) {
        throw error;
    }
}

// 로그아웃
function logout() {
    clearToken();
    state.user = null;
    showPage('login');
}

// 인증 확인
async function checkAuth() {
    try {
        const user = await apiRequest('/auth/me');
        state.user = user;
        updateUserInfo();
        showPage('app');
        initApp();
    } catch (error) {
        console.error('인증 확인 실패:', error);
        clearToken();
        showPage('login');
    }
}

// 사용자 정보 업데이트
function updateUserInfo() {
    if (!state.user) return;

    // 1. 브랜드 텍스트 업데이트 (부서명)
    const brandName = document.querySelector('.navbar-brand span');
    if (brandName) {
        // 부서 이름이 있으면 그 이름으로, 없으면 역할에 따라 표시
        const deptName = state.user.department_name || (state.user.role === 'super_admin' ? '교회학교 통합관리' : '청소년교회');
        brandName.textContent = deptName;
        document.title = `${deptName} 관리 시스템`;
    }

    // 2. 사용자 정보 표시 업데이트
    const userName = document.getElementById('user-name');
    const userRole = document.getElementById('user-role');

    if (userName) userName.textContent = state.user.name;

    if (userRole) {
        // 역할 텍스트 설정
        let roleText = '일반';
        if (state.user.role === 'super_admin') roleText = '총괄 관리자';
        else if (state.user.role === 'department_admin') roleText = '부서 관리자';
        else if (state.user.department_name) roleText = state.user.department_name; // 부서명 표시

        userRole.textContent = roleText;

        // 역할 뱃지 스타일
        if (state.user.role === 'super_admin' || state.user.role === 'department_admin') {
            userRole.style.backgroundColor = state.user.role === 'super_admin' ? '#667eea' : 'var(--primary)';
            userRole.style.color = 'white';
            userRole.style.padding = '0.2rem 0.6rem';
            userRole.style.borderRadius = '12px';
            userRole.style.fontSize = '0.8rem';
        } else {
            userRole.style.backgroundColor = 'transparent';
            userRole.style.color = 'var(--text-secondary)';
            userRole.style.padding = '0';
        }
    }

    // 3. 그룹 리더 메뉴 표시 확인
    checkGroupLeaderStatus();
}

// 그룹 리더 여부 확인 및 메뉴 표시
async function checkGroupLeaderStatus() {
    try {
        console.log('[그룹 리더 체크] 시작, 사용자 ID:', state.user?.id);

        // 모든 그룹 조회
        const groups = await apiRequest('/features/groups');
        console.log('[그룹 리더 체크] 전체 그룹:', groups);

        // 내가 리더인 그룹이 있는지 확인
        const myGroups = groups.filter(g => {
            // leader_id가 객체일 수도 있고 숫자일 수도 있음
            const leaderId = typeof g.leader_id === 'object' ? g.leader_id?.id || g.leader_id?._id : g.leader_id;
            return leaderId === state.user.id;
        });
        console.log('[그룹 리더 체크] 내가 리더인 그룹:', myGroups);

        // 그룹 리더 메뉴 표시/숨김
        const groupLeaderMenu = document.querySelector('.group-leader-only');
        console.log('[그룹 리더 체크] 메뉴 요소:', groupLeaderMenu);

        if (groupLeaderMenu) {
            if (myGroups.length > 0) {
                groupLeaderMenu.style.display = 'flex';
                console.log('[그룹 리더 체크] ✅ 메뉴 표시됨!');
            } else {
                groupLeaderMenu.style.display = 'none';
                console.log('[그룹 리더 체크] ❌ 리더 아님, 메뉴 숨김');
            }
        }
    } catch (error) {
        console.error('그룹 리더 상태 확인 오류:', error);
    }
}

// 로그인 폼 이벤트
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            await login(username, password);
        } catch (error) {
            showError(error.message, loginError);
        }
    });
});
