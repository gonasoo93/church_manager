require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Models
const User = require('../models/User');
const Member = require('../models/Member');
const Department = require('../models/Department');
const Attendance = require('../models/Attendance');
const Visit = require('../models/Visit');
const Worship = require('../models/Worship');
const Counter = require('../models/Counter');
const Meeting = require('../models/Meeting');

// 이 함수가 외부에서 호출될 때 DB 연결은 이미 되어 있다고 가정하거나 체크
const importData = async (isStandalone = false) => {
    try {
        if (isStandalone) {
            await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/youth-church');
            console.log('MongoDB Connected');
        }

        // Load JSON data
        const dbPath = path.join(__dirname, '../../data/database.json');
        if (!fs.existsSync(dbPath)) {
            console.error('database.json not found');
            if (isStandalone) process.exit(1);
            return { success: false, message: 'database.json not found' };
        }
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

        /* 데이터 삭제 및 재생성 */

        // 1. Departments
        if (data.departments && data.departments.length > 0) {
            await Department.deleteMany({});
            const depts = data.departments.map(d => ({ ...d, _id: d.id }));
            await Department.insertMany(depts);
        }

        // 2. Users
        if (data.users && data.users.length > 0) {
            await User.deleteMany({});
            const users = data.users.map(u => ({ ...u, _id: u.id, role: u.role === 'admin' ? 'super_admin' : u.role }));
            await User.insertMany(users);
        }

        // 3. Members
        if (data.members && data.members.length > 0) {
            await Member.deleteMany({});
            const members = data.members.map(m => ({ ...m, _id: m.id }));
            await Member.insertMany(members);
        }

        // 4. Attendance
        if (data.attendance && data.attendance.length > 0) {
            await Attendance.deleteMany({});
            const atts = data.attendance.map(a => ({ ...a, _id: a.id }));
            await Attendance.insertMany(atts);
        }

        // 5. Visits
        if (data.visits && data.visits.length > 0) {
            await Visit.deleteMany({});
            const visits = data.visits.map(v => ({ ...v, _id: v.id }));
            await Visit.insertMany(visits);
        }

        // 6. Worship
        if (data.worship && data.worship.length > 0) {
            await Worship.deleteMany({});
            const worships = data.worship.map(w => ({ ...w, _id: w.id }));
            await Worship.insertMany(worships);
        }

        // 7. Meetings
        if (data.meetings && data.meetings.length > 0) {
            await Meeting.deleteMany({});
            const meetings = data.meetings.map(m => ({ ...m, _id: m.id }));
            await Meeting.insertMany(meetings);
        }

        // 8. Counters
        if (data._counters) {
            await Counter.deleteMany({});
            const counters = Object.keys(data._counters).map(key => ({
                _id: key,
                seq: data._counters[key]
            }));
            await Counter.insertMany(counters);
        }

        console.log('Data Import Completed!');
        if (isStandalone) process.exit();
        return { success: true, message: 'Data Imported Successfully' };

    } catch (error) {
        console.error('Error with data import:', error);
        if (isStandalone) process.exit(1);
        throw error;
    }
};

// 직접 실행 시
if (require.main === module) {
    importData(true);
}

module.exports = importData;
