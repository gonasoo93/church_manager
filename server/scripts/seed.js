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

// DB Connection
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/youth-church');
        console.log('MongoDB Connected');
    } catch (error) {
        console.error('MongoDB Connection Error:', error);
        process.exit(1);
    }
};

const importData = async () => {
    try {
        await connectDB();

        // Load JSON data
        const dbPath = path.join(__dirname, '../../data/database.json');
        if (!fs.existsSync(dbPath)) {
            console.error('database.json not found');
            process.exit(1);
        }
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

        // 1. Departments
        if (data.departments && data.departments.length > 0) {
            await Department.deleteMany({});
            const depts = data.departments.map(d => ({ ...d, _id: d.id }));
            await Department.insertMany(depts);
            console.log('Departments Imported');
        }

        // 2. Users ( legacy role adjustment handled in app? or here?)
        if (data.users && data.users.length > 0) {
            await User.deleteMany({});
            const users = data.users.map(u => ({ ...u, _id: u.id, role: u.role === 'admin' ? 'super_admin' : u.role }));
            // Password hashing is typically already done in JSON
            await User.insertMany(users);
            console.log('Users Imported');
        }

        // 3. Members
        if (data.members && data.members.length > 0) {
            await Member.deleteMany({});
            const members = data.members.map(m => ({ ...m, _id: m.id }));
            await Member.insertMany(members);
            console.log('Members Imported');
        }

        // 4. Attendance
        if (data.attendance && data.attendance.length > 0) {
            await Attendance.deleteMany({});
            // Attendance might not have id in JSON if it was array of objects without id management?
            // Checking db.js logic: insert creates id using counter.
            // So attendance records should have ids.
            const atts = data.attendance.map(a => ({ ...a, _id: a.id }));
            await Attendance.insertMany(atts);
            console.log('Attendance Imported');
        }

        // 5. Visits
        if (data.visits && data.visits.length > 0) {
            await Visit.deleteMany({});
            const visits = data.visits.map(v => ({ ...v, _id: v.id }));
            await Visit.insertMany(visits);
            console.log('Visits Imported');
        }

        // 6. Worship (if exists)
        if (data.worship && data.worship.length > 0) {
            await Worship.deleteMany({});
            const worships = data.worship.map(w => ({ ...w, _id: w.id }));
            await Worship.insertMany(worships);
            console.log('Worship Imported');
        }

        // 7. Counters
        if (data._counters) {
            await Counter.deleteMany({});
            const counters = Object.keys(data._counters).map(key => ({
                _id: key,
                seq: data._counters[key]
            }));
            await Counter.insertMany(counters);
            console.log('Counters Imported');
        }

        console.log('Data Import Completed!');
        process.exit();
    } catch (error) {
        console.error('Error with data import:', error);
        process.exit(1);
    }
};

importData();
