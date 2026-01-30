// 공지사항 관리

async function initAnnouncements() {
    const view = document.getElementById('announcements-view');

    view.innerHTML = `
    <div class="view-header">
      <h2>📢 공지사항</h2>
      <button class="btn btn-primary" id="new-announcement-btn">새 공지 작성</button>
    </div>
    <div class="card">
      <div id="announcements-list">
        <p class="text-center">로딩 중...</p>
      </div>
    </div>
  `;

    document.getElementById('new-announcement-btn').addEventListener('click', showAnnouncementForm);

    await loadAnnouncements();
}

async function loadAnnouncements() {
    try {
        const announcements = await apiRequest('/announcements');
        const list = document.getElementById('announcements-list');

        if (announcements.length === 0) {
            list.innerHTML = '<p class="text-center text-secondary">등록된 공지사항이 없습니다.</p>';
            return;
        }

        list.innerHTML = announcements.map(a => `
      <div class="card" style="margin-bottom: 1rem; ${a.pinned ? 'border-left: 4px solid var(--primary);' : ''}">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
              ${a.pinned ? '<span style="background: var(--primary); color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">📌 고정</span>' : ''}
              ${a.priority === 'urgent' ? '<span style="background: var(--error); color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">긴급</span>' : ''}
              ${a.priority === 'important' ? '<span style="background: var(--warning); color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">중요</span>' : ''}
            </div>
            <h3 style="margin-bottom: 0.5rem;">${a.title}</h3>
            <div style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 0.5rem;">
              ${a.author_name} · ${new Date(a.created_at).toLocaleDateString()}
            </div>
            <div style="white-space: pre-wrap;">${a.content}</div>
          </div>
          <div style="display: flex; gap: 0.5rem; margin-left: 1rem;">
            <button class="btn btn-sm btn-secondary" onclick="togglePin(${a.id})">
              ${a.pinned ? '고정 해제' : '고정'}
            </button>
            <button class="btn btn-sm btn-danger" onclick="deleteAnnouncement(${a.id})">삭제</button>
          </div>
        </div>
      </div>
    `).join('');
    } catch (error) {
        console.error('공지사항 로드 오류:', error);
    }
}

function showAnnouncementForm() {
    const content = `
    <form id="announcement-form">
      <div class="form-group">
        <label for="announcement-title">제목 *</label>
        <input type="text" id="announcement-title" required>
      </div>
      <div class="form-group">
        <label for="announcement-priority">우선순위</label>
        <select id="announcement-priority">
          <option value="normal">일반</option>
          <option value="important">중요</option>
          <option value="urgent">긴급</option>
        </select>
      </div>
      <div class="form-group">
        <label for="announcement-content">내용 *</label>
        <textarea id="announcement-content" rows="8" required></textarea>
      </div>
    </form>
  `;

    const modal = createModal('공지사항 작성', content, [
        { text: '취소', class: 'btn-secondary', action: 'cancel' },
        { text: '작성', class: 'btn-primary', action: 'submit' }
    ]);

    modal.querySelector('[data-action="cancel"]').addEventListener('click', () => {
        closeModal(modal);
    });

    modal.querySelector('[data-action="submit"]').addEventListener('click', async () => {
        const title = document.getElementById('announcement-title').value.trim();
        const priority = document.getElementById('announcement-priority').value;
        const content = document.getElementById('announcement-content').value.trim();

        if (!title || !content) {
            alert('제목과 내용을 입력해주세요');
            return;
        }

        try {
            await apiRequest('/announcements', {
                method: 'POST',
                body: JSON.stringify({ title, priority, content })
            });

            closeModal(modal);
            await loadAnnouncements();
            alert('공지사항이 작성되었습니다');
        } catch (error) {
            alert(error.message);
        }
    });
}

async function togglePin(id) {
    try {
        await apiRequest(`/announcements/${id}/pin`, { method: 'POST' });
        await loadAnnouncements();
    } catch (error) {
        alert(error.message);
    }
}

async function deleteAnnouncement(id) {
    if (!confirm('이 공지사항을 삭제하시겠습니까?')) return;

    try {
        await apiRequest(`/announcements/${id}`, { method: 'DELETE' });
        await loadAnnouncements();
        alert('공지사항이 삭제되었습니다');
    } catch (error) {
        alert(error.message);
    }
}
