const jwt = require('jsonwebtoken');
require('dotenv').config();

const secret = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
console.log('Using Secret:', secret);

const token = jwt.sign(
    { id: 1, username: 'admin', role: 'super_admin' },
    secret
);

async function test() {
    try {
        console.log('Testing Meeting Create API...');
        const response = await fetch('http://localhost:3000/api/meetings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                title: '테스트 회의',
                date: '2024-01-30',
                content: '테스트 내용입니다.',
                department_id: 3
            })
        });

        const data = await response.json();
        console.log('Status:', response.status);
        console.log('Response:', data);
    } catch (err) {
        console.error('Error:', err);
    }
}
test();
