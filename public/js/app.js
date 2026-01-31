// API 기본 URL
const API_URL = window.location.origin + '/api';

// 전역 상태
const state = {
    user: null,
    token: null,
    currentPage: 'dashboard'
};

// 로컬 스토리지에서 토큰 로드
function loadToken() {
    const token = localStorage.getItem('token');
    if (token) {
        state.token = token;
        return true;
    }
    return false;
}

// 토큰 저장
function saveToken(token) {
    state.token = token;
    localStorage.setItem('token', token);
}

// 토큰 삭제
function clearToken() {
    state.token = null;
    localStorage.removeItem('token');
}

// API 요청 헬퍼
async function apiRequest(endpoint, options = {}) {
    const url = `${API_URL}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
    }

    try {
        const response = await fetch(url, {
            ...options,
            headers
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || '요청 처리 중 오류가 발생했습니다');
        }

        return data;
    } catch (error) {
        console.error('API 요청 오류:', error);
        throw error;
    }
}

// 페이지 전환
function showPage(pageName) {
    // 열려있는 모달 닫기 (화면 가림 방지)
    const modalContainer = document.getElementById('modal-container');
    if (modalContainer) {
        modalContainer.innerHTML = '';
    }

    // 모든 페이지 숨기기
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    // 선택한 페이지 표시
    const page = document.getElementById(`${pageName}-page`);
    if (page) {
        page.classList.add('active');
    }
}

// 뷰 전환
function showView(viewName) {
    state.currentPage = viewName;

    // 모든 뷰 숨기기
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });

    // 네비게이션 링크 업데이트
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.page === viewName) {
            link.classList.add('active');
        }
    });

    // 선택한 뷰 표시
    const view = document.getElementById(`${viewName}-view`);
    if (view) {
        view.classList.add('active');
    }

    // 뷰별 초기화 함수 호출
    const initFunctions = {
        'dashboard': initDashboard,
        'members': initMembers,
        'attendance': initAttendance,
        'worship': initWorship,
        'meetings': initMeetings,
        'announcements': initAnnouncements,
        'groups': initGroups,
        'group-leader-dashboard': initGroupLeaderDashboard,
        'events': initEvents,
        'admin': initAdmin,
        'profile': initProfile
    };

    if (initFunctions[viewName]) {
        initFunctions[viewName]();
    }
}

// 모달 생성
function createModal(title, content, buttons = []) {
    const modalContainer = document.getElementById('modal-container');

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        ${content}
      </div>
      <div class="modal-footer">
        ${buttons.map(btn => `
          <button class="btn ${btn.class || 'btn-secondary'}" data-action="${btn.action}">
            ${btn.text}
          </button>
        `).join('')}
      </div>
    </div>
  `;

    modalContainer.appendChild(modal);

    // 닫기 버튼
    modal.querySelector('.modal-close').addEventListener('click', () => {
        closeModal(modal);
    });

    // 오버레이 클릭으로 닫기
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal(modal);
        }
    });

    return modal;
}

// 모달 닫기
function closeModal(modal) {
    modal.style.animation = 'fadeOut 0.2s ease-out';
    setTimeout(() => {
        modal.remove();
    }, 200);
}

// 에러 표시
function showError(message, element) {
    if (element) {
        element.textContent = message;
        element.classList.add('show');
        setTimeout(() => {
            element.classList.remove('show');
        }, 5000);
    } else {
        alert(message);
    }
}

// 날짜 포맷팅
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR');
}

// 시간 포맷팅
function formatTime(timeString) {
    if (!timeString) return '';
    return timeString;
}

// 날짜 + 시간 포맷팅
function formatDateTime(dateString, timeString) {
    const date = formatDate(dateString);
    const time = formatTime(timeString);
    return time ? `${date} ${time}` : date;
}

// 대시보드 초기화
async function initDashboard() {
    try {
        // 통계 데이터 로드
        const [members, worship, meetings] = await Promise.all([
            apiRequest('/members'),
            apiRequest('/worship'),
            apiRequest('/meetings')
        ]);

        // 전체 청소년 수
        document.getElementById('total-members').textContent = members.length;

        // 부서별 라벨 업데이트
        const memberLabel = document.getElementById('label-total-members-text');
        if (memberLabel) {
            const deptName = state.user.department_name || (state.user.role === 'super_admin' ? '전체' : '부서');
            // 부서명 마지막 글자가 '부'로 끝나면 '학생', 아니면 '교인' 등 유동적으로 처리 가능하나 편의상 '학생' 통일 또는 부서명+학생
            // '청년부' -> '청년부원', '유아부' -> '유아부원' 등이 자연스러움
            memberLabel.textContent = `전체 ${deptName} 학생`;
        }

        // 예배 기록 수
        document.getElementById('total-worship').textContent = worship.length;

        // 회의 기록 수
        document.getElementById('total-meetings').textContent = meetings.length;

        // 최근 한달 출석률 계산
        const today = new Date();
        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        const monthAgoStr = monthAgo.toISOString().split('T')[0];
        const todayStr = today.toISOString().split('T')[0];

        const stats = await apiRequest(`/attendance/stats?startDate=${monthAgoStr}&endDate=${todayStr}`);

        if (stats.length > 0) {
            const totalPresent = stats.reduce((sum, s) => sum + s.present_count, 0);
            const totalCount = stats.reduce((sum, s) => sum + s.total_count, 0);
            const attendanceRate = totalCount > 0 ? Math.round((totalPresent / totalCount) * 100) : 0;
            document.getElementById('week-attendance').textContent = `${attendanceRate}%`;
        }

        // 최근 활동 로드
        await loadRecentActivities();

    } catch (error) {
        console.error('대시보드 로드 오류:', error);
    }
}

// 최근 활동 로드
async function loadRecentActivities() {
    try {
        const container = document.getElementById('recent-activities');
        let html = '';

        // 1. 다가오는 행사
        try {
            const events = await apiRequest('/features/events');
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const upcomingEvents = events
                .filter(e => new Date(e.event_date) >= today)
                .sort((a, b) => new Date(a.event_date) - new Date(b.event_date))
                .slice(0, 3);

            if (upcomingEvents.length > 0) {
                html += '<div class="activity-section"><h4>🎉 다가오는 행사</h4>';
                upcomingEvents.forEach(e => {
                    const date = new Date(e.event_date).toLocaleDateString();
                    const daysUntil = Math.ceil((new Date(e.event_date) - today) / (1000 * 60 * 60 * 24));
                    const daysText = daysUntil === 0 ? '오늘' : daysUntil === 1 ? '내일' : `${daysUntil}일 후`;
                    html += `
                        <div class="activity-item">
                            <div class="activity-title">${e.title}</div>
                            <div class="activity-meta">${date} · ${daysText}</div>
                        </div>
                    `;
                });
                html += '</div>';
            }
        } catch (e) {
            console.error('행사 로드 실패:', e);
        }

        // 2. 최근 공지사항 (최대 3개)
        try {
            const announcements = await apiRequest('/announcements?limit=3');
            if (announcements.length > 0) {
                html += '<div class="activity-section"><h4>📢 최근 공지</h4>';
                announcements.slice(0, 3).forEach(a => {
                    const date = new Date(a.created_at).toLocaleDateString();
                    html += `
                        <div class="activity-item">
                            <div class="activity-title">${a.title}</div>
                            <div class="activity-meta">${date}</div>
                        </div>
                    `;
                });
                html += '</div>';
            }
        } catch (e) {
            console.error('공지사항 로드 실패:', e);
        }

        // 3. 최근 예배 기록 (최대 3개)
        try {
            const worship = await apiRequest('/worship?limit=3');
            if (worship.length > 0) {
                html += '<div class="activity-section"><h4>📖 최근 예배</h4>';
                worship.slice(0, 3).forEach(w => {
                    const date = new Date(w.date).toLocaleDateString();
                    html += `
                        <div class="activity-item">
                            <div class="activity-title">${w.title || '제목 없음'}</div>
                            <div class="activity-meta">${date} · ${w.speaker || '-'}</div>
                        </div>
                    `;
                });
                html += '</div>';
            }
        } catch (e) {
            console.error('예배 기록 로드 실패:', e);
        }

        // 4. 최근 회의 기록 (최대 3개)
        try {
            const meetings = await apiRequest('/meetings?limit=3');
            if (meetings.length > 0) {
                html += '<div class="activity-section"><h4>💼 최근 회의</h4>';
                meetings.slice(0, 3).forEach(m => {
                    const date = new Date(m.date).toLocaleDateString();
                    html += `
                        <div class="activity-item">
                            <div class="activity-title">${m.title || '제목 없음'}</div>
                            <div class="activity-meta">${date}</div>
                        </div>
                    `;
                });
                html += '</div>';
            }
        } catch (e) {
            console.error('회의 기록 로드 실패:', e);
        }

        if (html === '') {
            html = '<p class="empty-state">활동 내역이 없습니다</p>';
        }

        container.innerHTML = html;
    } catch (error) {
        console.error('최근 활동 로드 오류:', error);
    }
}

// 앱 초기화
function initApp() {
    // 네비게이션 이벤트
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            showView(page);
        });
    });

    // 로그아웃 버튼
    document.getElementById('logout-btn').addEventListener('click', logout);

    // 관리자 메뉴 표시
    if (state.user && (state.user.role === 'super_admin' || state.user.role === 'department_admin' || state.user.role === 'admin')) {
        document.querySelectorAll('.admin-only').forEach(el => {
            el.classList.add('show');
        });
    }

    // 대시보드 표시
    showView('dashboard');
}

// 사용자 정보 표시 업데이트
function updateUserDisplay() {
    if (state.user) {
        document.getElementById('user-name').textContent = state.user.name;

        const roleMap = {
            'super_admin': '총괄',
            'department_admin': '부서',
            'admin': '관리자',
            'user': '일반'
        };

        document.getElementById('user-role').textContent = roleMap[state.user.role] || '일반';
    }
}

// 페이지 로드 시
document.addEventListener('DOMContentLoaded', () => {
    if (loadToken()) {
        // 토큰이 있으면 사용자 정보 로드
        checkAuth();
    } else {
        // 로그인 페이지 표시
        showPage('login');
    }
});

// 사용자 정보 표시 업데이트
function updateUserDisplay() {
    if (!state.user) return;

    // 네비게이션바 사용자 정보
    const navbarUser = document.querySelector('.navbar-user');
    if (navbarUser) {
        navbarUser.innerHTML = `
            <div class="user-info">
                <span class="user-name">${state.user.name}</span>
                <span class="user-role">${state.user.department_name || (state.user.role === 'super_admin' ? '총괄 관리자' : '일반 사용자')}</span>
            </div>
            <button id="logout-btn" class="btn btn-sm btn-outline">로그아웃</button>
        `;

        document.getElementById('logout-btn').addEventListener('click', logout);
    }

    // 브랜드 이름 (부서명) 업데이트
    const brandName = document.querySelector('.navbar-brand span');
    if (brandName) {
        brandName.textContent = state.user.department_name || '청소년교회';
    }

    // 페이지 타이틀도 업데이트
    document.title = `${state.user.department_name || '청소년교회'} 관리 시스템`;
}

// 전역 함수로 노출
window.updateUserDisplay = updateUserDisplay;
