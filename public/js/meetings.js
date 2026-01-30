// 회의 기록 초기화
async function initMeetings() {
  const view = document.getElementById('meetings-view');

  // 부서 선택 필터 UI (총괄 관리자용)
  let deptFilterHtml = '';
  if (state.user.role === 'super_admin') {
    deptFilterHtml = `
          <div style="flex: 1; max-width: 200px;">
              <select id="meeting-department-filter" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg-tertiary); color: var(--text-primary);">
                <option value="all">전체 부서</option>
              </select>
          </div>
      `;
  }

  view.innerHTML = `
    <div class="view-header">
      <h2>회의 기록</h2>
      <button class="btn btn-primary" id="add-meeting-btn">
        <span>➕</span>
        <span>회의록 작성</span>
      </button>
    </div>
    <div class="card">
      ${deptFilterHtml ? `<div style="margin-bottom: 1rem;">${deptFilterHtml}</div>` : ''}
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>제목</th>
              <th>날짜</th>
              <th>참석자</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody id="meetings-table-body">
            <tr><td colspan="4" class="text-center">로딩 중...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('add-meeting-btn').addEventListener('click', () => showMeetingForm());

  // 부서 필터 리스너 (총괄 관리자용)
  const deptSelect = document.getElementById('meeting-department-filter');
  if (deptSelect) {
    try {
      const departments = await apiRequest('/departments');
      departments.forEach(dept => {
        const option = document.createElement('option');
        option.value = dept.id;
        option.textContent = dept.name;
        deptSelect.appendChild(option);
      });
    } catch (e) { console.error('부서 로드 실패', e); }

    deptSelect.addEventListener('change', loadMeetings);
  }

  await loadMeetings();
}

// 회의 기록 로드
async function loadMeetings() {
  try {
    const deptSelect = document.getElementById('meeting-department-filter');
    const department_id = deptSelect ? deptSelect.value : null;

    let url = '/meetings';
    if (department_id && department_id !== 'all') {
      url += `?department_id=${department_id}`;
    }

    const meetings = await apiRequest(url);
    renderMeetings(meetings);
  } catch (error) {
    console.error('회의 기록 로드 오류:', error);
  }
}

// 회의 기록 렌더링
function renderMeetings(meetings) {
  const tbody = document.getElementById('meetings-table-body');

  if (meetings.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">회의 기록이 없습니다</td></tr>';
    return;
  }

  tbody.innerHTML = meetings.map(m => `
    <tr>
      <td><strong>${m.title}</strong></td>
      <td>${formatDateTime(m.date, m.time)}</td>
      <td>${m.attendees || '-'}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="viewMeeting(${m.id})">보기</button>
        <button class="btn btn-danger btn-sm" onclick="deleteMeeting(${m.id})">삭제</button>
      </td>
    </tr>
  `).join('');
}

// AI 요약 생성
async function generateAISummary(content) {
  try {
    const response = await apiRequest('/meetings/summarize', {
      method: 'POST',
      body: JSON.stringify({ content })
    });
    return response;
  } catch (error) {
    throw error;
  }
}

// 회의록 작성 폼 (Markdown 에디터)
function showMeetingForm(meeting = null) {
  const isEdit = !!meeting;
  const title = isEdit ? '회의록 수정' : '회의록 작성';

  const content = `
    <form id="meeting-form">
      <div class="form-group">
        <label for="meeting-title">제목 *</label>
        <input type="text" id="meeting-title" required value="${meeting?.title || ''}">
      </div>
      <div class="form-group">
        <label for="meeting-date">날짜 *</label>
        <input type="date" id="meeting-date" required value="${meeting?.date || ''}">
      </div>
      <div class="form-group">
        <label for="meeting-time">시간</label>
        <input type="time" id="meeting-time" value="${meeting?.time || ''}">
      </div>
      <div class="form-group">
        <label for="meeting-attendees">참석자</label>
        <input type="text" id="meeting-attendees" placeholder="쉼표로 구분" value="${meeting?.attendees || ''}">
      </div>
      <div class="form-group">
        <label style="display: flex; align-items: center; justify-content: space-between;">
          <span>회의 내용 (Markdown 지원)</span>
          <button type="button" class="btn btn-secondary" id="ai-summary-btn" style="padding: 0.5rem 1rem; font-size: 0.875rem;">
            <span>🤖</span>
            <span>AI 요약</span>
          </button>
        </label>
        <div class="markdown-editor">
          <div class="markdown-input">
            <textarea id="meeting-content" style="width: 100%; min-height: 400px; font-family: 'Courier New', monospace; padding: 1rem; background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: var(--radius-md); color: var(--text-primary);" placeholder="# 안건&#10;&#10;## 1. 첫 번째 안건&#10;- 논의 내용&#10;&#10;## 결정 사항&#10;- 결정된 내용">${meeting?.content || ''}</textarea>
          </div>
          <div class="markdown-preview" id="meeting-preview">
            <p class="text-muted">미리보기가 여기에 표시됩니다</p>
          </div>
        </div>
      </div>
      <div class="form-group">
        <label for="meeting-decisions">결정 사항 요약</label>
        <textarea id="meeting-decisions" placeholder="AI 요약 버튼을 사용하면 자동으로 채워집니다">${meeting?.decisions || ''}</textarea>
      </div>
      <div class="form-group">
        <label for="meeting-next">다음 회의 일정</label>
        <input type="text" id="meeting-next" value="${meeting?.next_meeting || ''}">
      </div>
    </form>
  `;

  const modal = createModal(title, content, [
    { text: '취소', class: 'btn-secondary', action: 'cancel' },
    { text: isEdit ? '수정' : '저장', class: 'btn-primary', action: 'submit' }
  ]);

  // Markdown 실시간 미리보기
  const contentTextarea = modal.querySelector('#meeting-content');
  const preview = modal.querySelector('#meeting-preview');

  function updatePreview() {
    const markdown = contentTextarea.value;
    preview.innerHTML = marked.parse(markdown);
  }

  contentTextarea.addEventListener('input', updatePreview);

  // 초기 미리보기
  setTimeout(updatePreview, 100);

  // AI 요약 버튼
  const aiSummaryBtn = modal.querySelector('#ai-summary-btn');
  aiSummaryBtn.addEventListener('click', async () => {
    const content = contentTextarea.value;

    if (!content.trim()) {
      alert('회의 내용을 먼저 입력해주세요');
      return;
    }

    // 로딩 표시
    aiSummaryBtn.disabled = true;
    aiSummaryBtn.innerHTML = '<span>⏳</span><span>분석 중...</span>';

    try {
      const summary = await generateAISummary(content);

      // 요약 결과 모달 표시
      showAISummaryResult(summary);

      // 결정 사항 자동 입력
      if (summary.decisions && summary.decisions.length > 0) {
        const decisionsText = summary.decisions.map(d => `- ${d}`).join('\n');
        document.getElementById('meeting-decisions').value = decisionsText;
      }

      aiSummaryBtn.disabled = false;
      aiSummaryBtn.innerHTML = '<span>🤖</span><span>AI 요약</span>';
    } catch (error) {
      alert('AI 요약 생성 실패: ' + error.message);
      aiSummaryBtn.disabled = false;
      aiSummaryBtn.innerHTML = '<span>🤖</span><span>AI 요약</span>';
    }
  });

  modal.querySelector('[data-action="cancel"]').addEventListener('click', () => {
    closeModal(modal);
  });

  modal.querySelector('[data-action="submit"]').addEventListener('click', async () => {
    const formData = {
      title: document.getElementById('meeting-title').value,
      date: document.getElementById('meeting-date').value,
      time: document.getElementById('meeting-time').value,
      attendees: document.getElementById('meeting-attendees').value,
      content: document.getElementById('meeting-content').value,
      decisions: document.getElementById('meeting-decisions').value,
      next_meeting: document.getElementById('meeting-next').value
    };

    try {
      if (isEdit) {
        await apiRequest(`/meetings/${meeting.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData)
        });
      } else {
        await apiRequest('/meetings', {
          method: 'POST',
          body: JSON.stringify(formData)
        });
      }

      closeModal(modal);
      await loadMeetings();
    } catch (error) {
      alert(error.message);
    }
  });
}

// AI 요약 결과 표시
function showAISummaryResult(summary) {
  const content = `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      <div>
        <h4 style="color: var(--primary); margin-bottom: 0.5rem;">📝 전체 요약</h4>
        <p style="line-height: 1.6;">${summary.summary}</p>
      </div>
      
      ${summary.discussions && summary.discussions.length > 0 ? `
        <div>
          <h4 style="color: var(--primary); margin-bottom: 0.5rem;">💬 주요 논의사항</h4>
          <ul style="margin-left: 1.5rem; line-height: 1.8;">
            ${summary.discussions.map(d => `<li>${d}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      
      ${summary.decisions && summary.decisions.length > 0 ? `
        <div>
          <h4 style="color: var(--success); margin-bottom: 0.5rem;">✅ 결정 사항</h4>
          <ul style="margin-left: 1.5rem; line-height: 1.8;">
            ${summary.decisions.map(d => `<li>${d}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      
      ${summary.actions && summary.actions.length > 0 ? `
        <div>
          <h4 style="color: var(--warning); margin-bottom: 0.5rem;">🎯 실행 계획</h4>
          <ul style="margin-left: 1.5rem; line-height: 1.8;">
            ${summary.actions.map(a => `<li>${a}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    </div>
  `;

  const summaryModal = createModal('🤖 AI 요약 결과', content, [
    { text: '확인', class: 'btn-primary', action: 'close' }
  ]);

  summaryModal.querySelector('[data-action="close"]').addEventListener('click', () => {
    closeModal(summaryModal);
  });
}

// 회의록 보기
async function viewMeeting(id) {
  try {
    const meeting = await apiRequest(`/meetings/${id}`);

    const content = `
      <div style="display: flex; flex-direction: column; gap: 1.5rem;">
        <div>
          <div style="color: var(--text-secondary); font-size: 0.875rem;">날짜</div>
          <div style="font-size: 1.1rem;">${formatDateTime(meeting.date, meeting.time)}</div>
        </div>
        ${meeting.attendees ? `
          <div>
            <div style="color: var(--text-secondary); font-size: 0.875rem;">참석자</div>
            <div>${meeting.attendees}</div>
          </div>
        ` : ''}
        <div>
          <div style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 0.5rem;">회의 내용</div>
          <div class="markdown-preview" style="max-height: 400px; overflow-y: auto;">
            ${marked.parse(meeting.content || '')}
          </div>
        </div>
        ${meeting.decisions ? `
          <div>
            <div style="color: var(--text-secondary); font-size: 0.875rem;">결정 사항</div>
            <div style="white-space: pre-wrap;">${meeting.decisions}</div>
          </div>
        ` : ''}
        ${meeting.next_meeting ? `
          <div>
            <div style="color: var(--text-secondary); font-size: 0.875rem;">다음 회의</div>
            <div>${meeting.next_meeting}</div>
          </div>
        ` : ''}
      </div>
    `;

    const modal = createModal(meeting.title, content, [
      { text: '수정', class: 'btn-primary', action: 'edit' },
      { text: '닫기', class: 'btn-secondary', action: 'close' }
    ]);

    modal.querySelector('[data-action="close"]').addEventListener('click', () => {
      closeModal(modal);
    });

    modal.querySelector('[data-action="edit"]').addEventListener('click', () => {
      closeModal(modal);
      showMeetingForm(meeting);
    });

  } catch (error) {
    alert(error.message);
  }
}

// 회의 기록 삭제
async function deleteMeeting(id) {
  if (!confirm('정말 삭제하시겠습니까?')) return;

  try {
    await apiRequest(`/meetings/${id}`, { method: 'DELETE' });
    await loadMeetings();
  } catch (error) {
    alert(error.message);
  }
}
