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
