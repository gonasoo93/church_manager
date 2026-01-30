// 통합 검색 기능

let searchTimeout = null;

// 검색 초기화
function initSearch() {
    const searchInput = document.getElementById('global-search');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();

        if (query.length < 2) {
            hideSearchResults();
            return;
        }

        searchTimeout = setTimeout(() => {
            performSearch(query);
        }, 300);
    });

    // 검색창 외부 클릭 시 결과 숨기기
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            hideSearchResults();
        }
    });
}

async function performSearch(query) {
    try {
        const results = await apiRequest(`/search?q=${encodeURIComponent(query)}`);
        displaySearchResults(results);
    } catch (error) {
        console.error('검색 오류:', error);
    }
}

function displaySearchResults(results) {
    const searchContainer = document.querySelector('.search-container');

    // 기존 결과 제거
    let resultsDiv = document.getElementById('search-results');
    if (resultsDiv) {
        resultsDiv.remove();
    }

    // 결과가 없으면 표시 안 함
    const totalResults = (results.members?.length || 0) +
        (results.visits?.length || 0) +
        (results.meetings?.length || 0) +
        (results.worship?.length || 0);

    if (totalResults === 0) {
        return;
    }

    resultsDiv = document.createElement('div');
    resultsDiv.id = 'search-results';
    resultsDiv.style.cssText = `
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 0.5rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: 0 4px 6px var(--shadow);
    width: 400px;
    max-height: 500px;
    overflow-y: auto;
    z-index: 1000;
  `;

    let html = '<div style="padding: 1rem;">';

    // 학생 결과
    if (results.members && results.members.length > 0) {
        html += '<div style="margin-bottom: 1rem;"><strong>👥 학생</strong></div>';
        results.members.forEach(m => {
            html += `
        <div class="search-result-item" onclick="goToMember(${m.id})" style="padding: 0.75rem; margin-bottom: 0.5rem; background: var(--bg-tertiary); border-radius: var(--radius-sm); cursor: pointer;">
          <div><strong>${m.name}</strong></div>
          <div style="font-size: 0.875rem; color: var(--text-secondary);">${m.grade}학년 ${m.group}반</div>
        </div>
      `;
        });
    }

    // 심방 기록 결과
    if (results.visits && results.visits.length > 0) {
        html += '<div style="margin-bottom: 1rem; margin-top: 1rem;"><strong>📞 심방 기록</strong></div>';
        results.visits.forEach(v => {
            html += `
        <div class="search-result-item" style="padding: 0.75rem; margin-bottom: 0.5rem; background: var(--bg-tertiary); border-radius: var(--radius-sm);">
          <div><strong>${v.member_name}</strong> - ${v.date}</div>
          <div style="font-size: 0.875rem; color: var(--text-secondary);">${v.content.substring(0, 50)}...</div>
        </div>
      `;
        });
    }

    // 회의록 결과
    if (results.meetings && results.meetings.length > 0) {
        html += '<div style="margin-bottom: 1rem; margin-top: 1rem;"><strong>📝 회의록</strong></div>';
        results.meetings.forEach(m => {
            html += `
        <div class="search-result-item" onclick="showView('meetings')" style="padding: 0.75rem; margin-bottom: 0.5rem; background: var(--bg-tertiary); border-radius: var(--radius-sm); cursor: pointer;">
          <div><strong>${m.title}</strong></div>
          <div style="font-size: 0.875rem; color: var(--text-secondary);">${m.date}</div>
        </div>
      `;
        });
    }

    // 예배 기록 결과
    if (results.worship && results.worship.length > 0) {
        html += '<div style="margin-bottom: 1rem; margin-top: 1rem;"><strong>🙏 예배 기록</strong></div>';
        results.worship.forEach(w => {
            html += `
        <div class="search-result-item" onclick="showView('worship')" style="padding: 0.75rem; margin-bottom: 0.5rem; background: var(--bg-tertiary); border-radius: var(--radius-sm); cursor: pointer;">
          <div><strong>${w.sermon_title || '제목 없음'}</strong></div>
          <div style="font-size: 0.875rem; color: var(--text-secondary);">${w.date}</div>
        </div>
      `;
        });
    }

    html += '</div>';
    resultsDiv.innerHTML = html;

    searchContainer.style.position = 'relative';
    searchContainer.appendChild(resultsDiv);
}

function hideSearchResults() {
    const resultsDiv = document.getElementById('search-results');
    if (resultsDiv) {
        resultsDiv.remove();
    }
}

function goToMember(memberId) {
    hideSearchResults();
    showView('members');
    // 멤버 상세 보기는 추후 구현
}

// 페이지 로드 시 검색 초기화
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSearch);
} else {
    initSearch();
}
