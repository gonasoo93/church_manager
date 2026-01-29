const fs = require('fs');
const path = require('path');

// 데이터 저장 경로
const dataDir = path.join(__dirname, '../../data');
const dbFile = path.join(dataDir, 'database.json');

// 데이터 디렉토리 생성
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 데이터베이스 초기 구조
let db = {
  departments: [],
  users: [],
  members: [],
  attendance: [],
  worship: [],
  meetings: [],
  _counters: {
    departments: 0,
    users: 0,
    members: 0,
    attendance: 0,
    worship: 0,
    meetings: 0
  }
};

// 데이터베이스 로드
function loadDatabase() {
  try {
    if (fs.existsSync(dbFile)) {
      const data = fs.readFileSync(dbFile, 'utf8');
      db = JSON.parse(data);

      // departments 테이블이 없으면 추가 (마이그레이션)
      if (!db.departments) {
        db.departments = [];
        db._counters.departments = 0;
      }
    }
  } catch (error) {
    console.error('데이터베이스 로드 오류:', error);
  }
}

// 데이터베이스 저장
function saveDatabase() {
  try {
    fs.writeFileSync(dbFile, JSON.stringify(db, null, 2), 'utf8');
  } catch (error) {
    console.error('데이터베이스 저장 오류:', error);
  }
}

// 기본 부서 생성
function createDefaultDepartments() {
  const defaultDepartments = [
    { name: '유아부', description: '유치부', age_range: '0-7세' },
    { name: '어린이부', description: '초등부', age_range: '8-13세' },
    { name: '청소년부', description: '중고등부', age_range: '14-19세' },
    { name: '청년부', description: '대학/청년', age_range: '20-30세' }
  ];

  defaultDepartments.forEach(dept => {
    const existing = db.departments.find(d => d.name === dept.name);
    if (!existing) {
      const id = ++db._counters.departments;
      const now = new Date().toISOString();
      db.departments.push({
        id,
        ...dept,
        created_at: now,
        updated_at: now
      });
    }
  });

  saveDatabase();
  console.log('✅ 기본 부서 생성 완료');
}

// 기존 데이터 마이그레이션
function migrateExistingData() {
  // 청소년부 ID 찾기
  const youthDept = db.departments.find(d => d.name === '청소년부');
  if (!youthDept) {
    console.error('청소년부를 찾을 수 없습니다');
    return;
  }

  let migrated = false;

  // members에 department_id 및 status 추가
  db.members.forEach(member => {
    let changed = false;
    if (!member.department_id) {
      member.department_id = youthDept.id;
      changed = true;
    }
    if (!member.status) {
      member.status = 'active'; // 기본값: 일반 (active), 장기결석 (long_term_absent)
      changed = true;
    }
    if (changed) migrated = true;
  });

  // attendance에 department_id 추가
  db.attendance.forEach(record => {
    if (!record.department_id) {
      record.department_id = youthDept.id;
      migrated = true;
    }
  });

  // worship에 department_id 추가
  db.worship.forEach(record => {
    if (!record.department_id) {
      record.department_id = youthDept.id;
      migrated = true;
    }
  });

  // meetings에 department_id 추가
  db.meetings.forEach(record => {
    if (!record.department_id) {
      record.department_id = youthDept.id;
      migrated = true;
    }
  });

  // users 역할 업데이트 (admin -> super_admin, user -> teacher)
  db.users.forEach(user => {
    let changed = false;
    if (user.role === 'admin') {
      user.role = 'super_admin';
      changed = true;
    } else if (user.role === 'user') {
      user.role = 'teacher'; // 일반 사용자를 교사로 변경
      changed = true;
    }

    if (changed) migrated = true;
  });

  if (migrated) {
    saveDatabase();
    console.log('✅ 기존 데이터 마이그레이션 완료');
  }
}

// 데이터베이스 초기화
function initializeDatabase() {
  loadDatabase();

  // visits 테이블 초기화 (loadDatabase에서 처리되지 않은 경우)
  if (!db.visits) {
    db.visits = [];
    db._counters.visits = 0;
    saveDatabase();
  }

  createDefaultDepartments();
  migrateExistingData();
  console.log('✅ 데이터베이스 초기화 완료');
}

// 간단한 쿼리 헬퍼
const query = {
  // SELECT
  all: (table) => {
    return db[table] || [];
  },

  get: (table, id) => {
    return db[table]?.find(item => item.id === parseInt(id));
  },

  findOne: (table, condition) => {
    return db[table]?.find(condition);
  },

  find: (table, condition) => {
    return db[table]?.filter(condition) || [];
  },

  // INSERT
  insert: (table, data) => {
    // 테이블 및 카운터 안전 초기화
    if (!db[table]) db[table] = [];
    if (typeof db._counters[table] === 'undefined') db._counters[table] = 0;

    const id = ++db._counters[table];
    const now = new Date().toISOString();
    const item = {
      id,
      ...data,
      created_at: now,
      updated_at: now
    };
    db[table].push(item);
    saveDatabase();
    return item;
  },

  // UPDATE
  update: (table, id, data) => {
    const index = db[table]?.findIndex(item => item.id === parseInt(id));
    if (index !== -1) {
      db[table][index] = {
        ...db[table][index],
        ...data,
        updated_at: new Date().toISOString()
      };
      saveDatabase();
      return db[table][index];
    }
    return null;
  },

  // DELETE
  delete: (table, id) => {
    const index = db[table]?.findIndex(item => item.id === parseInt(id));
    if (index !== -1) {
      db[table].splice(index, 1);
      saveDatabase();
      return true;
    }
    return false;
  },

  // UPSERT (출석용)
  upsert: (table, condition, data) => {
    const index = db[table]?.findIndex(condition);
    if (index !== -1) {
      db[table][index] = {
        ...db[table][index],
        ...data,
        updated_at: new Date().toISOString()
      };
    } else {
      const id = ++db._counters[table];
      const now = new Date().toISOString();
      db[table].push({
        id,
        ...data,
        created_at: now,
        updated_at: now
      });
    }
    saveDatabase();
  }
};

module.exports = { query, initializeDatabase };
