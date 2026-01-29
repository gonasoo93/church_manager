// 관리자 페이지 초기화
async function initAdmin() {
  const view = document.getElementById('admin-view');

  if (state.user.role !== 'super_admin' && state.user.role !== 'department_admin' && state.user.role !== 'admin') {
    view.innerHTML = '<div class="card"><p class="text-center">관리자 권한이 필요합니다</p></div>';
    return;
  }

  view.innerHTML = `
    <div class="view-header">
      <h2>관리자 설정</h2>
    </div>

    <div class="tabs">
      <button class="tab-btn active" data-tab="users">사용자 관리</button>
      <button class="tab-btn" data-tab="visits">전체 심방 기록</button>
    </div>

    <!-- 사용자 관리 탭 -->
    <div id="users-tab" class="tab-content active">
        <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3>사용자 목록</h3>
                <button class="btn btn-primary" id="add-user-btn">
                    <span>➕</span> <span>사용자 추가</span>
                </button>
            </div>
            <div class="table-container">
                <table>
                <thead>
                    <tr>
                    <th>아이디</th>
                    <th>이름</th>
                    <th>역할</th>
                    <th>담당</th>
                    <th>가입일</th>
                    <th>작업</th>
                    </tr>
                </thead>
                <tbody id="users-table-body">
                    <tr><td colspan="6" class="text-center">로딩 중...</td></tr>
                </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- 심방 기록 탭 -->
    <div id="visits-tab" class="tab-content">
        <div class="card">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3>심방 기록 목록</h3>
                <div id="visits-filter-container"></div>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>날짜</th>
                            <th>부서</th>
                            <th>학생</th>
                            <th>담당교사</th>
                            <th>구분</th>
                            <th>내용</th>
                        </tr>
                    </thead>
                    <tbody id="all-visits-table-body">
                         <tr><td colspan="6" class="text-center">데이터를 불러오는 중...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  `;

  // 탭 전환 이벤트
  view.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // 탭 버튼 활성화
      view.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // 탭 컨텐츠 활성화
      view.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      const tabId = `${btn.dataset.tab}-tab`;
      document.getElementById(tabId).classList.add('active');

      // 데이터 로드 (필요시)
      if (btn.dataset.tab === 'visits') {
        loadAllVisits();
      } else {
        loadUsers();
      }
    });
  });

  document.getElementById('add-user-btn').addEventListener('click', showUserForm);

  // 초기 로드
  await loadUsers();
}

// 사용자 목록 로드
async function loadUsers() {
  try {
    const users = await apiRequest('/auth/users');
    renderUsers(users);
  } catch (error) {
    console.error('사용자 목록 로드 오류:', error);
  }
}

// 사용자 목록 렌더링
function renderUsers(users) {
  const tbody = document.getElementById('users-table-body');

  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">사용자가 없습니다</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(user => `
    <tr>
      <td><strong>${user.username}</strong></td>
      <td>${user.name}</td>
      <td>
        <span style="padding: 0.25rem 0.75rem; background: ${user.role === 'super_admin' ? '#667eea' :
      user.role === 'department_admin' ? 'var(--primary)' :
        'var(--bg-tertiary)'
    }; color: ${user.role === 'super_admin' || user.role === 'department_admin' ? 'white' : 'var(--text-primary)'
    }; border-radius: var(--radius-sm); font-size: 0.875rem;">
          ${user.role === 'super_admin' ? '총괄 관리자' :
      user.role === 'department_admin' ? '부서 관리자' :
        '일반 사용자'
    }
        </span>
      </td>
      <td>${user.assigned_grade ? user.assigned_grade + (user.assigned_group ? ' ' + user.assigned_group : '') : '-'}</td>
      <td>${formatDate(user.created_at)}</td>
      <td>
        ${user.id !== state.user.id ? `
          <button class="btn btn-danger btn-sm" onclick="deleteUser(${user.id})">삭제</button>
        ` : '<span style="color: var(--text-muted);">본인</span>'}
      </td>
    </tr>
  `).join('');
}

// 사용자 추가 폼
async function showUserForm() { // async 추가
  let departments = [];
  try {
    departments = await apiRequest('/departments');
  } catch (error) {
    console.error('부서 목록 로드 실패:', error);
  }

  const content = `
    <form id="user-form">
      <div class="form-group">
        <label for="user-username">아이디 *</label>
        <input type="text" id="user-username" required autocomplete="off">
      </div>
      <div class="form-group">
        <label for="user-password">비밀번호 *</label>
        <input type="password" id="user-password" required autocomplete="new-password">
      </div>
      <div class="form-group">
        <label for="user-name">이름 *</label>
        <input type="text" id="user-name" required>
      </div>
      <div class="form-group">
        <label for="user-role">역할</label>
        <select id="user-role">
          <option value="teacher">교사</option>
          <option value="department_admin">부서 관리자</option>
          <option value="super_admin">총괄 관리자</option>
        </select>
      </div>
      <div class="form-group" id="dept-group" style="display: none;">
        <label for="user-dept">담당 부서</label>
        <select id="user-dept">
          <option value="">부서 선택</option>
          ${departments.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" id="assignment-group" style="display: none;">
        <label>담당 정보 (교사)</label>
        <div style="display: flex; gap: 0.5rem;">
          <input type="text" id="user-grade" placeholder="학년 (예: 중1)" style="flex: 1;">
          <input type="text" id="user-group" placeholder="반 (예: 1반)" style="flex: 1;">
        </div>
      </div>
    </form>
  `;

  const modal = createModal('사용자 추가', content, [
    { text: '취소', class: 'btn-secondary', action: 'cancel' },
    { text: '추가', class: 'btn-primary', action: 'submit' }
  ]);

  const roleSelect = modal.querySelector('#user-role');
  const deptGroup = modal.querySelector('#dept-group');

  const assignmentGroup = modal.querySelector('#assignment-group');

  // 역할 변경 시 부서 선택 표시 토글
  roleSelect.addEventListener('change', (e) => {
    const role = e.target.value;
    if (['department_admin', 'teacher', 'user'].includes(role)) {
      deptGroup.style.display = 'block';
    } else {
      deptGroup.style.display = 'none';
      modal.querySelector('#user-dept').value = '';
    }

    if (role === 'teacher' || role === 'user') {
      assignmentGroup.style.display = 'block';
    } else {
      assignmentGroup.style.display = 'none';
      modal.querySelector('#user-grade').value = '';
      modal.querySelector('#user-group').value = '';
    }
  });

  // 초기 상태 설정 (기본이 user이므로 표시)
  deptGroup.style.display = 'block';

  modal.querySelector('[data-action="cancel"]').addEventListener('click', () => {
    closeModal(modal);
  });

  modal.querySelector('[data-action="submit"]').addEventListener('click', async () => {
    const username = modal.querySelector('#user-username').value.trim();
    const password = modal.querySelector('#user-password').value.trim();
    const name = modal.querySelector('#user-name').value.trim();
    const role = modal.querySelector('#user-role').value;
    const departmentId = modal.querySelector('#user-dept').value;
    const assignedGrade = modal.querySelector('#user-grade').value.trim();
    const assignedGroup = modal.querySelector('#user-group').value.trim();

    // 클라이언트 측 검증
    if (!username || !password || !name) {
      alert('아이디, 비밀번호, 이름은 필수 입력 항목입니다.');
      return;
    }

    const formData = {
      username,
      password,
      name,
      role,
      department_id: departmentId ? parseInt(departmentId) : null,
      assigned_grade: assignedGrade || null,
      assigned_group: assignedGroup || null
    };

    try {
      await apiRequest('/auth/users', {
        method: 'POST',
        body: JSON.stringify(formData)
      });

      closeModal(modal);
      await loadUsers();
      alert('사용자가 추가되었습니다');
    } catch (error) {
      alert(error.message);
    }
  });
}

// 사용자 삭제
async function deleteUser(id) {
  if (!confirm('정말 삭제하시겠습니까?')) return;

  try {
    await apiRequest(`/auth/users/${id}`, { method: 'DELETE' });
    await loadUsers();
  } catch (error) {
    alert(error.message);
  }
}

// 전체 심방 기록 로드
async function loadAllVisits() {
  try {
    const tbody = document.getElementById('all-visits-table-body');
    if (!tbody) return;

    // 필터 UI (총괄 관리자용)
    const filterContainer = document.getElementById('visits-filter-container');
    // 필터가 비어있고 총괄 관리자일 때만 생성
    if (state.user.role === 'super_admin' && filterContainer && filterContainer.innerHTML === '') {
      const departments = await apiRequest('/departments');
      filterContainer.innerHTML = `
                <select id="visit-dept-filter" style="padding: 0.5rem; border-radius: 0.25rem; border: 1px solid #ddd;">
                    <option value="all">전체 부서</option>
                    ${departments.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
                </select>
            `;

      document.getElementById('visit-dept-filter').addEventListener('change', (e) => {
        loadAllVisitsFiltered(e.target.value);
      });
    }

    await loadAllVisitsFiltered('all');

  } catch (error) {
    console.error('심방 기록 로드 실패:', error);
  }
}

// 필터링된 기록 로드
async function loadAllVisitsFiltered(deptId) {
  const tbody = document.getElementById('all-visits-table-body');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" class="text-center">로딩 중...</td></tr>';

  try {
    let url = '/visits';
    if (deptId && deptId !== 'all') {
      url += `?department_id=${deptId}`;
    }

    const visits = await apiRequest(url);

    const members = await apiRequest('/members');
    const deptMap = {};
    const depts = await apiRequest('/departments');
    depts.forEach(d => deptMap[d.id] = d.name);

    const memberDeptMap = {};
    members.forEach(m => {
      memberDeptMap[m.id] = deptMap[m.department_id] || '-';
    });

    if (visits.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">기록이 없습니다</td></tr>';
      return;
    }

    tbody.innerHTML = visits.map(v => `
            <tr>
                <td>${formatDate(v.date)}</td>
                <td><span class="badge" style="background:var(--bg-tertiary); padding: 2px 6px; border-radius:4px; font-size:0.8em;">${memberDeptMap[v.member_id] || '-'}</span></td>
                <td><strong>${v.member_name}</strong></td>
                <td>${v.teacher_name}</td>
                <td>${v.type}</td>
                <td><div style="max-width:300px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${v.content}">${v.content}</div></td>
            </tr>
        `).join('');

  } catch (e) {
    console.error(e);
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">정보를 불러오지 못했습니다</td></tr>';
  }
}
