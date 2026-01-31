// 출석 체크 초기화
async function initAttendance() {
  const view = document.getElementById('attendance-view');

  const today = new Date().toISOString().split('T')[0];

  // 부서 선택 필터 UI (총괄 관리자용)
  let deptFilterHtml = '';
  if (state.user.role === 'super_admin') {
    deptFilterHtml = `
          <select id="stats-department" class="form-group" style="margin: 0; padding: 0.5rem;">
            <option value="all">전체 부서</option>
          </select>
      `;
  }

  view.innerHTML = `
    <div class="view-header">
      <h2>출석 체크</h2>
      <div style="display: flex; gap: 1rem;">
        <input type="date" id="attendance-date" value="${today}" class="form-group" style="margin: 0;">
        <button class="btn btn-primary" id="load-attendance-btn">조회</button>
        <button class="btn btn-success" id="save-attendance-btn">저장</button>
        <button class="btn btn-danger" id="delete-attendance-btn">출석 삭제</button>
      </div>
    </div>
    <div class="card">
      <h3>출석 체크</h3>
      
      <!-- 그룹 탭 -->
      <div class="tabs" id="group-tabs">
        <button class="tab-btn active" data-group-id="all">전체</button>
        <!-- 동적으로 그룹 탭 추가됨 -->
      </div>
      
      <div id="attendance-list">
        <p class="text-center">로딩 중...</p>
      </div>
    </div>
    <div class="card mt-2">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h3>출석 통계</h3>
        <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
          <button class="btn btn-sm btn-secondary" id="export-attendance-btn">
            <span>📥</span>
            <span>Excel 내보내기</span>
          </button>
          ${deptFilterHtml}
          <select id="stats-period" class="form-group" style="margin: 0; padding: 0.5rem;">
            <option value="month">최근 1개월</option>
            <option value="quarter">최근 3개월 (분기)</option>
            <option value="half">최근 6개월 (반기)</option>
            <option value="year">최근 1년</option>
            <option value="custom">사용자 지정</option>
          </select>
          <div id="custom-date-range" style="display: none; gap: 0.5rem;">
            <input type="date" id="stats-start-date" class="form-group" style="margin: 0; padding: 0.5rem;">
            <span style="color: var(--text-secondary);">~</span>
            <input type="date" id="stats-end-date" class="form-group" style="margin: 0; padding: 0.5rem;">
          </div>
          <select id="stats-status" class="form-group" style="margin: 0; padding: 0.5rem;">
            <option value="all">전체 상태</option>
            <option value="active" selected>일반 학생</option>
            <option value="long_term_absent">장기 결석자</option>
          </select>
          <select id="stats-member" class="form-group" style="margin: 0; padding: 0.5rem;">
            <option value="all">전체 학생 (개인별 선택)</option>
          </select>
          <button class="btn btn-secondary" id="refresh-stats-btn">통계 갱신</button>
        </div>
      </div>
      <div id="stats-summary" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
        <!-- 주간 통계 카드들이 동적으로 생성됩니다 -->
      </div>
      <canvas id="attendance-chart"></canvas>
    </div>
  `;

  // 이벤트 리스너
  document.getElementById('load-attendance-btn').addEventListener('click', loadAttendanceForDate);
  document.getElementById('save-attendance-btn').addEventListener('click', saveAttendance);
  document.getElementById('delete-attendance-btn').addEventListener('click', deleteAttendanceByDate);
  document.getElementById('refresh-stats-btn').addEventListener('click', loadAttendanceStats);

  // 부서 필터 리스너 (총괄 관리자용)
  const deptSelect = document.getElementById('stats-department');
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

    deptSelect.addEventListener('change', async () => {
      await loadMembersForFilter(); // 부서 변경 시 해당 부서 학생 목록 로드
      await loadAttendanceStats(); // 통계 갱신
    });
  }

  document.getElementById('stats-period').addEventListener('change', (e) => {
    const customRange = document.getElementById('custom-date-range');
    if (e.target.value === 'custom') {
      customRange.style.display = 'flex';
      // 기본값 설정 (최근 1개월)
      const today = new Date();
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      document.getElementById('stats-start-date').value = monthAgo.toISOString().split('T')[0];
      document.getElementById('stats-end-date').value = today.toISOString().split('T')[0];
    } else {
      customRange.style.display = 'none';
    }
    loadAttendanceStats();
  });
  document.getElementById('export-attendance-btn').addEventListener('click', exportAttendanceToExcel);
  document.getElementById('stats-status').addEventListener('change', loadAttendanceStats);
  document.getElementById('stats-member').addEventListener('change', loadAttendanceStats);
  document.getElementById('stats-start-date').addEventListener('change', loadAttendanceStats);
  document.getElementById('stats-end-date').addEventListener('change', loadAttendanceStats);

  // 초기 로드
  await loadGroupTabs(); // 그룹 탭 로드
  await loadAttendanceForDate();
  await loadMembersForFilter();
  await loadAttendanceStats();

  // 대시보드 초기화 (attendance-dashboard.js에서 정의됨)
  if (typeof initAttendanceDashboard === 'function') {
    await initAttendanceDashboard();
  }
}

// 그룹 탭 로드 및 초기화
let currentGroupId = 'all'; // 현재 선택된 그룹 ID
let allGroups = []; // 모든 그룹 목록
let memberGroupMap = {}; // 학생 ID -> 그룹 ID 매핑

async function loadGroupTabs() {
  try {
    // 그룹 목록 조회
    const groups = await apiRequest('/features/groups');
    allGroups = groups;

    // 각 그룹의 멤버 조회하여 매핑 생성
    for (const group of groups) {
      const members = await apiRequest(`/features/groups/${group.id}/members`);
      members.forEach(member => {
        if (!memberGroupMap[member.member_id]) {
          memberGroupMap[member.member_id] = [];
        }
        memberGroupMap[member.member_id].push(group.id);
      });
    }

    // 탭 UI 생성
    const tabsContainer = document.getElementById('group-tabs');
    tabsContainer.innerHTML = '<button class="tab-btn active" data-group-id="all">전체</button>';

    groups.forEach(group => {
      const tabBtn = document.createElement('button');
      tabBtn.className = 'tab-btn';
      tabBtn.dataset.groupId = group.id;
      tabBtn.textContent = group.name;
      tabBtn.addEventListener('click', () => switchGroupTab(group.id));
      tabsContainer.appendChild(tabBtn);
    });

    // "전체" 탭 클릭 이벤트
    tabsContainer.querySelector('[data-group-id="all"]').addEventListener('click', () => switchGroupTab('all'));

  } catch (error) {
    console.error('그룹 탭 로드 실패:', error);
  }
}

// 그룹 탭 전환
function switchGroupTab(groupId) {
  currentGroupId = groupId;

  // 탭 활성화 상태 변경
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-group-id="${groupId}"]`).classList.add('active');

  // 출석 목록 필터링하여 다시 렌더링
  renderAttendanceList();
}


// 필터용 학생 목록 로드
async function loadMembersForFilter() {
  try {
    // 부서 필터 확인
    const deptSelect = document.getElementById('stats-department');
    const department_id = deptSelect ? deptSelect.value : null;

    let url = '/members';
    if (department_id && department_id !== 'all') {
      url += `?department_id=${department_id}`;
    }

    const members = await apiRequest(url);
    const select = document.getElementById('stats-member');

    // 기존 옵션 제거 (첫 번째 제외)
    while (select.options.length > 1) {
      select.remove(1);
    }

    members.forEach(member => {
      const option = document.createElement('option');
      option.value = member.id;
      option.textContent = member.name;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('필터 멤버 로드 오류:', error);
  }
}

// 날짜별 출석 로드
let attendanceRecords = [];

async function loadAttendanceForDate() {
  const date = document.getElementById('attendance-date').value;
  const listContainer = document.getElementById('attendance-list');

  try {
    const [members, attendance] = await Promise.all([
      apiRequest('/members'),
      apiRequest(`/attendance?date=${date}`)
    ]);

    // 출석 기록을 맵으로 변환
    const attendanceMap = {};
    attendance.forEach(a => {
      attendanceMap[a.member_id] = a.status;
    });

    // 출석 체크리스트 생성
    attendanceRecords = members.map(member => ({
      member_id: member.id,
      name: member.name,
      student_status: member.status, // 학생 상태 (active/long_term_absent)
      status: attendanceMap[member.id] || 'absent'
    }));

    renderAttendanceList();

  } catch (error) {
    console.error('출석 로드 오류:', error);
    listContainer.innerHTML = '<p class="text-center">출석 정보를 불러올 수 없습니다</p>';
  }
}

// 출석 리스트 렌더링
function renderAttendanceList() {
  const listContainer = document.getElementById('attendance-list');
  // 부서명 또는 기본값 설정
  const deptName = state.user?.department_name || (state.user?.role === 'super_admin' ? '학생' : '부원');

  // 그룹 필터링 적용
  let filteredRecords = attendanceRecords;
  if (currentGroupId !== 'all') {
    filteredRecords = attendanceRecords.filter(record => {
      const memberGroups = memberGroupMap[record.member_id] || [];
      return memberGroups.includes(parseInt(currentGroupId));
    });
  }

  if (filteredRecords.length === 0) {
    listContainer.innerHTML = `<p class="text-center">등록된 ${deptName}이(가) 없습니다</p>`;
    return;
  }

  listContainer.innerHTML = `
    <div style="display: grid; gap: 0.5rem;">
      ${filteredRecords.map((record, index) => {
    // 원본 인덱스 찾기 (필터링 후에도 올바른 인덱스 사용)
    const originalIndex = attendanceRecords.findIndex(r => r.member_id === record.member_id);
    return `
        <div style="display: flex; align-items: center; gap: 1rem; padding: 0.75rem; background: var(--bg-tertiary); border-radius: var(--radius-md);">
          <span style="flex: 1; font-weight: 600;">
            ${record.name}
            ${record.student_status === 'long_term_absent' ? '<span style="font-size: 0.75rem; color: var(--danger); margin-left: 0.5rem;">(장기결석)</span>' : ''}
          </span>
          <div style="display: flex; gap: 0.5rem;">
            <label style="display: flex; align-items: center; gap: 0.25rem; cursor: pointer;">
              <input type="radio" name="attendance-${originalIndex}" value="present" 
                ${record.status === 'present' ? 'checked' : ''}
                onchange="updateAttendanceStatus(${originalIndex}, 'present')">
              <span>출석</span>
            </label>
            <label style="display: flex; align-items: center; gap: 0.25rem; cursor: pointer;">
              <input type="radio" name="attendance-${originalIndex}" value="absent" 
                ${record.status === 'absent' || record.status === 'late' ? 'checked' : ''}
                onchange="updateAttendanceStatus(${originalIndex}, 'absent')">
              <span>결석</span>
            </label>
          </div>
        </div>
      `}).join('')}
    </div>
  `;
}

// 출석 상태 업데이트
function updateAttendanceStatus(index, status) {
  attendanceRecords[index].status = status;
}

// 출석 저장
async function saveAttendance() {
  const date = document.getElementById('attendance-date').value;

  const records = attendanceRecords.map(r => ({
    member_id: r.member_id,
    status: r.status
  }));

  try {
    await apiRequest('/attendance/bulk', {
      method: 'POST',
      body: JSON.stringify({ date, records })
    });

    alert('출석이 저장되었습니다');
    await loadAttendanceStats();
  } catch (error) {
    alert(error.message);
  }
}

// 출석 기록 삭제 (날짜별)
async function deleteAttendanceByDate() {
  const date = document.getElementById('attendance-date').value;

  if (!confirm(`${date} 날짜의 모든 출석 기록을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
    return;
  }

  try {
    const response = await apiRequest(`/attendance/date/${date}`, {
      method: 'DELETE'
    });

    alert(`출석 기록이 삭제되었습니다. (${response.deletedCount}건)`);
    await loadAttendanceForDate();
    await loadAttendanceStats();
  } catch (error) {
    alert(error.message || '출석 삭제에 실패했습니다.');
  }
}

// 기간 계산
function getDateRange(period) {
  const today = new Date();
  let startDate, endDate;

  if (period === 'custom') {
    const startInput = document.getElementById('stats-start-date').value;
    const endInput = document.getElementById('stats-end-date').value;

    if (startInput && endInput) {
      return {
        startDate: startInput,
        endDate: endInput
      };
    }
    // 기본값으로 최근 1개월
    startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else {
    switch (period) {
      case 'month':
        startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'quarter':
        startDate = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'half':
        startDate = new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        startDate = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: today.toISOString().split('T')[0]
  };
}

// 주간 통계 계산 헬퍼 함수 (주일 기준)
function calculateWeeklyStats(dailyStats, memberId = null) {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = 일요일, 1 = 월요일, ..., 6 = 토요일

  // 가장 최근 주일(일요일) 찾기
  const lastSunday = new Date(today);
  lastSunday.setDate(today.getDate() - dayOfWeek);
  lastSunday.setHours(0, 0, 0, 0);

  const weeks = [];

  // 최근 4주 생성 (주일~토요일 기준)
  for (let i = 0; i < 4; i++) {
    const weekStart = new Date(lastSunday);
    weekStart.setDate(lastSunday.getDate() - (i * 7)); // 일요일

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // 토요일

    weeks.push({
      start: weekStart,
      end: weekEnd,
      present: 0,
      late: 0,
      absent: 0
    });
  }

  // 일별 데이터를 주간별로 집계
  dailyStats.forEach(day => {
    const dayDate = new Date(day.date);
    dayDate.setHours(0, 0, 0, 0);

    for (let week of weeks) {
      if (dayDate >= week.start && dayDate <= week.end) {
        week.present += day.present || 0;
        week.late += day.late || 0;
        week.absent += day.absent || 0;
        break;
      }
    }
  });

  // 출석률 계산 및 레이블 생성
  return weeks.map((week, index) => {
    const total = week.present + week.late + week.absent;
    const attendanceRate = total > 0 ? Math.round((week.present / total) * 100) : 0;

    const startMonth = week.start.getMonth() + 1;
    const startDay = week.start.getDate();
    const endMonth = week.end.getMonth() + 1;
    const endDay = week.end.getDate();

    let label;
    if (index === 0) {
      label = '이번 주';
    } else if (index === 1) {
      label = '지난 주';
    } else {
      label = `${index}주 전`;
    }

    return {
      label,
      dateRange: `${startMonth}/${startDay}-${endMonth}/${endDay}`,
      present: week.present,
      late: week.late,
      absent: week.absent,
      attendanceRate
    };
  }).reverse(); // 오래된 주부터 최신 주 순서로 정렬
}

// 주간 통계 렌더링
function renderWeeklyStats(weeklyData, studentName = null) {
  const container = document.getElementById('stats-summary');
  if (!container) return;

  // 평균 출석률 계산
  const validWeeks = weeklyData.filter(w => (w.present + w.late + w.absent) > 0);
  const avgRate = validWeeks.length > 0
    ? Math.round(validWeeks.reduce((sum, w) => sum + w.attendanceRate, 0) / validWeeks.length)
    : 0;

  // 평균 카드 + 3개 주간 카드
  const cards = [
    // 평균 출석률 카드
    `<div style="padding: 1rem; background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%); border-radius: var(--radius-md); text-align: center; color: white;">
      <div style="font-size: 0.875rem; opacity: 0.9;">평균 출석률</div>
      <div style="font-size: 2rem; font-weight: 700; margin: 0.5rem 0;">${avgRate}%</div>
      <div style="font-size: 0.75rem; opacity: 0.8;">최근 4주간</div>
    </div>`,
    // 최근 3주 카드
    ...weeklyData.slice(-3).map(week => {
      const total = week.present + week.late + week.absent;
      return `<div style="padding: 1rem; background: var(--bg-tertiary); border-radius: var(--radius-md);">
        <div style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.5rem; font-weight: 600;">${week.label}</div>
        <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.75rem;">${week.dateRange}</div>
        ${total > 0 ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
            <span style="font-size: 0.875rem; color: var(--text-secondary);">출석</span>
            <span style="font-size: 0.875rem; color: var(--success); font-weight: 600;">${week.present}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
            <span style="font-size: 0.875rem; color: var(--text-secondary);">결석</span>
            <span style="font-size: 0.875rem; color: var(--danger); font-weight: 600;">${week.absent}</span>
          </div>
          <div style="padding-top: 0.5rem; border-top: 1px solid var(--border-color); text-align: center;">
            <span style="font-size: 1.125rem; font-weight: 700; color: var(--primary);">${week.attendanceRate}%</span>
          </div>
        ` : `
          <div style="text-align: center; padding: 1rem 0; color: var(--text-secondary); font-size: 0.875rem;">
            데이터 없음
          </div>
        `}
      </div>`;
    })
  ];

  container.innerHTML = cards.join('');
}

// 출석 통계 로드
let currentChart = null;

async function loadAttendanceStats() {
  try {
    const period = document.getElementById('stats-period').value;
    const memberId = document.getElementById('stats-member').value;
    const status = document.getElementById('stats-status').value;

    const deptSelect = document.getElementById('stats-department');
    const department_id = deptSelect ? deptSelect.value : null;

    const { startDate, endDate } = getDateRange(period);

    // 최근 4주간 데이터 가져오기
    const today = new Date();
    const fourWeeksAgo = new Date(today.getTime() - 28 * 24 * 60 * 60 * 1000);
    const weeklyStartDate = fourWeeksAgo.toISOString().split('T')[0];
    const weeklyEndDate = today.toISOString().split('T')[0];

    // 일별 통계 가져오기
    let dailyUrl = `/attendance/stats/daily?startDate=${weeklyStartDate}&endDate=${weeklyEndDate}`;
    if (department_id && department_id !== 'all') dailyUrl += `&department_id=${department_id}`;
    if (status && status !== 'all') dailyUrl += `&status=${status}`;

    const dailyStats = await apiRequest(dailyUrl);

    // 개별 학생 필터링
    if (memberId !== 'all') {
      // 개별 학생의 경우 해당 학생의 출석 기록만 필터링
      const memberStats = await apiRequest(`/attendance/stats?startDate=${weeklyStartDate}&endDate=${weeklyEndDate}`);
      const studentData = memberStats.find(s => s.id === parseInt(memberId));

      if (studentData) {
        // 개별 학생의 주간 통계 계산
        const weeklyData = calculateWeeklyStats(dailyStats, parseInt(memberId));
        renderWeeklyStats(weeklyData, studentData.name);
      }
    } else {
      // 전체 학생의 주간 통계 계산
      const weeklyData = calculateWeeklyStats(dailyStats);
      renderWeeklyStats(weeklyData);
    }

    // 차트 그리기 (기존 로직 유지)
    const ctx = document.getElementById('attendance-chart');
    if (!ctx) return;

    if (currentChart) {
      currentChart.destroy();
    }

    if (memberId === 'all') {
      // 전체 보기: 날짜별 추이 (Line Chart)
      let chartDailyUrl = `/attendance/stats/daily?startDate=${startDate}&endDate=${endDate}`;
      if (department_id && department_id !== 'all') chartDailyUrl += `&department_id=${department_id}`;

      const chartDailyStats = await apiRequest(chartDailyUrl);

      currentChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: chartDailyStats.map(s => formatDate(s.date)),
          datasets: [
            {
              label: '출석',
              data: chartDailyStats.map(s => s.present),
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.2)',
              tension: 0.1,
              fill: true
            },
            {
              label: '결석',
              data: chartDailyStats.map(s => s.absent),
              borderColor: '#ef4444',
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              tension: 0.1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { labels: { color: '#f1f5f9' } },
            title: {
              display: true,
              text: '날짜별 출석 현황',
              color: '#f1f5f9'
            }
          },
          scales: {
            x: {
              ticks: { color: '#cbd5e1' },
              grid: { color: 'rgba(255, 255, 255, 0.1)' }
            },
            y: {
              ticks: { color: '#cbd5e1', stepSize: 1 },
              grid: { color: 'rgba(255, 255, 255, 0.1)' },
              beginAtZero: true
            }
          }
        }
      });

    } else {
      // 개별 학생 선택 시: Bar Chart
      const stats = await apiRequest(`/attendance/stats?startDate=${startDate}&endDate=${endDate}`);
      const student = stats.find(s => s.id === parseInt(memberId));

      if (!student) return;

      currentChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['출석', '결석'],
          datasets: [{
            label: '횟수',
            data: [student.present_count, student.absent_count],
            backgroundColor: ['#10b981', '#ef4444']
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
            title: {
              display: true,
              text: `${student.name} 학생 출석 통계`,
              color: '#f1f5f9'
            }
          },
          scales: {
            y: {
              ticks: { color: '#cbd5e1', stepSize: 1 },
              grid: { color: 'rgba(255, 255, 255, 0.1)' },
              beginAtZero: true
            }
          }
        }
      });
    }

  } catch (error) {
    console.error('통계 로드 오류:', error);
  }
}

// Excel 내보내기 함수
async function exportAttendanceToExcel() {
  try {
    const { startDate, endDate } = getStatsDateRange();

    const response = await fetch(`/api/export/attendance?startDate=${startDate}&endDate=${endDate}`, {
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
    a.download = `출석부_${startDate}_${endDate}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    alert('출석부가 Excel 파일로 내보내졌습니다.');
  } catch (error) {
    console.error('내보내기 오류:', error);
    alert('내보내기에 실패했습니다.');
  }
}
