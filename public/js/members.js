// 명부 관리 초기화
async function initMembers() {
  const view = document.getElementById('members-view');

  // 부서명 또는 기본값 설정
  const deptName = state.user?.department_name || (state.user?.role === 'super_admin' ? '학생' : '부원');
  // '부'로 끝나면 그 뒤에 붙일 호칭을 정하는게 자연스러움 (예: 유아부 -> 유아부원, 청년부 -> 청년부원)
  // 여기서는 단순히 부서명이 있으면 부서명 사용, 없으면 '학생'

  // 부서 선택 필터 UI (총괄 관리자용)
  let deptFilterHtml = '';
  if (state.user.role === 'super_admin') {
    deptFilterHtml = `
          <div style="flex: 1; min-width: 150px;">
              <select id="member-department-filter" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg-tertiary); color: var(--text-primary);">
                <option value="all">전체 부서</option>
              </select>
          </div>
      `;
  }

  view.innerHTML = `
    <div class="view-header">
      <h2>명부 관리</h2>
      <div style="display: flex; gap: 0.5rem;">
        <button class="btn btn-secondary" id="export-members-btn">
          <span>📥</span>
          <span>Excel 내보내기</span>
        </button>
        <button class="btn btn-primary" id="add-member-btn">
          <span>➕</span>
          <span>${deptName} 등록</span>
        </button>
      </div>
    </div>
    <div class="card">
      <div class="form-group" style="display: flex; gap: 0.5rem;">
        ${deptFilterHtml}
        <input type="text" id="member-search" placeholder="이름으로 검색..." style="flex: 2;">
      </div>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>이름</th>
              <th>생년월일</th>
              <th>학년</th>
              <th>부서</th>
              <th>상태</th>
              <th>연락처</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody id="members-table-body">
            <tr><td colspan="6" class="text-center">로딩 중...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  // 이벤트 리스너
  document.getElementById('add-member-btn').addEventListener('click', () => showMemberForm());
  document.getElementById('export-members-btn').addEventListener('click', exportMembersToExcel);
  document.getElementById('member-search').addEventListener('input', filterMembers);

  // 부서 필터 리스너 (총괄 관리자용)
  const deptSelect = document.getElementById('member-department-filter');
  if (deptSelect) {
    // 부서 목록 로드
    try {
      const departments = await apiRequest('/departments');
      departments.forEach(dept => {
        const option = document.createElement('option');
        option.value = dept.id;
        option.textContent = dept.name;
        deptSelect.appendChild(option);
      });
    } catch (e) { console.error('부서 로드 실패', e); }

    deptSelect.addEventListener('change', loadMembers);
  }

  // 명부 로드
  await loadMembers();
}

// 명부 로드
let allMembers = [];

async function loadMembers() {
  try {
    // 부서 필터 확인
    const deptSelect = document.getElementById('member-department-filter');
    const department_id = deptSelect ? deptSelect.value : null;

    let url = '/members';
    if (department_id && department_id !== 'all') {
      url += `?department_id=${department_id}`;
    }

    allMembers = await apiRequest(url);
    renderMembers(allMembers);
  } catch (error) {
    console.error('명부 로드 오류:', error);
  }
}

// 명부 렌더링
function renderMembers(members) {
  const tbody = document.getElementById('members-table-body');
  const deptName = state.user?.department_name || '학생';

  if (members.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center">등록된 ${deptName}이(가) 없습니다</td></tr>`;
    return;
  }

  tbody.innerHTML = members.map(member => `
    <tr>
      <td><strong style="cursor: pointer; color: var(--primary);" onclick="showMemberDetail(${member.id})">${member.name}</strong></td>
      <td>${member.birth_date || '-'}</td>
      <td>${member.grade || '-'}</td>
      <td>${member.department || '-'}</td>
      <td>
        ${member.status === 'long_term_absent'
      ? '<span style="padding: 0.25rem 0.5rem; border-radius: 999px; background: var(--danger); color: white; font-size: 0.75rem;">장기결석</span>'
      : '<span style="padding: 0.25rem 0.5rem; border-radius: 999px; background: var(--success); color: white; font-size: 0.75rem;">일반</span>'}
      </td>
      <td>${member.phone || '-'}</td>
      <td>
        <button class="btn btn-secondary btn-sm" data-action="edit" data-id="${member.id}">수정</button>
        <button class="btn btn-danger btn-sm" data-action="delete" data-id="${member.id}">삭제</button>
      </td>
    </tr>
  `).join('');

  // 이벤트 위임으로 수정/삭제 버튼 처리
  tbody.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      const id = e.target.dataset.id;
      if (action === 'edit') {
        editMember(id);
      } else if (action === 'delete') {
        deleteMember(id);
      }
    });
  });
}

// 명부 검색
function filterMembers(e) {
  const search = e.target.value.toLowerCase();
  const filtered = allMembers.filter(m =>
    m.name.toLowerCase().includes(search)
  );
  renderMembers(filtered);
}

// 명부 등록/수정 폼
async function showMemberForm(member = null) { // async 추가
  const isEdit = !!member;
  // 부서명 또는 기본값 설정
  const deptName = state.user?.department_name || (state.user?.role === 'super_admin' ? '학생' : '부원');
  const title = isEdit ? `${deptName} 정보 수정` : `${deptName} 등록`;

  let departments = [];
  try {
    departments = await apiRequest('/departments');
  } catch (err) {
    console.error('부서 목록 로드 실패', err);
  }

  // 현재 로그인한 사용자의 권한 확인
  const isSuperAdmin = state.user.role === 'super_admin';
  const userDeptId = state.user.department_id;
  const userDeptName = state.user.department_name || '소속 부서';

  // 부서 선택 HTML 생성
  let departmentHtml = '';

  if (isSuperAdmin) {
    // 총괄 관리자는 부서 선택 가능
    const options = departments.map(d =>
      `<option value="${d.id}" ${member?.department_id === d.id ? 'selected' : ''}>${d.name}</option>`
    ).join('');

    departmentHtml = `
        <div class="form-group">
            <label for="member-department-id">소속 부서</label>
            <select id="member-department-id">
                <option value="">부서 선택</option>
                ${options}
            </select>
        </div>
      `;
  } else {
    // 부서 관리자/일반 사용자는 본인 부서 고정
    // 수정 시에도 본인 부서 외의 멤버는 수정 권한이 없으므로(서버에서 막음) 안전하지만, UI에서도 보여줌
    departmentHtml = `
        <div class="form-group">
            <label>소속 부서</label>
            <input type="text" value="${userDeptName}" disabled style="background-color: var(--bg-tertiary); color: var(--text-secondary);">
            <input type="hidden" id="member-department-id" value="${userDeptId || ''}">
            <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.25rem;">* 자동으로 ${userDeptName}로 배정됩니다.</p>
        </div>
      `;
  }

  const content = `
    <form id="member-form">
      <div class="form-group">
        <label for="member-name">이름 *</label>
        <input type="text" id="member-name" required value="${member?.name || ''}">
      </div>
      <div class="form-group">
        <label for="member-birth">생년월일</label>
        <input type="date" id="member-birth" value="${member?.birth_date || ''}">
      </div>
      <div class="form-group">
        <label for="member-phone">연락처</label>
        <input type="tel" id="member-phone" value="${member?.phone || ''}">
      </div>
      <div class="form-group">
        <label for="member-parent-phone">부모님 연락처</label>
        <input type="tel" id="member-parent-phone" value="${member?.parent_phone || ''}">
      </div>
      <div class="form-group">
        <label for="member-grade">학년</label>
        <select id="member-grade">
          <option value="">선택</option>
          <option value="영아" ${member?.grade === '영아' ? 'selected' : ''}>영아</option>
          <option value="유아" ${member?.grade === '유아' ? 'selected' : ''}>유아</option>
          <option value="유치" ${member?.grade === '유치' ? 'selected' : ''}>유치</option>
          <option value="초1" ${member?.grade === '초1' ? 'selected' : ''}>초1</option>
          <option value="초2" ${member?.grade === '초2' ? 'selected' : ''}>초2</option>
          <option value="초3" ${member?.grade === '초3' ? 'selected' : ''}>초3</option>
          <option value="초4" ${member?.grade === '초4' ? 'selected' : ''}>초4</option>
          <option value="초5" ${member?.grade === '초5' ? 'selected' : ''}>초5</option>
          <option value="초6" ${member?.grade === '초6' ? 'selected' : ''}>초6</option>
          <option value="중1" ${member?.grade === '중1' ? 'selected' : ''}>중1</option>
          <option value="중2" ${member?.grade === '중2' ? 'selected' : ''}>중2</option>
          <option value="중3" ${member?.grade === '중3' ? 'selected' : ''}>중3</option>
          <option value="고1" ${member?.grade === '고1' ? 'selected' : ''}>고1</option>
          <option value="고2" ${member?.grade === '고2' ? 'selected' : ''}>고2</option>
          <option value="고3" ${member?.grade === '고3' ? 'selected' : ''}>고3</option>
          <option value="청년" ${member?.grade === '청년' ? 'selected' : ''}>청년</option>
        </select>
      </div>
      ${departmentHtml}
      <div class="form-group">
        <label>상태</label>
        <div style="display: flex; gap: 1rem;">
          <label style="display: flex; align-items: center; gap: 0.25rem; cursor: pointer;">
            <input type="radio" name="member-status" value="active" ${!member || member.status === 'active' ? 'checked' : ''}>
            일반
          </label>
          <label style="display: flex; align-items: center; gap: 0.25rem; cursor: pointer;">
            <input type="radio" name="member-status" value="long_term_absent" ${member?.status === 'long_term_absent' ? 'checked' : ''}>
            장기결석
          </label>
        </div>
      </div>
      <div class="form-group">
        <label for="member-address">주소</label>
        <input type="text" id="member-address" value="${member?.address || ''}">
      </div>
      <div class="form-group">
        <label for="member-notes">비고</label>
        <textarea id="member-notes">${member?.notes || ''}</textarea>
      </div>
    </form>
  `;

  const modal = createModal(title, content, [
    { text: '취소', class: 'btn-secondary', action: 'cancel' },
    { text: isEdit ? '수정' : '등록', class: 'btn-primary', action: 'submit' }
  ]);

  modal.querySelector('[data-action="cancel"]').addEventListener('click', () => {
    closeModal(modal);
  });

  modal.querySelector('[data-action="submit"]').addEventListener('click', async () => {
    // 부서 ID와 이름 처리
    const deptIdInput = document.getElementById('member-department-id');
    let deptId = deptIdInput.value;
    let deptName = '';

    if (deptIdInput.tagName === 'SELECT') {
      const selectedOption = deptIdInput.options[deptIdInput.selectedIndex];
      deptName = selectedOption.text;
    } else {
      // input type="hidden" 인 경우 (부서 관리자/일반 사용자)
      // 위쪽 input text에서 이름을 가져오거나 state에서 가져옴
      deptName = state.user.department_name;
    }

    const formData = {
      name: document.getElementById('member-name').value,
      birth_date: document.getElementById('member-birth').value,
      phone: document.getElementById('member-phone').value,
      parent_phone: document.getElementById('member-parent-phone').value,
      grade: document.getElementById('member-grade').value,
      department_id: deptId ? parseInt(deptId) : null,
      department: deptName, // 텍스트 호환성 유지
      status: document.querySelector('input[name="member-status"]:checked').value,
      address: document.getElementById('member-address').value,
      notes: document.getElementById('member-notes').value
    };

    try {
      if (isEdit) {
        await apiRequest(`/members/${member.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData)
        });
      } else {
        await apiRequest('/members', {
          method: 'POST',
          body: JSON.stringify(formData)
        });
      }

      closeModal(modal);
      await loadMembers();
    } catch (error) {
      alert(error.message);
    }
  });
}

// 명부 수정
async function editMember(id) {
  try {
    const member = await apiRequest(`/members/${id}`);
    showMemberForm(member);
  } catch (error) {
    alert(error.message);
  }
}

// 명부 삭제
async function deleteMember(id) {
  if (!confirm('정말 삭제하시겠습니까?')) return;

  try {
    await apiRequest(`/members/${id}`, { method: 'DELETE' });
    await loadMembers();
  } catch (error) {
    alert(error.message);
  }
}

// 학생 상세 보기 (탭 UI)
async function showMemberDetail(id) {
  try {
    const member = await apiRequest(`/members/${id}`);

    // 심방 기록 로드 (오류 발생 시 빈 배열 처리)
    let visits = [];
    try {
      visits = await apiRequest(`/visits?member_id=${id}`);
    } catch (e) { console.error('심방 기록 로드 실패', e); }

    // 현재 사용자 권한 확인
    const canDeleteVisit = (visit) => {
      const uid = state.user.id;
      const role = state.user.role;
      if (visit.teacher_id === uid) return true;
      if (role === 'super_admin') return true;
      if (role === 'department_admin' && state.user.department_id === member.department_id) return true;
      return false;
    };

    // 모달 컨텐츠 생성
    const content = `
      <div class="tabs" style="display: flex; gap: 1rem; border-bottom: 2px solid var(--border); margin-bottom: 1rem;">
        <button class="tab-btn active" data-tab="info" style="padding: 0.5rem 1rem; background: none; border: none; font-weight: 600; color: var(--primary); border-bottom: 2px solid var(--primary); cursor: pointer;">기본 정보</button>
        <button class="tab-btn" data-tab="visits" style="padding: 0.5rem 1rem; background: none; border: none; font-weight: 600; color: var(--text-secondary); cursor: pointer;">심방 기록</button>
      </div>

      <div id="tab-content-info" class="tab-content">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div><label style="color: var(--text-secondary); font-size: 0.8rem;">이름</label><div style="font-weight: 600;">${member.name}</div></div>
          <div><label style="color: var(--text-secondary); font-size: 0.8rem;">상태</label><div>${member.status === 'long_term_absent' ? '<span style="color: var(--danger);">장기결석</span>' : '<span style="color: var(--success);">일반</span>'}</div></div>
          <div><label style="color: var(--text-secondary); font-size: 0.8rem;">학년</label><div>${member.grade || '-'}</div></div>
          <div><label style="color: var(--text-secondary); font-size: 0.8rem;">생년월일</label><div>${member.birth_date || '-'}</div></div>
          <div><label style="color: var(--text-secondary); font-size: 0.8rem;">부서</label><div>${member.department || '-'}</div></div>
          <div><label style="color: var(--text-secondary); font-size: 0.8rem;">연락처</label><div>${member.phone || '-'}</div></div>
          <div><label style="color: var(--text-secondary); font-size: 0.8rem;">부모님 연락처</label><div>${member.parent_phone || '-'}</div></div>
          <div style="grid-column: span 2;"><label style="color: var(--text-secondary); font-size: 0.8rem;">주소</label><div>${member.address || '-'}</div></div>
          <div style="grid-column: span 2;"><label style="color: var(--text-secondary); font-size: 0.8rem;">비고</label><div style="white-space: pre-wrap;">${member.notes || '-'}</div></div>
        </div>
        <div style="margin-top: 1.5rem; text-align: right;">
          <button class="btn btn-secondary" id="detail-edit-btn">정보 수정</button>
        </div>
      </div>

      <div id="tab-content-visits" class="tab-content" style="display: none;">
        <div style="margin-bottom: 1rem; padding: 1rem; background: var(--bg-tertiary); border-radius: var(--radius-md);">
          <h4 style="margin-bottom: 0.5rem; font-size: 1rem;">새 기록 작성</h4>
          <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
            <input type="date" id="visit-date" value="${new Date().toISOString().split('T')[0]}" style="width: auto;">
            <select id="visit-type" style="width: auto;">
              <option value="심방">심방</option>
              <option value="상담">상담</option>
              <option value="전화">전화</option>
              <option value="특이사항">특이사항</option>
            </select>
          </div>
          <textarea id="visit-content" placeholder="내용을 입력하세요..." style="width: 100%; min-height: 80px; margin-bottom: 0.5rem; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.5rem;"></textarea>
          <div style="text-align: right;">
            <button class="btn btn-primary btn-sm" id="save-visit-btn">저장</button>
          </div>
        </div>
        
        <div id="visits-list" style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 300px; overflow-y: auto;">
          ${visits.length === 0 ? '<p class="text-center" style="color: var(--text-secondary);">기록이 없습니다.</p>' : ''}
          ${visits.map(v => `
            <div style="padding: 0.75rem; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg-primary);">
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                <div style="font-weight: 600; font-size: 0.9rem;">
                  <span style="display: inline-block; padding: 0.1rem 0.4rem; background: var(--bg-tertiary); border-radius: 4px; font-size: 0.75rem; margin-right: 0.5rem;">${v.type}</span>
                  ${v.date}
                </div>
                <div style="font-size: 0.8rem; color: var(--text-secondary);">
                  ${v.teacher_name}
                  ${canDeleteVisit(v) ?
        `<span class="delete-visit-btn" data-id="${v.id}" style="margin-left: 0.5rem; cursor: pointer; color: var(--danger);">삭제</span>` : ''}
                </div>
              </div>
              <div style="white-space: pre-wrap; font-size: 0.9rem; line-height: 1.4;">${v.content}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    const modal = createModal(`${member.name} 상세 정보`, content, [
      { text: '닫기', class: 'btn-secondary', action: 'close' }
    ]);

    // 탭 전환 로직
    const tabs = modal.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const target = e.target.dataset.tab;

        tabs.forEach(t => {
          t.style.color = 'var(--text-secondary)';
          t.style.borderBottom = 'none';
          t.classList.remove('active');
        });
        e.target.style.color = 'var(--primary)';
        e.target.style.borderBottom = '2px solid var(--primary)';
        e.target.classList.add('active');

        modal.querySelector('#tab-content-info').style.display = target === 'info' ? 'block' : 'none';
        modal.querySelector('#tab-content-visits').style.display = target === 'visits' ? 'block' : 'none';
      });
    });

    // 정보 수정 버튼
    const editBtn = modal.querySelector('#detail-edit-btn');
    editBtn.addEventListener('click', () => {
      closeModal(modal);
      showMemberForm(member);
    });

    // 심방 기록 저장
    const saveVisitBtn = modal.querySelector('#save-visit-btn');
    if (saveVisitBtn) {
      saveVisitBtn.addEventListener('click', async () => {
        const date = modal.querySelector('#visit-date').value;
        const type = modal.querySelector('#visit-type').value;
        const content = modal.querySelector('#visit-content').value;

        if (!content.trim()) {
          alert('내용을 입력해주세요.');
          return;
        }

        try {
          await apiRequest('/visits', {
            method: 'POST',
            body: JSON.stringify({ member_id: id, date, type, content })
          });
          closeModal(modal);
          showMemberDetail(id); // 리로드
        } catch (e) {
          alert(e.message);
        }
      });
    }

    // 심방 기록 삭제 리스너
    modal.querySelectorAll('.delete-visit-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const visitId = e.target.dataset.id;
        if (!confirm('기록을 삭제하시겠습니까?')) return;
        try {
          await apiRequest(`/visits/${visitId}`, { method: 'DELETE' });
          closeModal(modal);
          showMemberDetail(id);
        } catch (err) { alert(err.message); }
      });
    });

    modal.querySelector('[data-action="close"]').addEventListener('click', () => closeModal(modal));

  } catch (error) {
    console.error(error);
    alert('정보를 불러오는데 실패했습니다.');
  }
}

// 전역 스코프에 함수 노출 (onclick 핸들러용)
window.showMemberDetail = showMemberDetail;

// Excel 내보내기 함수
async function exportMembersToExcel() {
  try {
    const response = await fetch('/api/export/members', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      throw new Error('내보내기 실패');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `명부_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    alert('명부가 Excel 파일로 내보내졌습니다.');
  } catch (error) {
    console.error('내보내기 오류:', error);
    alert('내보내기에 실패했습니다.');
  }
}

