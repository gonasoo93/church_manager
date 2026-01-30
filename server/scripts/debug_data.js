const mongoose = require('mongoose');
const Department = require('../models/Department');
const Member = require('../models/Member');
const User = require('../models/User');
require('dotenv').config();

console.log('Connecting to:', process.env.MONGODB_URI);

mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        console.log('\n=== DEPARTMENTS ===');
        const depts = await Department.find().sort({ _id: 1 });
        depts.forEach(d => {
            console.log(`ID: ${d._id}, Name: ${d.name}`);
        });

        console.log('\n=== MEMBERS (first 5) ===');
        const members = await Member.find().limit(5);
        members.forEach(m => {
            console.log(`ID: ${m._id}, Name: ${m.name}, DeptID: ${m.department_id}, Dept: ${m.department}`);
        });

        console.log('\n=== USERS ===');
        const users = await User.find().select('-password');
        users.forEach(u => {
            console.log(`ID: ${u._id}, Username: ${u.username}, Role: ${u.role}, DeptID: ${u.department_id}`);
        });

        process.exit();
    })
    .catch(err => {
        console.error('Connection Error:', err);
        process.exit(1);
    });
