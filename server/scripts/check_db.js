const mongoose = require('mongoose');
const Department = require('../models/Department');
require('dotenv').config();

console.log('Checking DB connection to:', process.env.MONGODB_URI);

mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        console.log('Connected!');
        const depts = await Department.find().sort({ _id: 1 });
        console.log('Current Departments in DB:');
        depts.forEach(d => {
            console.log(`[ID: ${d._id}] ${d.name}`);
        });
        process.exit();
    })
    .catch(err => {
        console.error('Connection Error:', err);
        process.exit(1);
    });
