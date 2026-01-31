// 그룹 관리

async function initGroups() {
  const view = document.getElementById('groups-view');

  view.innerHTML = `
    <div class="view-header">
      <h2>👨‍👩‍👧‍👦 그룹 관리</h2>
      <button class="btn btn-primary" id="new-group-btn">새 그룹 추가</button>
    </div>
    <div class="card">
      <div id="groups-list">
        <p class="text-center">로딩 중...</p>
      </div>
    </div>
  `;

  document.getElementById('new-group-btn').addEventListener('click', showGroupForm);

  await loadGroups();
}

async function loadGroups() {
  try {
    const groups = await apiRequest('/features/groups');
    const list = document.getElementById('groups-list');

    if (groups.length === 0) {
      list.innerHTML = '<p class="text-center text-secondary">등록된 그룹이 없습니다.</p>';
      return;
    }

    list.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem;">
        ${groups.map(g => `
          <div class="card" style="padding: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
              <div>
                <h3 style="margin-bottom: 0.5rem;">${g.name}</h3>
                <div style="color: var(--text-secondary); font-size: 0.875rem;">
                  ${g.type === 'cell' ? '셀' : g.type === 'class' ? '반' : '팀'}
                  ${g.leader_name ? ` · 리더: ${g.leader_name}` : ''}
                </div>
              </div>
              <button class="btn btn-sm btn-danger" onclick="deleteGroup(${g.id})">삭제</button>
            </div>
            <button class="btn btn-secondary btn-block" onclick="manageGroupMembers(${g.id}, '${g.name}')">
              멤버 관리
            </button>
          </div>
        `).join('')}
      </div>
    `;
  } catch (error) {
    console.error('그룹 로드 오류:', error);
  }
}

async function showGroupForm() {
  // 교사 목록 가져오기
  const users = await apiRequest('/auth/users');

  const content = `
    <form id="group-form">
      <div class="form-group">
        <label for="group-name">그룹명 *</label>
        <input type="text" id="group-name" required>
      </div>
      <div class="form-group">
        <label for="group-type">유형</label>
        <select id="group-type">
          <option value="cell">셀</option>
          <option value="class">반</option>
          <option value="team">팀</option>
        </select>
      </div>
      <div class="form-group">
        <label for="group-leader">그룹 리더 (선택)</label>
        <select id="group-leader">
          <option value="">리더 없음</option>
          ${users.map(u => `<option value="${u.id}">${u.name} (${u.role === 'admin' ? '관리자' : '교사'})</option>`).join('')}
        </select>
      </div>
    </form>
  `;

  const modal = createModal('그룹 추가', content, [
    { text: '취소', class: 'btn-secondary', action: 'cancel' },
    { text: '추가', class: 'btn-primary', action: 'submit' }
  ]);

  modal.querySelector('[data-action="cancel"]').addEventListener('click', () => {
    closeModal(modal);
  });

  modal.querySelector('[data-action="submit"]').addEventListener('click', async () => {
    const name = document.getElementById('group-name').value.trim();
    const type = document.getElementById('group-type').value;
    const leader_id = document.getElementById('group-leader').value;

    if (!name) {
      alert('그룹명을 입력해주세요');
      return;
    }

    try {
      await apiRequest('/features/groups', {
        method: 'POST',
        body: JSON.stringify({
          name,
          type,
          leader_id: leader_id ? parseInt(leader_id) : null
        })
      });

      closeModal(modal);
      await loadGroups();
      alert('그룹이 추가되었습니다');
    } catch (error) {
      alert(error.message);
    }
  });
}

async function deleteGroup(id) {
  if (!confirm('이 그룹을 삭제하시겠습니까?')) return;

  try {
    await apiRequest(`/features/groups/${id}`, { method: 'DELETE' });
    await loadGroups();
    alert('그룹이 삭제되었습니다');
  } catch (error) {
    alert(error.message);
  }
}

async function manageGroupMembers(groupId, groupName) {
  try {
    // 모든 학생 목록 가져오기
    const allMembers = await apiRequest('/members');

    // 현재 그룹 멤버 가져오기
    const groupMembers = await apiRequest(`/features/groups/${groupId}/members`);
    const groupMemberIds = new Set(groupMembers.map(m => m.member_id));

    // 그룹에 속하지 않은 학생들
    const availableMembers = allMembers.filter(m => !groupMemberIds.has(m.id));

    const content = `
      <div style="margin-bottom: 1rem;">
        <h4 style="margin-bottom: 0.5rem;">현재 멤버 (${groupMembers.length}명)</h4>
        <div id="current-members" style="max-height: 200px; overflow-y: auto; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.5rem;">
          ${groupMembers.length === 0 ?
        '<p class="text-center text-secondary">멤버가 없습니다.</p>' :
        groupMembers.map(m => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; border-bottom: 1px solid var(--border);">
                <span>${m.member_name} (${m.grade}학년)</span>
                <button class="btn btn-sm btn-danger" onclick="removeMemberFromGroup(${groupId}, ${m.member_id}, '${groupName}')">제거</button>
              </div>
            `).join('')
      }
        </div>
      </div>
      
      <div>
        <h4 style="margin-bottom: 0.5rem;">멤버 추가</h4>
        <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
          <select id="member-to-add" style="flex: 1; padding: 0.5rem; border: 1px solid var(--border); border-radius: var(--radius-sm);">
            <option value="">학생 선택...</option>
            ${availableMembers.map(m => `
              <option value="${m.id}">${m.name} (${m.grade}학년 ${m.group}반)</option>
            `).join('')}
          </select>
          <button class="btn btn-primary" id="add-member-btn">추가</button>
        </div>
      </div>
    `;

    const modal = createModal(`${groupName} - 멤버 관리`, content, [
      { text: '닫기', class: 'btn-secondary', action: 'close' }
    ]);

    modal.querySelector('[data-action="close"]').addEventListener('click', () => {
      closeModal(modal);
      loadGroups(); // 그룹 목록 새로고침
    });

    modal.querySelector('#add-member-btn').addEventListener('click', async () => {
      const memberId = document.getElementById('member-to-add').value;
      if (!memberId) {
        alert('학생을 선택해주세요');
        return;
      }

      try {
        await apiRequest(`/features/groups/${groupId}/members`, {
          method: 'POST',
          body: JSON.stringify({ member_id: memberId })
        });

        closeModal(modal);
        manageGroupMembers(groupId, groupName); // 모달 새로고침
        alert('멤버가 추가되었습니다');
      } catch (error) {
        alert(error.message);
      }
    });

  } catch (error) {
    console.error('멤버 관리 오류:', error);
    alert('멤버 관리를 불러오는데 실패했습니다');
  }
}

async function removeMemberFromGroup(groupId, memberId, groupName) {
  if (!confirm('이 멤버를 그룹에서 제거하시겠습니까?')) return;

  try {
    await apiRequest(`/features/groups/${groupId}/members/${memberId}`, {
      method: 'DELETE'
    });

    // 현재 열린 모달 닫고 다시 열기
    const modalContainer = document.getElementById('modal-container');
    if (modalContainer) {
      modalContainer.innerHTML = '';
    }

    manageGroupMembers(groupId, groupName);
    alert('멤버가 제거되었습니다');
  } catch (error) {
    alert(error.message);
  }
}

// 전역 함수로 노출
window.manageGroupMembers = manageGroupMembers;
window.removeMemberFromGroup = removeMemberFromGroup;
