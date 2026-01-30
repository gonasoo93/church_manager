// 행사 관리

async function initEvents() {
    const view = document.getElementById('events-view');

    view.innerHTML = `
    <div class="view-header">
      <h2>🎉 행사 관리</h2>
      <button class="btn btn-primary" id="new-event-btn">새 행사 등록</button>
    </div>
    <div class="card">
      <div id="events-list">
        <p class="text-center">로딩 중...</p>
      </div>
    </div>
  `;

    document.getElementById('new-event-btn').addEventListener('click', showEventForm);

    await loadEvents();
}

async function loadEvents() {
    try {
        const events = await apiRequest('/features/events');
        const list = document.getElementById('events-list');

        if (events.length === 0) {
            list.innerHTML = '<p class="text-center text-secondary">등록된 행사가 없습니다.</p>';
            return;
        }

        list.innerHTML = events.map(e => `
      <div class="card" style="margin-bottom: 1rem;">
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div style="flex: 1;">
            <h3 style="margin-bottom: 0.5rem;">${e.title}</h3>
            <div style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 0.5rem;">
              📅 ${e.event_date} ${e.location ? `· 📍 ${e.location}` : ''}
            </div>
            ${e.description ? `<div style="margin-bottom: 0.5rem;">${e.description}</div>` : ''}
            ${e.max_participants ? `<div style="color: var(--text-secondary); font-size: 0.875rem;">최대 인원: ${e.max_participants}명</div>` : ''}
          </div>
          <div style="display: flex; gap: 0.5rem; margin-left: 1rem;">
            <button class="btn btn-sm btn-secondary" onclick="viewParticipants(${e.id}, '${e.title}')">참가자</button>
            <button class="btn btn-sm btn-danger" onclick="deleteEvent(${e.id})">삭제</button>
          </div>
        </div>
      </div>
    `).join('');
    } catch (error) {
        console.error('행사 로드 오류:', error);
    }
}

function showEventForm() {
    const content = `
    <form id="event-form">
      <div class="form-group">
        <label for="event-title">행사명 *</label>
        <input type="text" id="event-title" required>
      </div>
      <div class="form-group">
        <label for="event-date">날짜 *</label>
        <input type="date" id="event-date" required>
      </div>
      <div class="form-group">
        <label for="event-location">장소</label>
        <input type="text" id="event-location">
      </div>
      <div class="form-group">
        <label for="event-max">최대 인원</label>
        <input type="number" id="event-max" min="1">
      </div>
      <div class="form-group">
        <label for="event-description">설명</label>
        <textarea id="event-description" rows="4"></textarea>
      </div>
    </form>
  `;

    const modal = createModal('행사 등록', content, [
        { text: '취소', class: 'btn-secondary', action: 'cancel' },
        { text: '등록', class: 'btn-primary', action: 'submit' }
    ]);

    modal.querySelector('[data-action="cancel"]').addEventListener('click', () => {
        closeModal(modal);
    });

    modal.querySelector('[data-action="submit"]').addEventListener('click', async () => {
        const title = document.getElementById('event-title').value.trim();
        const event_date = document.getElementById('event-date').value;
        const location = document.getElementById('event-location').value.trim();
        const max_participants = document.getElementById('event-max').value;
        const description = document.getElementById('event-description').value.trim();

        if (!title || !event_date) {
            alert('행사명과 날짜를 입력해주세요');
            return;
        }

        try {
            await apiRequest('/features/events', {
                method: 'POST',
                body: JSON.stringify({
                    title,
                    event_date,
                    location: location || null,
                    max_participants: max_participants ? parseInt(max_participants) : null,
                    description: description || null
                })
            });

            closeModal(modal);
            await loadEvents();
            alert('행사가 등록되었습니다');
        } catch (error) {
            alert(error.message);
        }
    });
}

async function deleteEvent(id) {
    if (!confirm('이 행사를 삭제하시겠습니까?')) return;

    try {
        await apiRequest(`/features/events/${id}`, { method: 'DELETE' });
        await loadEvents();
        alert('행사가 삭제되었습니다');
    } catch (error) {
        alert(error.message);
    }
}

async function viewParticipants(eventId, eventTitle) {
    try {
        const participants = await apiRequest(`/features/events/${eventId}/participants`);

        const content = `
      <div style="margin-bottom: 1rem;">
        <strong>참가자 수:</strong> ${participants.length}명
      </div>
      <div style="max-height: 300px; overflow-y: auto;">
        ${participants.length === 0 ? '<p class="text-center text-secondary">참가자가 없습니다.</p>' :
                participants.map(p => `
            <div style="padding: 0.5rem; border-bottom: 1px solid var(--border);">
              ${p.member_name} - ${p.status === 'registered' ? '신청' : p.status === 'attended' ? '참석' : '불참'}
            </div>
          `).join('')}
      </div>
    `;

        const modal = createModal(`${eventTitle} - 참가자 목록`, content, [
            { text: '닫기', class: 'btn-secondary', action: 'close' }
        ]);

        modal.querySelector('[data-action="close"]').addEventListener('click', () => {
            closeModal(modal);
        });
    } catch (error) {
        alert(error.message);
    }
}
