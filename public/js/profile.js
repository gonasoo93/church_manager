// 프로필 페이지 초기화
async function initProfile() {
    const view = document.getElementById('profile-view');

    view.innerHTML = `
    <div class="view-header">
      <h2>내 프로필</h2>
    </div>
    <div class="card">
      <h3>기본 정보</h3>
      <div id="profile-info" style="display: grid; gap: 1rem;">
        <p class="text-center">로딩 중...</p>
      </div>
    </div>
    <div class="card mt-2">
      <h3>정보 수정</h3>
      <form id="profile-form">
        <div class="form-group">
          <label for="profile-name">이름</label>
          <input type="text" id="profile-name" required>
        </div>
        <div class="form-group">
          <label for="current-password">현재 비밀번호 (비밀번호 변경 시 필수)</label>
          <input type="password" id="current-password" autocomplete="current-password">
        </div>
        <div class="form-group">
          <label for="new-password">새 비밀번호</label>
          <input type="password" id="new-password" autocomplete="new-password">
        </div>
        <div class="form-group">
          <label for="confirm-password">새 비밀번호 확인</label>
          <input type="password" id="confirm-password" autocomplete="new-password">
        </div>
        <button type="submit" class="btn btn-primary">저장</button>
      </form>
    </div>
  `;

    // 프로필 정보 로드
    await loadProfileInfo();

    // 폼 제출 이벤트
    document.getElementById('profile-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await updateProfile();
    });
}

// 프로필 정보 로드
async function loadProfileInfo() {
    try {
        const user = await apiRequest('/auth/me');

        // 부서 정보 가져오기
        let departmentName = '-';
        if (user.department_id) {
            try {
                const department = await apiRequest(`/departments/${user.department_id}`);
                departmentName = department.name;
            } catch (error) {
                console.error('부서 정보 로드 오류:', error);
            }
        }

        // 역할 한글 변환
        const roleMap = {
            'super_admin': '총괄 관리자',
            'department_admin': '부서 관리자',
            'admin': '관리자',
            'user': '일반 사용자'
        };

        const infoContainer = document.getElementById('profile-info');
        infoContainer.innerHTML = `
      <div style="display: grid; grid-template-columns: 150px 1fr; gap: 1rem;">
        <div style="color: var(--text-secondary);">아이디</div>
        <div><strong>${user.username}</strong></div>
        
        <div style="color: var(--text-secondary);">이름</div>
        <div><strong>${user.name}</strong></div>
        
        <div style="color: var(--text-secondary);">역할</div>
        <div>
          <span style="padding: 0.25rem 0.75rem; background: ${user.role === 'super_admin' ? 'var(--primary)' : 'var(--bg-tertiary)'}; border-radius: var(--radius-sm); font-size: 0.875rem;">
            ${roleMap[user.role] || user.role}
          </span>
        </div>
        
        <div style="color: var(--text-secondary);">소속 부서</div>
        <div><strong>${departmentName}</strong></div>
        
        <div style="color: var(--text-secondary);">가입일</div>
        <div>${formatDate(user.created_at)}</div>
      </div>
    `;

        // 폼에 현재 이름 설정
        document.getElementById('profile-name').value = user.name;

    } catch (error) {
        console.error('프로필 정보 로드 오류:', error);
        document.getElementById('profile-info').innerHTML = '<p class="text-center">프로필 정보를 불러올 수 없습니다</p>';
    }
}

// 프로필 업데이트
async function updateProfile() {
    const name = document.getElementById('profile-name').value.trim();
    const currentPassword = document.getElementById('current-password').value.trim();
    const newPassword = document.getElementById('new-password').value.trim();
    const confirmPassword = document.getElementById('confirm-password').value.trim();

    // 비밀번호 변경 검증
    if (newPassword || confirmPassword) {
        if (!currentPassword) {
            alert('현재 비밀번호를 입력해주세요');
            return;
        }

        if (newPassword !== confirmPassword) {
            alert('새 비밀번호가 일치하지 않습니다');
            return;
        }

        if (newPassword.length < 6) {
            alert('새 비밀번호는 최소 6자 이상이어야 합니다');
            return;
        }
    }

    const data = {
        name
    };

    if (newPassword) {
        data.current_password = currentPassword;
        data.new_password = newPassword;
    }

    try {
        await apiRequest('/auth/profile', {
            method: 'PUT',
            body: JSON.stringify(data)
        });

        alert('프로필이 수정되었습니다');

        // 이름이 변경되었으면 상태 업데이트
        if (state.user.name !== name) {
            state.user.name = name;
            updateUserDisplay();
        }

        // 비밀번호 필드 초기화
        document.getElementById('current-password').value = '';
        document.getElementById('new-password').value = '';
        document.getElementById('confirm-password').value = '';

        // 프로필 정보 다시 로드
        await loadProfileInfo();

    } catch (error) {
        alert(error.message);
    }
}
