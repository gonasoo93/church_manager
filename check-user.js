const db = require('./server/db');

async function checkUser() {
    try {
        const users = await db.query('SELECT id, username, name, role, department_id FROM users');
        console.log('=== 사용자 목록 ===');
        console.log(JSON.stringify(users, null, 2));
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkUser();
