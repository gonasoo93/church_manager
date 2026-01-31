// 그룹 리더 대시보드

async function initGroupLeaderDashboard() {
  const view = document.getElementById('group-leader-dashboard-view');

  view.innerHTML = `
    <div class="view-header">
      <h2>👨‍🏫 내 그룹 관리</h2>
    </div>
    
    <div id="leader-groups-container">
      <p class="text-center">로딩 중...</p>
    </div>
  `;

  await loadLeaderGroups();
}

async function loadLeaderGroups() {
  try {
    // 내가 리더인 그룹 조회
    const allGroups = await apiRequest('/features/groups');
    const myGroups = allGroups.filter(g => g.leader_id === state.user.id);

    const container = document.getElementById('leader-groups-container');

    if (myGroups.length === 0) {
      container.innerHTML = '<p class="text-center text-secondary">담당 그룹이 없습니다.</p>';
      return;
    }

    // 각 그룹별로 대시보드 표시
    let html = '';

    for (const group of myGroups) {
      // 그룹 멤버 가져오기
      const members = await apiRequest(`/features/groups/${group.id}/members`);

      // 그룹 출석률 계산
      const today = new Date();
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      const startDate = monthAgo.toISOString().split('T')[0];
      const endDate = today.toISOString().split('T')[0];

      let attendanceRate = 0;
      let absentMembers = [];

      if (members.length > 0) {
        const memberIds = members.map(m => m.member_id);

        // 출석 통계 가져오기
        try {
          const stats = await apiRequest(`/attendance/stats?startDate=${startDate}&endDate=${endDate}`);
          console.log('출석 통계:', stats);
          const groupStats = stats.filter(s => memberIds.includes(s.id));
          console.log('그룹 통계:', groupStats);

          if (groupStats.length > 0) {
            const totalAttendance = groupStats.reduce((sum, s) => sum + (s.present_count || 0), 0);
            const totalDays = groupStats.reduce((sum, s) => sum + (s.total_count || 0), 0);
            attendanceRate = totalDays > 0 ? Math.round((totalAttendance / totalDays) * 100) : 0;
          }
        } catch (e) {
          console.error('통계 로드 실패:', e);
        }

        // 최근 3주 결석자 확인
        const threeWeeksAgo = new Date(today.getTime() - 21 * 24 * 60 * 60 * 1000);
        try {
          const absentData = await apiRequest(`/attendance/absent-streak?weeks=3`);
          absentMembers = absentData.filter(a => memberIds.includes(a.member_id));
        } catch (e) {
          console.error('결석자 조회 실패:', e);
        }
      }

      html += `
        <div class="card" style="margin-bottom: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
            <div>
              <h3>${group.name}</h3>
              <div style="color: var(--text-secondary); font-size: 0.875rem;">
                ${group.type === 'cell' ? '셀' : group.type === 'class' ? '반' : '팀'} · 멤버 ${members.length}명
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 2rem; font-weight: bold; color: var(--primary);">${attendanceRate}%</div>
              <div style="color: var(--text-secondary); font-size: 0.875rem;">최근 한 달 출석률</div>
            </div>
          </div>
          
          ${absentMembers.length > 0 ? `
            <div style="background: var(--error-bg); border-left: 4px solid var(--error); padding: 1rem; margin-bottom: 1rem; border-radius: var(--radius-sm);">
              <strong>⚠️ 연속 결석자 (${absentMembers.length}명)</strong>
              <div style="margin-top: 0.5rem;">
                ${absentMembers.map(a => `<span style="margin-right: 0.5rem;">${a.member_name}</span>`).join('')}
              </div>
            </div>
          ` : ''}
          
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
            <button class="btn btn-primary" onclick="viewGroupMembers(${group.id}, '${group.name}')">
              👥 멤버 목록
            </button>
            <button class="btn btn-secondary" onclick="viewGroupAttendance(${group.id}, '${group.name}')">
              ✅ 출석 체크
            </button>
            <button class="btn btn-secondary" onclick="viewGroupVisits(${group.id}, '${group.name}')">
              📞 심방 기록
            </button>
          </div>
        </div>
      `;
    }

    container.innerHTML = html;

  } catch (error) {
    console.error('그룹 로드 오류:', error);
    document.getElementById('leader-groups-container').innerHTML =
      '<p class="text-center text-error">그룹을 불러오는데 실패했습니다.</p>';
  }
}

async function viewGroupMembers(groupId, groupName) {
  try {
    const members = await apiRequest(`/features/groups/${groupId}/members`);

    const content = `
      <div style="margin-bottom: 1rem;">
        <strong>총 ${members.length}명</strong>
      </div>
      <div style="max-height: 400px; overflow-y: auto;">
        ${members.length === 0 ?
        '<p class="text-center text-secondary">멤버가 없습니다.</p>' :
        members.map(m => `
            <div style="padding: 0.75rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between;">
              <span>${m.member_name} (${m.grade}학년)</span>
              <span style="color: var(--text-secondary); font-size: 0.875rem;">
                ${new Date(m.joined_at).toLocaleDateString()}
              </span>
            </div>
          `).join('')
      }
      </div>
    `;

    const modal = createModal(`${groupName} - 멤버 목록`, content, [
      { text: '닫기', class: 'btn-secondary', action: 'close' }
    ]);

    modal.querySelector('[data-action="close"]').addEventListener('click', () => {
      closeModal(modal);
    });
  } catch (error) {
    alert('멤버 목록을 불러오는데 실패했습니다.');
  }
}

// 그룹 출석 체크
async function viewGroupAttendance(groupId, groupName) {
  try {
    const members = await apiRequest(`/features/groups/${groupId}/members`);
    const today = new Date().toISOString().split('T')[0];

    const content = `
      <div class="form-group">
        <label>날짜</label>
        <input type="date" id="group-attendance-date" value="${today}">
      </div>
      <div id="group-attendance-list" style="max-height: 400px; overflow-y: auto;">
        ${members.map((m, idx) => `
          <div style="padding: 0.75rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
            <span>${m.member_name}</span>
            <div style="display: flex; gap: 0.5rem;">
              <label style="display: flex; align-items: center; gap: 0.25rem;">
                <input type="radio" name="attendance-${idx}" value="present" checked>
                <span>출석</span>
              </label>
              <label style="display: flex; align-items: center; gap: 0.25rem;">
                <input type="radio" name="attendance-${idx}" value="absent">
                <span>결석</span>
              </label>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    const modal = createModal(`${groupName} - 출석 체크`, content, [
      { text: '취소', class: 'btn-secondary', action: 'cancel' },
      { text: '저장', class: 'btn-primary', action: 'save' }
    ]);

    modal.querySelector('[data-action="cancel"]').addEventListener('click', () => {
      closeModal(modal);
    });

    modal.querySelector('[data-action="save"]').addEventListener('click', async () => {
      const date = document.getElementById('group-attendance-date').value;
      const attendanceData = members.map((m, idx) => {
        const status = document.querySelector(`input[name="attendance-${idx}"]:checked`).value;
        return {
          member_id: m.member_id,
          status
        };
      });

      try {
        await apiRequest('/attendance/bulk', {
          method: 'POST',
          body: JSON.stringify({
            date: date,
            records: attendanceData
          })
        });
        alert('출석이 저장되었습니다');
        closeModal(modal);
        await loadLeaderGroups();
      } catch (error) {
        alert(error.message || '출석 저장에 실패했습니다');
      }
    });
  } catch (error) {
    alert('출석 체크를 불러오는데 실패했습니다.');
  }
}

// 그룹 심방 기록
async function viewGroupVisits(groupId, groupName) {
  try {
    const members = await apiRequest(`/features/groups/${groupId}/members`);
    const memberIds = members.map(m => m.member_id);

    // 그룹원들의 심방 기록 조회
    let groupVisits = [];
    try {
      const allVisits = await apiRequest('/visits');
      console.log('전체 심방 기록:', allVisits);
      // member_id가 객체일 수 있으므로 _id 또는 숫자 값으로 비교
      groupVisits = allVisits.filter(v => {
        const visitMemberId = typeof v.member_id === 'object' ? v.member_id._id : v.member_id;
        return memberIds.includes(visitMemberId);
      });
      console.log('그룹 심방 기록:', groupVisits);
    } catch (visitError) {
      console.error('심방 기록 조회 실패:', visitError);
      // 심방 기록 조회 실패해도 UI는 표시
    }

    const content = `
      <div style="margin-bottom: 1rem;">
        <button class="btn btn-primary" id="add-visit-btn" style="width: 100%;">
          ➕ 새 심방 기록 작성
        </button>
      </div>
      
      <div style="margin-bottom: 1rem;">
        <strong>심방 기록 목록 (${groupVisits.length}건)</strong>
      </div>
      
      <div style="max-height: 400px; overflow-y: auto;">
        ${groupVisits.length === 0 ?
        '<p class="text-center text-secondary">심방 기록이 없습니다.</p>' :
        groupVisits.map(v => `
            <div style="padding: 1rem; border-bottom: 1px solid var(--border); background: var(--bg-tertiary); margin-bottom: 0.5rem; border-radius: var(--radius-md);">
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                <strong>${v.member_name}</strong>
                <span style="color: var(--text-secondary); font-size: 0.875rem;">${new Date(v.date).toLocaleDateString()}</span>
              </div>
              <div style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 0.5rem;">
                ${v.type || '심방'} · ${v.teacher_name}
              </div>
              <div style="white-space: pre-wrap;">${v.content}</div>
            </div>
          `).join('')
      }
      </div>
    `;

    const modal = createModal(`${groupName} - 심방 기록`, content, [
      { text: '닫기', class: 'btn-secondary', action: 'close' }
    ]);

    modal.querySelector('[data-action="close"]').addEventListener('click', () => {
      closeModal(modal);
    });

    // 새 심방 기록 작성 버튼
    modal.querySelector('#add-visit-btn').addEventListener('click', () => {
      closeModal(modal);
      showVisitForm(groupId, groupName, members);
    });

  } catch (error) {
    console.error('심방 기록 조회 오류:', error);
    alert('심방 기록을 불러오는데 실패했습니다: ' + error.message);
  }
}

// 심방 기록 작성 폼
async function showVisitForm(groupId, groupName, members) {
  try {
    const content = `
      <div class="form-group">
        <label>학생 선택</label>
        <select id="visit-member-select" class="form-group">
          <option value="">학생을 선택하세요</option>
          ${members.map(m => `<option value="${m.member_id}">${m.member_name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>방문 날짜</label>
        <input type="date" id="visit-date" value="${new Date().toISOString().split('T')[0]}">
      </div>
      <div class="form-group">
        <label>방문 유형</label>
        <select id="visit-type">
          <option value="home">가정 방문</option>
          <option value="phone">전화</option>
          <option value="meeting">면담</option>
          <option value="other">기타</option>
        </select>
      </div>
      <div class="form-group">
        <label>내용</label>
        <textarea id="visit-content" rows="5" placeholder="심방 내용을 입력하세요"></textarea>
      </div>
    `;

    const modal = createModal(`${groupName} - 심방 기록 작성`, content, [
      { text: '취소', class: 'btn-secondary', action: 'cancel' },
      { text: '저장', class: 'btn-primary', action: 'save' }
    ]);

    modal.querySelector('[data-action="cancel"]').addEventListener('click', () => {
      closeModal(modal);
    });

    modal.querySelector('[data-action="save"]').addEventListener('click', async () => {
      const memberId = document.getElementById('visit-member-select').value;
      const date = document.getElementById('visit-date').value;
      const type = document.getElementById('visit-type').value;
      const content = document.getElementById('visit-content').value;

      if (!memberId) {
        alert('학생을 선택해주세요');
        return;
      }

      if (!content.trim()) {
        alert('내용을 입력해주세요');
        return;
      }

      try {
        await apiRequest('/visits', {
          method: 'POST',
          body: JSON.stringify({
            member_id: parseInt(memberId),
            date: date,
            type: type,
            content: content
          })
        });
        alert('심방 기록이 저장되었습니다');
        closeModal(modal);
      } catch (error) {
        alert(error.message || '심방 기록 저장에 실패했습니다');
      }
    });
  } catch (error) {
    alert('심방 기록 폼을 불러오는데 실패했습니다.');
  }
}

// 전역 함수로 노출
window.viewGroupMembers = viewGroupMembers;
window.viewGroupAttendance = viewGroupAttendance;
window.viewGroupVisits = viewGroupVisits;
