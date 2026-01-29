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
      </div>
    </div>
    <div class="card">
      <h3>출석 체크</h3>
      <div id="attendance-list">
        <p class="text-center">로딩 중...</p>
      </div>
    </div>
    <div class="card mt-2">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h3>출석 통계</h3>
        <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
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
        <div style="padding: 1rem; background: var(--bg-tertiary); border-radius: var(--radius-md); text-align: center;">
          <div style="font-size: 0.875rem; color: var(--text-secondary);">총 출석</div>
          <div style="font-size: 1.5rem; font-weight: 700; color: var(--success);" id="total-present">0</div>
        </div>
        <div style="padding: 1rem; background: var(--bg-tertiary); border-radius: var(--radius-md); text-align: center;">
          <div style="font-size: 0.875rem; color: var(--text-secondary);">총 지각</div>
          <div style="font-size: 1.5rem; font-weight: 700; color: var(--warning);" id="total-late">0</div>
        </div>
        <div style="padding: 1rem; background: var(--bg-tertiary); border-radius: var(--radius-md); text-align: center;">
          <div style="font-size: 0.875rem; color: var(--text-secondary);">총 결석</div>
          <div style="font-size: 1.5rem; font-weight: 700; color: var(--danger);" id="total-absent">0</div>
        </div>
        <div style="padding: 1rem; background: var(--bg-tertiary); border-radius: var(--radius-md); text-align: center;">
          <div style="font-size: 0.875rem; color: var(--text-secondary);">출석률</div>
          <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary);" id="attendance-rate">0%</div>
        </div>
      </div>
      <canvas id="attendance-chart"></canvas>
    </div>
  `;

  // 이벤트 리스너
  document.getElementById('load-attendance-btn').addEventListener('click', loadAttendanceForDate);
  document.getElementById('save-attendance-btn').addEventListener('click', saveAttendance);
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
  document.getElementById('stats-status').addEventListener('change', loadAttendanceStats);
  document.getElementById('stats-member').addEventListener('change', loadAttendanceStats);
  document.getElementById('stats-start-date').addEventListener('change', loadAttendanceStats);
  document.getElementById('stats-end-date').addEventListener('change', loadAttendanceStats);

  // 초기 로드
  await loadAttendanceForDate();
  await loadMembersForFilter();
  await loadAttendanceStats();
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

  if (attendanceRecords.length === 0) {
    listContainer.innerHTML = `<p class="text-center">등록된 ${deptName}이(가) 없습니다</p>`;
    return;
  }

  listContainer.innerHTML = `
    <div style="display: grid; gap: 0.5rem;">
      ${attendanceRecords.map((record, index) => `
        <div style="display: flex; align-items: center; gap: 1rem; padding: 0.75rem; background: var(--bg-tertiary); border-radius: var(--radius-md);">
          <span style="flex: 1; font-weight: 600;">
            ${record.name}
            ${record.student_status === 'long_term_absent' ? '<span style="font-size: 0.75rem; color: var(--danger); margin-left: 0.5rem;">(장기결석)</span>' : ''}
          </span>
          <div style="display: flex; gap: 0.5rem;">
            <label style="display: flex; align-items: center; gap: 0.25rem; cursor: pointer;">
              <input type="radio" name="attendance-${index}" value="present" 
                ${record.status === 'present' ? 'checked' : ''}
                onchange="updateAttendanceStatus(${index}, 'present')">
              <span>출석</span>
            </label>
            <label style="display: flex; align-items: center; gap: 0.25rem; cursor: pointer;">
              <input type="radio" name="attendance-${index}" value="late" 
                ${record.status === 'late' ? 'checked' : ''}
                onchange="updateAttendanceStatus(${index}, 'late')">
              <span>지각</span>
            </label>
            <label style="display: flex; align-items: center; gap: 0.25rem; cursor: pointer;">
              <input type="radio" name="attendance-${index}" value="absent" 
                ${record.status === 'absent' ? 'checked' : ''}
                onchange="updateAttendanceStatus(${index}, 'absent')">
              <span>결석</span>
            </label>
          </div>
        </div>
      `).join('')}
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

// 출석 통계 로드
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

    // 1. 전체 요약 통계 (기존 /stats 활용 또는 daily에서 계산)
    // 요약은 기존처럼 기간 내 총합이므로 /stats (학생별) 합산이 맞음.
    let summaryUrl = `/attendance/stats?startDate=${startDate}&endDate=${endDate}`;
    if (department_id && department_id !== 'all') summaryUrl += `&department_id=${department_id}`;
    if (status && status !== 'all') summaryUrl += `&status=${status}`;

    const stats = await apiRequest(summaryUrl);

    // 개별 학생 필터링
    let filteredStats = stats;
    if (memberId !== 'all') {
      filteredStats = stats.filter(s => s.id === parseInt(memberId));
    }

    // 요약 통계 계산
    const totalPresent = filteredStats.reduce((sum, s) => sum + s.present_count, 0);
    const totalLate = filteredStats.reduce((sum, s) => sum + s.late_count, 0);
    const totalAbsent = filteredStats.reduce((sum, s) => sum + s.absent_count, 0);
    const totalCount = totalPresent + totalLate + totalAbsent;
    const attendanceRate = totalCount > 0 ? Math.round((totalPresent / totalCount) * 100) : 0;

    document.getElementById('total-present').textContent = totalPresent;
    document.getElementById('total-late').textContent = totalLate;
    document.getElementById('total-absent').textContent = totalAbsent;
    document.getElementById('attendance-rate').textContent = attendanceRate + '%';

    // 2. 차트 그리기
    const ctx = document.getElementById('attendance-chart');
    if (!ctx) return;

    if (currentChart) {
      currentChart.destroy();
    }

    if (memberId === 'all') {
      // 전체 보기: 날짜별 추이 (Line Chart)
      let dailyUrl = `/attendance/stats/daily?startDate=${startDate}&endDate=${endDate}`;
      if (department_id && department_id !== 'all') dailyUrl += `&department_id=${department_id}`;

      const dailyStats = await apiRequest(dailyUrl);

      currentChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: dailyStats.map(s => formatDate(s.date)),
          datasets: [
            {
              label: '출석',
              data: dailyStats.map(s => s.present),
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.2)',
              tension: 0.1,
              fill: true
            },
            {
              label: '지각',
              data: dailyStats.map(s => s.late),
              borderColor: '#f59e0b',
              backgroundColor: 'rgba(245, 158, 11, 0.2)',
              tension: 0.1
            },
            {
              label: '결석',
              data: dailyStats.map(s => s.absent),
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
      // 개별 학생 선택 시: 기존 Bar Chart 유지 (또는 변경 가능)
      // 여기서는 기존 Bar Chart 로직 유지 (학생의 출석/지각/결석 비율)
      // 하지만 labels가 학생 이름 하나뿐이므로 좀 이상함. Pie Chart가 나을 수도 있음.
      // 일단 기존 로직(Bar) 유지하되 데이터 단순화.

      const student = filteredStats[0]; // 선택된 학생
      if (!student) return;

      currentChart = new Chart(ctx, {
        type: 'bar', // or 'pie'
        data: {
          labels: ['출석', '지각', '결석'],
          datasets: [{
            label: '횟수',
            data: [student.present_count, student.late_count, student.absent_count],
            backgroundColor: ['#10b981', '#f59e0b', '#ef4444']
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
