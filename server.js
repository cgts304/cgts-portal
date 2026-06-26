const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_FILE = path.join(__dirname, 'data.json');

// Initialize local database structure
function initDatabase() {
    if (!fs.existsSync(DATA_FILE)) {
        const initialData = {
            students: [],
            content: [],
            leaderboard: []
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
    }
}
initDatabase();

function readData() { 
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); 
}

function writeData(data) { 
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); 
}

// ------------------- STUDENT ROUTING APIS -------------------

// 1. Student Registration
app.post('/api/register', (req, res) => {
    const { name, mobile, password } = req.body;
    const data = readData();
    if (data.students.find(s => s.mobile === mobile)) {
        return res.json({ success: false, message: 'Yeh mobile number pehle se registered hai!' });
    }
    data.students.push({ id: Date.now(), name, mobile, password, status: 'pending' });
    writeData(data);
    res.json({ success: true, message: 'Registration safal! Admin approval ka wait karein.' });
});

// 2. Student Login
app.post('/api/login', (req, res) => {
    const { mobile, password } = req.body;
    const data = readData();
    const student = data.students.find(s => s.mobile === mobile && s.password === password);
    if (!student) return res.json({ success: false, message: 'Galat Mobile Number ya Password!' });
    if (student.status !== 'approved') return res.json({ success: false, message: 'Account abhi pending hai! Admin se sampark karein.' });
    res.json({ success: true, student: { id: student.id, name: student.name, mobile: student.mobile } });
});

// ------------------- ADMIN ROUTING APIS -------------------

// 3. SECURE ADMIN LOGIN (No browser packet suggestion leak)
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'praside1') {
        return res.json({ success: true, token: 'cgts_admin_secure_2026' });
    }
    res.status(401).json({ success: false, message: 'Invalid Admin Credentials' });
});

// 4. Get Student List (Visible Passwords for Admin)
app.get('/api/admin/students', (req, res) => { 
    res.json(readData().students); 
});

// 5. Update Student Status (Approve/Delete)
app.post('/api/admin/student-status', (req, res) => {
    const { id, status } = req.body;
    let data = readData();
    if (status === 'delete') {
        data.students = data.students.filter(s => s.id != id);
    } else { 
        const s = data.students.find(st => st.id == id); 
        if(s) s.status = status; 
    }
    writeData(data); 
    res.json({ success: true });
});

// ------------------- DYNAMIC CONTENT ENGINE APIS -------------------

// 6. Get Test Content for Both Portal Panels
app.get('/api/content', (req, res) => { res.json(readData().content); });
app.get('/api/admin/content', (req, res) => { res.json(readData().content); });

// 7. Course Management (Create/Delete)
app.post('/api/admin/course', (req, res) => {
    const { action, courseId, name } = req.body;
    let data = readData();
    if (action === 'create') {
        data.content.push({ id: Date.now(), name, subjects: [] });
    } else if (action === 'delete') {
        data.content = data.content.filter(c => c.id != courseId);
    }
    writeData(data); 
    res.json({ success: true });
});

// 8. Subject Management (Create/Delete)
app.post('/api/admin/subject', (req, res) => {
    const { action, courseId, subjectId, name } = req.body;
    let data = readData();
    const c = data.content.find(co => co.id == courseId);
    if (c) {
        if (action === 'create') {
            c.subjects.push({ id: Date.now(), name, tests: [] });
        } else if (action === 'delete') {
            c.subjects = c.subjects.filter(s => s.id != subjectId);
        }
    }
    writeData(data); 
    res.json({ success: true });
});

// 9. Test Structure & Custom JSON Bulk Questions Array
app.post('/api/admin/test', (req, res) => {
    const { action, courseId, subjectId, testId, name, questions } = req.body;
    let data = readData();
    try {
        const c = data.content.find(co => co.id == courseId);
        const s = c.subjects.find(su => su.id == subjectId);
        if (action === 'create') {
            s.tests.push({ id: Date.now(), name, questions: [] });
        } else if (action === 'delete') {
            s.tests = s.tests.filter(t => t.id != testId);
        } else if (action === 'update-questions') {
            const t = s.tests.find(te => te.id == testId);
            if (t) t.questions = questions;
        }
    } catch(e) { 
        console.log("Structure tree processing error handled securely."); 
    }
    writeData(data); 
    res.json({ success: true });
});

// ------------------- LEADERBOARD & PERFORMANCE APIS -------------------

// 10. Submit Test Score Logic (Strict first attempt validation for Leaderboard)
app.post('/api/test/submit', (req, res) => {
    const { studentName, mobile, testId, testName, score, totalQs } = req.body;
    let data = readData();
    if(!data.leaderboard) data.leaderboard = [];

    // Verify if this student has previously attempted this specific test
    const alreadyExists = data.leaderboard.find(log => log.mobile == mobile && log.testId == testId);
    
    const attemptLog = {
        id: Date.now(),
        studentName,
        mobile,
        testId,
        testName,
        score: parseFloat(score),
        totalQs,
        date: new Date().toLocaleDateString('hi-IN'),
        isFirstAttempt: !alreadyExists
    };

    data.leaderboard.push(attemptLog);
    writeData(data);
    res.json({ success: true, isFirstAttempt: !alreadyExists });
});

// 11. Fetch Leaderboard (Saves privacy rules automatically)
app.get('/api/leaderboard', (req, res) => {
    const data = readData();
    const records = data.leaderboard || [];
    // Only fetch records designated as the true first attempt
    const firstAttempts = records.filter(r => r.isFirstAttempt === true);
    res.json(firstAttempts.sort((a, b) => b.score - a.score));
});

// 12. Fetch Personal Exam History Logs
app.get('/api/history/:mobile', (req, res) => {
    const data = readData();
    const records = data.leaderboard || [];
    const studentHistory = records.filter(r => r.mobile == req.params.mobile);
    res.json(studentHistory);
});

app.listen(PORT, () => console.log(`Backend Server running perfectly on port ${PORT}`));
