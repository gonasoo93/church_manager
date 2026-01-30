// 예배 기록 초기화
async function initWorship() {
  const view = document.getElementById('worship-view');

  // 부서 선택 필터 UI (총괄 관리자용)
  let deptFilterHtml = '';
  if (state.user.role === 'super_admin') {
    deptFilterHtml = `
          <div style="flex: 1; max-width: 200px;">
              <select id="worship-department-filter" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg-tertiary); color: var(--text-primary);">
                <option value="all">전체 부서</option>
              </select>
          </div>
      `;
  }

  view.innerHTML = `
    <div class="view-header">
      <h2>예배 기록</h2>
      <button class="btn btn-primary" id="add-worship-btn">
        <span>➕</span>
        <span>예배 기록 추가</span>
      </button>
    </div>
    <div class="card">
      ${deptFilterHtml ? `<div style="margin-bottom: 1rem;">${deptFilterHtml}</div>` : ''}
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>날짜</th>
              <th>설교 제목</th>
              <th>설교자</th>
              <th>본문</th>
              <th>참석 인원</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody id="worship-table-body">
            <tr><td colspan="6" class="text-center">로딩 중...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('add-worship-btn').addEventListener('click', () => showWorshipForm());

  // 부서 필터 리스너 (총괄 관리자용)
  const deptSelect = document.getElementById('worship-department-filter');
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

    deptSelect.addEventListener('change', loadWorship);
  }

  await loadWorship();
}

// 예배 기록 로드
async function loadWorship() {
  try {
    const deptSelect = document.getElementById('worship-department-filter');
    const department_id = deptSelect ? deptSelect.value : null;

    let url = '/worship';
    if (department_id && department_id !== 'all') {
      url += `?department_id=${department_id}`;
    }

    const worship = await apiRequest(url);
    renderWorship(worship);
  } catch (error) {
    console.error('예배 기록 로드 오류:', error);
  }
}

// 예배 기록 렌더링
function renderWorship(worship) {
  const tbody = document.getElementById('worship-table-body');

  if (worship.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">예배 기록이 없습니다</td></tr>';
    return;
  }

  tbody.innerHTML = worship.map(w => `
    <tr>
      <td>${formatDateTime(w.date, w.time)}</td>
      <td><strong>${w.title || '-'}</strong></td>
      <td>${w.preacher || '-'}</td>
      <td>${w.scripture || '-'}</td>
      <td>${w.attendance_count || '-'}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="viewWorship(${w.id})">보기</button>
        <button class="btn btn-danger btn-sm" onclick="deleteWorship(${w.id})">삭제</button>
      </td>
    </tr>
  `).join('');
}

// 예배 기록 폼
function showWorshipForm(worship = null) {
  const isEdit = !!worship;
  const title = isEdit ? '예배 기록 수정' : '예배 기록 추가';

  const content = `
    <form id="worship-form">
      <div class="form-group">
        <label for="worship-date">날짜 *</label>
        <input type="date" id="worship-date" required value="${worship?.date || ''}">
      </div>
      <div class="form-group">
        <label for="worship-time">시간</label>
        <input type="time" id="worship-time" value="${worship?.time || ''}">
      </div>
      <div class="form-group">
        <label for="worship-sermon-title">설교 제목</label>
        <input type="text" id="worship-sermon-title" value="${worship?.title || ''}">
      </div>
      <div class="form-group">
        <label for="worship-sermon-text">본문 말씀</label>
        <input type="text" id="worship-sermon-text" placeholder="예: 요한복음 3:16" value="${worship?.scripture || ''}">
      </div>
      <div class="form-group">
        <label for="worship-preacher">설교자</label>
        <input type="text" id="worship-preacher" value="${worship?.preacher || ''}">
      </div>
      <div class="form-group">
        <label for="worship-songs">찬양 목록</label>
        <textarea id="worship-songs" placeholder="한 줄에 하나씩 입력">${worship?.worship_songs || ''}</textarea>
      </div>
      <div class="form-group">
        <label for="worship-special">특별 순서</label>
        <textarea id="worship-special">${worship?.special_events || ''}</textarea>
      </div>
      <div class="form-group">
        <label for="worship-attendance">참석 인원</label>
        <input type="number" id="worship-attendance" value="${worship?.attendance_count || ''}">
      </div>
      <div class="form-group">
        <label for="worship-notes">비고</label>
        <textarea id="worship-notes">${worship?.notes || ''}</textarea>
      </div>
    </form>
  `;

  const modal = createModal(title, content, [
    { text: '취소', class: 'btn-secondary', action: 'cancel' },
    { text: isEdit ? '수정' : '저장', class: 'btn-primary', action: 'submit' }
  ]);

  modal.querySelector('[data-action="cancel"]').addEventListener('click', () => {
    closeModal(modal);
  });

  modal.querySelector('[data-action="submit"]').addEventListener('click', async () => {
    const formData = {
      date: document.getElementById('worship-date').value,
      time: document.getElementById('worship-time').value,
      title: document.getElementById('worship-sermon-title').value,
      scripture: document.getElementById('worship-sermon-text').value,
      preacher: document.getElementById('worship-preacher').value,
      worship_songs: document.getElementById('worship-songs').value,
      special_events: document.getElementById('worship-special').value,
      attendance_count: document.getElementById('worship-attendance').value,
      notes: document.getElementById('worship-notes').value
    };

    try {
      if (isEdit) {
        await apiRequest(`/worship/${worship.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData)
        });
      } else {
        await apiRequest('/worship', {
          method: 'POST',
          body: JSON.stringify(formData)
        });
      }

      closeModal(modal);
      await loadWorship();
    } catch (error) {
      alert(error.message);
    }
  });
}

// 예배 기록 보기
async function viewWorship(id) {
  try {
    const worship = await apiRequest(`/worship/${id}`);

    const content = `
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        <div><strong>날짜:</strong> ${formatDateTime(worship.date, worship.time)}</div>
        <div><strong>설교 제목:</strong> ${worship.title || '-'}</div>
        <div><strong>본문 말씀:</strong> ${worship.scripture || '-'}</div>
        <div><strong>설교자:</strong> ${worship.preacher || '-'}</div>
        ${worship.worship_songs ? `<div><strong>찬양:</strong><br><pre style="white-space: pre-wrap;">${worship.worship_songs}</pre></div>` : ''}
        ${worship.special_events ? `<div><strong>특별 순서:</strong><br><pre style="white-space: pre-wrap;">${worship.special_events}</pre></div>` : ''}
        <div><strong>참석 인원:</strong> ${worship.attendance_count || '-'}명</div>
        ${worship.notes ? `<div><strong>비고:</strong><br><pre style="white-space: pre-wrap;">${worship.notes}</pre></div>` : ''}
      </div>
    `;

    const modal = createModal('예배 기록 상세', content, [
      { text: '수정', class: 'btn-primary', action: 'edit' },
      { text: '닫기', class: 'btn-secondary', action: 'close' }
    ]);

    modal.querySelector('[data-action="close"]').addEventListener('click', () => {
      closeModal(modal);
    });

    modal.querySelector('[data-action="edit"]').addEventListener('click', () => {
      closeModal(modal);
      showWorshipForm(worship);
    });

  } catch (error) {
    alert(error.message);
  }
}

// 예배 기록 삭제
async function deleteWorship(id) {
  if (!confirm('정말 삭제하시겠습니까?')) return;

  try {
    await apiRequest(`/worship/${id}`, { method: 'DELETE' });
    await loadWorship();
  } catch (error) {
    alert(error.message);
  }
}
