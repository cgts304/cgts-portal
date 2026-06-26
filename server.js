const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_FILE = path.join(__dirname, 'data.json');

// Permanent JSON Data Folder aur File checking
function initDatabase() {
    if (!fs.existsSync(DATA_FILE)) {
        const initialData = {
            students: [],
            content: [],
            leaderboard: [],
            notice: "CGTS Portal me aapka swagat hai!"
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
    }
}
initDatabase();

function readData() { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
function writeData(data) { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }

// Student Registration & Auth
app.post('/api/register', (req, res) => {
    const { name, mobile, password } = req.body;
    const data = readData();
    if (data.students.find(s => s.mobile === mobile)) {
        return res.json({ success: false, message: 'Yeh mobile number registered hai!' });
    }
    data.students.push({ id: Date.now(), name, mobile, password, status: 'pending' });
    writeData(data);
    res.json({ success: true, message: 'Registration safal! Admin approval ka wait karein.' });
});

app.post('/api/login', (req, res) => {
    const { mobile, password } = req.body;
    const data = readData();
    const student = data.students.find(s => s.mobile === mobile && s.password === password);
    if (!student) return res.json({ success: false, message: 'Galat credentials!' });
    if (student.status !== 'approved') return res.json({ success: false, message: 'Account pending hai!' });
    res.json({ success: true, student: { id: student.id, name: student.name, mobile: student.mobile } });
});

// Admin Auth & Live Stats Card Counter
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'praside1') {
        return res.json({ success: true, token: 'cgts_admin_secure_2026' });
    }
    res.status(401).json({ success: false });
});

app.get('/api/admin/stats', (req, res) => {
    const data = readData();
    const totalStudents = data.students.length;
    const pendingApprovals = data.students.filter(s => s.status === 'pending').length;
    const liveApproved = data.students.filter(s => s.status === 'approved').length;
    
    let totalTests = 0;
    data.content.forEach(c => { c.subjects.forEach(s => { totalTests += s.tests.length; }); });

    res.json({ totalStudents, pendingApprovals, liveApproved, totalTests });
});

app.get('/api/admin/students', (req, res) => { res.json(readData().students); });

app.post('/api/admin/student-status', (req, res) => {
    const { id, status } = req.body;
    let data = readData();
    if (status === 'delete') data.students = data.students.filter(s => s.id != id);
    else { const s = data.students.find(st => st.id == id); if(s) s.status = status; }
    writeData(data); res.json({ success: true });
});

// Notice Board APIs
app.get('/api/notice', (req, res) => { res.json({ notice: readData().notice || "" }); });
app.post('/api/admin/notice', (req, res) => {
    const { notice } = req.body;
    let data = readData();
    data.notice = notice;
    writeData(data);
    res.json({ success: true });
});

// Content Manage Tree
app.get('/api/content', (req, res) => { res.json(readData().content); });
app.get('/api/admin/content', (req, res) => { res.json(readData().content); });

app.post('/api/admin/course', (req, res) => {
    const { action, courseId, name } = req.body;
    let data = readData();
    if (action === 'create') data.content.push({ id: Date.now(), name, subjects: [] });
    else if (action === 'delete') data.content = data.content.filter(c => c.id != courseId);
    writeData(data); res.json({ success: true });
});

app.post('/api/admin/subject', (req, res) => {
    const { action, courseId, subjectId, name } = req.body;
    let data = readData();
    const c = data.content.find(co => co.id == courseId);
    if (c) {
        if (action === 'create') c.subjects.push({ id: Date.now(), name, tests: [] });
        else if (action === 'delete') c.subjects = c.subjects.filter(s => s.id != subjectId);
    }
    writeData(data); res.json({ success: true });
});

app.post('/api/admin/test', (req, res) => {
    const { action, courseId, subjectId, testId, name, questions } = req.body;
    let data = readData();
    try {
        const c = data.content.find(co => co.id == courseId);
        const s = c.subjects.find(su => su.id == subjectId);
        if (action === 'create') s.tests.push({ id: Date.now(), name, questions: [] });
        else if (action === 'delete') s.tests = s.tests.filter(t => t.id != testId);
        else if (action === 'update-questions') { const t = s.tests.find(te => te.id == testId); if (t) t.questions = questions; }
    } catch(e){}
    writeData(data); res.json({ success: true });
});

// Leaderboard Submissions (Dynamic Format Sync Optimized)
app.post('/api/test/submit', (req, res) => {
    const { studentName, mobile, testId, testName, score, totalQs } = req.body;
    let data = readData();
    if(!data.leaderboard) data.leaderboard = [];
    
    // Dynamic Subject Name extraction taaki leaderboard dropdown sync ho sake
    let formattedTestName = testName;
    try {
        data.content.forEach(c => {
            c.subjects.forEach(s => {
                const foundTest = s.tests.find(t => t.id == testId);
                if(foundTest) {
                    // It saves as: "Bal Vikas | Mock Test 01"
                    formattedTestName = `${s.name} | ${foundTest.name}`;
                }
            });
        });
    } catch(err) {}

    const alreadyExists = data.leaderboard.find(log => log.mobile == mobile && log.testId == testId);
    
    const attemptLog = {
        id: Date.now(),
        studentName,
        mobile,
        testId,
        testName: formattedTestName,
        score: parseFloat(score),
        totalQs,
        date: new Date().toLocaleDateString('hi-IN'),
        isFirstAttempt: !alreadyExists
    };
    data.leaderboard.push(attemptLog);
    writeData(data);
    res.json({ success: true, isFirstAttempt: !alreadyExists });
});

// Global Dynamic Leaderboard API
app.get('/api/leaderboard', (req, res) => {
    const data = readData();
    const records = data.leaderboard || [];
    const firstAttempts = records.filter(r => r.isFirstAttempt === true);
    res.json(firstAttempts.sort((a, b) => b.score - a.score));
});

app.get('/api/history/:mobile', (req, res) => {
    const data = readData();
    const records = data.leaderboard || [];
    res.json(records.filter(r => r.mobile == req.params.mobile));
});

app.listen(PORT, () => console.log(`Server optimized and safely running on port ${PORT}`));
