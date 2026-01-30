// 출석 대시보드 기능

let trendsChart = null;
let deptComparisonChart = null;

// 대시보드 초기화
async function initDashboard() {
    // 탭 전환 이벤트
    setupTabSwitching();

    // 대시보드 데이터 로드
    await loadAbsentStreak();
    await loadTrends();
    await loadGoals();

    // 총괄 관리자는 부서별 비교도 로드
    if (state.user.role === 'super_admin') {
        document.getElementById('dept-comparison-card').style.display = 'block';
        await loadDepartmentComparison();
    }

    // 이벤트 리스너
    document.getElementById('trends-months').addEventListener('change', loadTrends);
    document.getElementById('set-goal-btn').addEventListener('click', showGoalForm);
}

// 탭 전환 설정
function setupTabSwitching() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;

            // 모든 탭 비활성화
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // 선택된 탭 활성화
            btn.classList.add('active');
            document.getElementById(`tab-${tabName}`).classList.add('active');

            // 대시보드 탭으로 전환 시 데이터 새로고침
            if (tabName === 'dashboard') {
                loadAbsentStreak();
                loadTrends();
                loadGoals();
                if (state.user.role === 'super_admin') {
                    loadDepartmentComparison();
                }
            }
        });
    });
}

// 연속 결석자 조회
async function loadAbsentStreak() {
    try {
        let url = '/attendance/absent-streak?weeks=3';

        // 부서 필터링
        if (state.user.role !== 'super_admin' && state.user.department_id) {
            url += `&department_id=${state.user.department_id}`;
        }

        const absentMembers = await apiRequest(url);

        const card = document.getElementById('absent-streak-card');
        const list = document.getElementById('absent-streak-list');

        if (absentMembers.length === 0) {
            card.style.display = 'none';
            return;
        }

        card.style.display = 'block';
        list.innerHTML = absentMembers.map(m => `
      <div style="background: rgba(255,255,255,0.2); padding: 0.75rem; border-radius: 8px; margin-bottom: 0.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong>${m.member_name}</strong>
            <span style="opacity: 0.8; margin-left: 0.5rem;">${m.absent_weeks}주 연속 결석</span>
          </div>
          <div style="font-size: 0.875rem; opacity: 0.8;">
            마지막 출석: ${m.last_attendance || '기록 없음'}
          </div>
        </div>
      </div>
    `).join('');
    } catch (error) {
        console.error('연속 결석자 조회 오류:', error);
    }
}

// 출석률 추이 차트
async function loadTrends() {
    try {
        const months = document.getElementById('trends-months').value;
        let url = `/attendance/trends?months=${months}`;

        // 부서 필터링
        if (state.user.role !== 'super_admin' && state.user.department_id) {
            url += `&department_id=${state.user.department_id}`;
        }

        const data = await apiRequest(url);

        const ctx = document.getElementById('trends-chart');

        // 기존 차트 제거
        if (trendsChart) {
            trendsChart.destroy();
        }

        trendsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: '출석률 (%)',
                    data: data.data,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return `출석률: ${context.parsed.y}%`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function (value) {
                                return value + '%';
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('출석률 추이 조회 오류:', error);
    }
}

// 부서별 출석률 비교
async function loadDepartmentComparison() {
    try {
        const data = await apiRequest('/attendance/department-comparison');

        const ctx = document.getElementById('dept-comparison-chart');

        // 기존 차트 제거
        if (deptComparisonChart) {
            deptComparisonChart.destroy();
        }

        deptComparisonChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.departments,
                datasets: [{
                    label: '출석률 (%)',
                    data: data.rates,
                    backgroundColor: [
                        'rgba(102, 126, 234, 0.8)',
                        'rgba(118, 75, 162, 0.8)',
                        'rgba(237, 100, 166, 0.8)',
                        'rgba(255, 154, 158, 0.8)'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function (value) {
                                return value + '%';
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('부서별 비교 조회 오류:', error);
    }
}

// 목표 출석률 조회
async function loadGoals() {
    try {
        const goals = await apiRequest('/attendance/goals');
        const display = document.getElementById('goal-display');

        if (goals.length === 0) {
            display.innerHTML = '<p class="text-center text-secondary">목표가 설정되지 않았습니다.</p>';
            return;
        }

        const latestGoal = goals[0];
        display.innerHTML = `
      <div style="text-align: center;">
        <div style="font-size: 3rem; font-weight: 700; color: var(--primary);">${latestGoal.target_rate}%</div>
        <div style="color: var(--text-secondary); margin-top: 0.5rem;">
          ${latestGoal.period === 'weekly' ? '주간' : latestGoal.period === 'monthly' ? '월간' : '분기별'} 목표
        </div>
      </div>
    `;
    } catch (error) {
        console.error('목표 조회 오류:', error);
    }
}

// 목표 설정 폼
function showGoalForm() {
    const content = `
    <form id="goal-form">
      <div class="form-group">
        <label for="goal-target">목표 출석률 (%)</label>
        <input type="number" id="goal-target" min="0" max="100" step="1" required value="85">
      </div>
      <div class="form-group">
        <label for="goal-period">기간</label>
        <select id="goal-period">
          <option value="weekly">주간</option>
          <option value="monthly" selected>월간</option>
          <option value="quarterly">분기별</option>
        </select>
      </div>
    </form>
  `;

    const modal = createModal('목표 출석률 설정', content, [
        { text: '취소', class: 'btn-secondary', action: 'cancel' },
        { text: '설정', class: 'btn-primary', action: 'submit' }
    ]);

    modal.querySelector('[data-action="cancel"]').addEventListener('click', () => {
        closeModal(modal);
    });

    modal.querySelector('[data-action="submit"]').addEventListener('click', async () => {
        const target = document.getElementById('goal-target').value;
        const period = document.getElementById('goal-period').value;

        try {
            await apiRequest('/attendance/goals', {
                method: 'POST',
                body: JSON.stringify({
                    department_id: state.user.department_id,
                    target_rate: parseFloat(target),
                    period
                })
            });

            closeModal(modal);
            await loadGoals();
            alert('목표가 설정되었습니다');
        } catch (error) {
            alert(error.message);
        }
    });
}
