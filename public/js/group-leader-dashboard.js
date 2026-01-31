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
                    const groupStats = stats.filter(s => memberIds.includes(s.member_id));

                    if (groupStats.length > 0) {
                        const totalAttendance = groupStats.reduce((sum, s) => sum + (s.present_count || 0), 0);
                        const totalDays = groupStats.reduce((sum, s) => sum + (s.total_count || 0), 0);
                        attendanceRate = totalDays > 0 ? Math.round((totalAttendance / totalDays) * 100) : 0;
                    }

                    // 최근 3주 결석자 확인
                    const threeWeeksAgo = new Date(today.getTime() - 21 * 24 * 60 * 60 * 1000);
                    const absentData = await apiRequest(`/attendance/absent-streak?weeks=3`);
                    absentMembers = absentData.filter(a => memberIds.includes(a.member_id));
                } catch (e) {
                    console.error('통계 로드 실패:', e);
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

function viewGroupAttendance(groupId, groupName) {
    alert(`${groupName} 출석 체크 기능은 출석체크 페이지에서 이용하세요.`);
    showView('attendance');
}

function viewGroupVisits(groupId, groupName) {
    alert(`${groupName} 심방 기록은 명부관리 페이지에서 각 학생의 상세 정보를 통해 확인하세요.`);
    showView('members');
}

// 전역 함수로 노출
window.viewGroupMembers = viewGroupMembers;
window.viewGroupAttendance = viewGroupAttendance;
window.viewGroupVisits = viewGroupVisits;
