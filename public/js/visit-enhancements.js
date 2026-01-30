// 심방 관리 강화 기능

let visitTemplates = [];

// 심방 필요 학생 추천 로드
async function loadVisitRecommendations() {
    try {
        const recommendations = await apiRequest('/visits/recommendations');

        if (recommendations.length === 0) {
            return '<p class="text-center text-secondary">심방이 필요한 학생이 없습니다.</p>';
        }

        return `
      <div style="display: grid; gap: 0.75rem;">
        ${recommendations.map(r => `
          <div class="card" style="padding: 1rem; background: ${r.priority === 'high' ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-tertiary)'}; border-left: 3px solid ${r.priority === 'high' ? 'var(--error)' : 'var(--warning)'};">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="font-size: 1.1rem;">${r.member_name}</strong>
                <div style="color: var(--text-secondary); margin-top: 0.25rem; font-size: 0.875rem;">
                  ${r.reason}
                </div>
              </div>
              <button class="btn btn-sm btn-primary" onclick="showVisitFormForMember(${r.member_id})">
                심방 기록
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    } catch (error) {
        console.error('심방 추천 로드 오류:', error);
        return '<p class="text-center text-danger">추천 목록을 불러올 수 없습니다.</p>';
    }
}

// 심방 템플릿 로드
async function loadVisitTemplates() {
    try {
        visitTemplates = await apiRequest('/visits/templates');
        return visitTemplates;
    } catch (error) {
        console.error('템플릿 로드 오류:', error);
        return [];
    }
}

// 템플릿 관리 UI 표시
async function showTemplateManager() {
    const templates = await loadVisitTemplates();

    const content = `
    <div style="margin-bottom: 1rem;">
      <button class="btn btn-primary" id="add-template-btn">새 템플릿 추가</button>
    </div>
    <div id="template-list">
      ${templates.length === 0 ? '<p class="text-center text-secondary">저장된 템플릿이 없습니다.</p>' :
            templates.map(t => `
          <div class="card" style="padding: 1rem; margin-bottom: 0.75rem;">
            <div style="display: flex; justify-content: between; align-items: start;">
              <div style="flex: 1;">
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                  <strong>${t.title}</strong>
                  <span class="badge" style="background: var(--primary); padding: 2px 8px; font-size: 0.75rem;">${t.category}</span>
                </div>
                <div style="color: var(--text-secondary); font-size: 0.875rem; white-space: pre-wrap;">${t.content}</div>
              </div>
              <button class="btn btn-sm btn-danger" onclick="deleteTemplate(${t.id})" style="margin-left: 1rem;">삭제</button>
            </div>
          </div>
        `).join('')}
    </div>
  `;

    const modal = createModal('심방 템플릿 관리', content, [
        { text: '닫기', class: 'btn-secondary', action: 'close' }
    ]);

    modal.querySelector('[data-action="close"]').addEventListener('click', () => {
        closeModal(modal);
    });

    modal.querySelector('#add-template-btn').addEventListener('click', () => {
        closeModal(modal);
        showTemplateForm();
    });
}

// 템플릿 추가 폼
function showTemplateForm() {
    const content = `
    <form id="template-form">
      <div class="form-group">
        <label for="template-title">제목 *</label>
        <input type="text" id="template-title" required>
      </div>
      <div class="form-group">
        <label for="template-category">카테고리</label>
        <select id="template-category">
          <option value="전화">전화</option>
          <option value="방문">방문</option>
          <option value="문자">문자</option>
          <option value="기타">기타</option>
        </select>
      </div>
      <div class="form-group">
        <label for="template-content">내용 *</label>
        <textarea id="template-content" rows="5" required></textarea>
      </div>
    </form>
  `;

    const modal = createModal('템플릿 추가', content, [
        { text: '취소', class: 'btn-secondary', action: 'cancel' },
        { text: '저장', class: 'btn-primary', action: 'submit' }
    ]);

    modal.querySelector('[data-action="cancel"]').addEventListener('click', () => {
        closeModal(modal);
    });

    modal.querySelector('[data-action="submit"]').addEventListener('click', async () => {
        const title = document.getElementById('template-title').value.trim();
        const category = document.getElementById('template-category').value;
        const content = document.getElementById('template-content').value.trim();

        if (!title || !content) {
            alert('제목과 내용을 입력해주세요');
            return;
        }

        try {
            await apiRequest('/visits/templates', {
                method: 'POST',
                body: JSON.stringify({ title, category, content })
            });

            closeModal(modal);
            alert('템플릿이 저장되었습니다');
            showTemplateManager();
        } catch (error) {
            alert(error.message);
        }
    });
}

// 템플릿 삭제
async function deleteTemplate(id) {
    if (!confirm('이 템플릿을 삭제하시겠습니까?')) return;

    try {
        await apiRequest(`/visits/templates/${id}`, { method: 'DELETE' });
        alert('템플릿이 삭제되었습니다');
        showTemplateManager();
    } catch (error) {
        alert(error.message);
    }
}

// 특정 학생에 대한 심방 기록 폼 (추천에서 호출)
async function showVisitFormForMember(memberId) {
    const templates = await loadVisitTemplates();

    const content = `
    <form id="quick-visit-form">
      <div class="form-group">
        <label for="visit-date">날짜 *</label>
        <input type="date" id="visit-date" value="${new Date().toISOString().split('T')[0]}" required>
      </div>
      <div class="form-group">
        <label for="visit-type">유형 *</label>
        <select id="visit-type">
          <option value="전화">전화</option>
          <option value="방문">방문</option>
          <option value="문자">문자</option>
          <option value="기타">기타</option>
        </select>
      </div>
      ${templates.length > 0 ? `
        <div class="form-group">
          <label for="visit-template">템플릿 사용</label>
          <select id="visit-template">
            <option value="">직접 입력</option>
            ${templates.map(t => `<option value="${t.id}">${t.title}</option>`).join('')}
          </select>
        </div>
      ` : ''}
      <div class="form-group">
        <label for="visit-content">내용 *</label>
        <textarea id="visit-content" rows="5" required></textarea>
      </div>
      <div class="form-group">
        <label for="visit-next-date">다음 심방 예정일</label>
        <input type="date" id="visit-next-date">
      </div>
      <div class="form-group">
        <label for="visit-priority">우선순위</label>
        <select id="visit-priority">
          <option value="low">낮음</option>
          <option value="medium" selected>보통</option>
          <option value="high">높음</option>
        </select>
      </div>
    </form>
  `;

    const modal = createModal('심방 기록 작성', content, [
        { text: '취소', class: 'btn-secondary', action: 'cancel' },
        { text: '저장', class: 'btn-primary', action: 'submit' }
    ]);

    // 템플릿 선택 시 내용 자동 입력
    if (templates.length > 0) {
        modal.querySelector('#visit-template').addEventListener('change', (e) => {
            const templateId = parseInt(e.target.value);
            if (templateId) {
                const template = templates.find(t => t.id === templateId);
                if (template) {
                    document.getElementById('visit-content').value = template.content;
                    document.getElementById('visit-type').value = template.category;
                }
            }
        });
    }

    modal.querySelector('[data-action="cancel"]').addEventListener('click', () => {
        closeModal(modal);
    });

    modal.querySelector('[data-action="submit"]').addEventListener('click', async () => {
        const date = document.getElementById('visit-date').value;
        const type = document.getElementById('visit-type').value;
        const content = document.getElementById('visit-content').value.trim();
        const nextDate = document.getElementById('visit-next-date').value;
        const priority = document.getElementById('visit-priority').value;
        const templateId = document.getElementById('visit-template')?.value;

        if (!date || !type || !content) {
            alert('필수 항목을 입력해주세요');
            return;
        }

        try {
            await apiRequest('/visits', {
                method: 'POST',
                body: JSON.stringify({
                    member_id: memberId,
                    date,
                    type,
                    content,
                    next_visit_date: nextDate || null,
                    priority,
                    template_id: templateId ? parseInt(templateId) : null
                })
            });

            closeModal(modal);
            alert('심방 기록이 저장되었습니다');
        } catch (error) {
            alert(error.message);
        }
    });
}

// 심방 통계 로드
async function loadVisitStatistics() {
    try {
        const stats = await apiRequest('/visits/statistics');

        return `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem;">
        <div class="card">
          <h4>교사별 심방 횟수</h4>
          <div style="max-height: 200px; overflow-y: auto;">
            ${stats.by_teacher.length === 0 ? '<p class="text-secondary">데이터 없음</p>' :
                stats.by_teacher.map(t => `
                <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--border);">
                  <span>${t.teacher_name}</span>
                  <strong>${t.count}회</strong>
                </div>
              `).join('')}
          </div>
        </div>
        <div class="card">
          <h4>학생별 심방 횟수</h4>
          <div style="max-height: 200px; overflow-y: auto;">
            ${stats.by_member.length === 0 ? '<p class="text-secondary">데이터 없음</p>' :
                stats.by_member.slice(0, 10).map(m => `
                <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--border);">
                  <span>${m.member_name}</span>
                  <strong>${m.count}회</strong>
                </div>
              `).join('')}
          </div>
        </div>
      </div>
    `;
    } catch (error) {
        console.error('심방 통계 로드 오류:', error);
        return '<p class="text-center text-danger">통계를 불러올 수 없습니다.</p>';
    }
}
