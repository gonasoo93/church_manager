require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
const { connectDB } = require('./config/db');
const User = require('./models/User');
const Department = require('./models/Department');
const Counter = require('./models/Counter');

const app = express();
const PORT = process.env.PORT || 3000;

// 요청 로깅
app.use((req, res, next) => {
    console.log(`[REQ] ${req.method} ${req.url}`);
    next();
});

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// 데이터베이스 연결
connectDB();

// 초기 데이터 설정 (부서, 카운터, 관리자)
async function initData() {
    try {
        // 1. 카운터 초기화
        const tables = ['users', 'members', 'attendance', 'visits', 'worship', 'departments'];
        for (const table of tables) {
            const exists = await Counter.exists({ _id: table });
            if (!exists) {
                await Counter.create({ _id: table, seq: 0 });
            }
        }

        // 2. 부서 초기화 (기존 ID 유지)
        const deptCount = await Department.countDocuments();
        if (deptCount === 0) {
            const depts = [
                { _id: 1, name: '교역자' },
                { _id: 2, name: '어린이부' },
                { _id: 3, name: '청소년부' },
                { _id: 4, name: '청년부' }
            ];
            await Department.insertMany(depts);

            // Counter update
            await Counter.findByIdAndUpdate('departments', { seq: 4 }, { upsert: true });

            console.log('✅ 기본 부서 생성 완료');
        }

        // 3. 관리자 계정 생성
        const adminExists = await User.findOne({ username: process.env.ADMIN_USERNAME || 'admin' });
        if (!adminExists) {
            // ID 생성
            const counter = await Counter.findByIdAndUpdate(
                'users',
                { $inc: { seq: 1 } },
                { new: true, upsert: true }
            );

            const hashedPassword = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10);

            await User.create({
                _id: counter.seq,
                username: process.env.ADMIN_USERNAME || 'admin',
                password: hashedPassword,
                name: process.env.ADMIN_NAME || '관리자',
                role: 'super_admin' // role name corrected to match schema default or logic
            });

            console.log('✅ 초기 관리자 계정이 생성되었습니다');
            console.log(`   아이디: ${process.env.ADMIN_USERNAME || 'admin'}`);
            console.log(`   비밀번호: ${process.env.ADMIN_PASSWORD || 'admin123'}`);
        }

    } catch (error) {
        console.error('데이터 초기화 오류:', error);
    }
}

initData();

// API 라우트
app.use('/api/auth', require('./routes/auth'));
app.use('/api/departments', require('./routes/departments'));
app.use('/api/members', require('./routes/members'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/worship', require('./routes/worship'));
app.use('/api/visits', require('./routes/visits'));

// API 경로에 대한 404 처리 (HTML 대신 JSON 반환)
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'API 엔드포인트를 찾을 수 없습니다' });
});

// SPA를 위한 fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`\n🚀 청소년교회 관리 시스템 서버가 시작되었습니다`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`\n환경 설정을 위해 .env 파일을 확인하세요\n`);
});
