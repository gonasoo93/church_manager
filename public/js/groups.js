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

function showGroupForm() {
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

        if (!name) {
            alert('그룹명을 입력해주세요');
            return;
        }

        try {
            await apiRequest('/features/groups', {
                method: 'POST',
                body: JSON.stringify({ name, type })
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

function manageGroupMembers(groupId, groupName) {
    alert(`${groupName} 그룹 멤버 관리 기능은 추후 구현 예정입니다.`);
}
