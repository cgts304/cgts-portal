const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken'); // Purane token-based admin auth ke liye
const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = "CGTS_SUPER_SECRET_KEY"; // Admin authentication signature

app.use(express.json());
app.use(express.static(__dirname)); // Static frontend HTML files ko serve karne ke liye

// ==========================================
// 🛡️ CRASH PROTECTION CODE (Server Hamesha Chalu Rakhega)
// ==========================================
process.on('uncaughtException', (err) => {
    console.error('⚠️ SERVER SYSTEM ERROR BLOCKED (Uncaught Exception):', err.message);
    // Yeh runtime exceptions ko bypass karke server ko band nahi hone dega
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ PROMISE REJECTION BLOCKED:', reason);
    // Yeh async-await errors ko lock karega aur runtime chalu rakhega
});

// ==========================================
// 💾 PERMANENT DATA STORAGE (JSON FILES SETUP)
// ==========================================
const STUDENTS_FILE = path.join(__dirname, 'students.json');
const CONTENT_FILE = path.join(__dirname, 'content.json');
const NOTICE_FILE = path.join(__dirname, 'notice.json');
const LEADERBOARD_FILE = path.join(__dirname, 'leaderboard.json');
const ADMIN_CONFIG_FILE = path.join(__dirname, 'admin_config.json');

// Defualt files verification aur initial JSON array structural writing
if (!fs.existsSync(STUDENTS_FILE)) fs.writeFileSync(STUDENTS_FILE, JSON.stringify([]));
if (!fs.existsSync(CONTENT_FILE)) fs.writeFileSync(CONTENT_FILE, JSON.stringify([]));
if (!fs.existsSync(NOTICE_FILE)) fs.writeFileSync(NOTICE_FILE, JSON.stringify({ notice: "Welcome to CGTS Online Portal!" }));
if (!fs.existsSync(LEADERBOARD_FILE)) fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify([]));
if (!fs.existsSync(ADMIN_CONFIG_FILE)) {
    fs.writeFileSync(ADMIN_CONFIG_FILE, JSON.stringify({ username: "admin", password: "cgtsadminpassword" }));
}

// Helpers for reading and updating local file DB state instantly
const readData = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeData = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');

// Middleware for Admin Route Protection (Puraney logic ke mutabik)
function verifyAdminToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: "Access Denied: Token Missing!" });
    
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(403).json({ message: "Invalid Token!" });
        req.admin = decoded;
        next();
    });
}

// ==========================================
// 📑 PURANE & NAYE MIXED API ENDPOINTS
// ==========================================

// --- [STUDENT ACCOUNT SECTION] ---

// 1. Student Registration (Data persistent JSON file me save hoga)
app.post('/api/register', (req, res) => {
    try {
        const { name, mobile, password } = req.body;
        let students = readData(STUDENTS_FILE);

        const exists = students.find(s => s.mobile === mobile);
        if (exists) return res.status(400).json({ success: false, message: "⚠️ Yeh Mobile Number pehle se registered hai!" });

        const newStudent = { id: Date.now(), name, mobile, password, status: 'pending' };
        students.push(newStudent);
        writeData(STUDENTS_FILE, students);

        res.json({ success: true, message: "✅ Registration safalta purvak ho gaya! Admin approval ka intezar karein." });
    } catch (e) {
        res.status(500).json({ success: false, message: "Server error occurred." });
    }
});

// 2. Student Login Verification
app.post('/api/login', (req, res) => {
    const { mobile, password } = req.body;
    const students = readData(STUDENTS_FILE);
    const student = students.find(s => s.mobile === mobile && s.password === password);

    if (!student) return res.json({ success: false, message: "⚠️ Galat mobile number ya password!" });
    if (student.status !== 'approved') return res.json({ success: false, message: "⚠️ Aapka account abhi tak Admin dwara approve nahi kiya gaya hai!" });

    res.json({ success: true, student });
});


// --- [ADMIN AREA SECTION] ---

// 3. Admin Dynamic Verification & Login (Generates JWT)
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    const adminConfig = readData(ADMIN_CONFIG_FILE);

    if (username === adminConfig.username && password === adminConfig.password) {
        const token = jwt.sign({ user: username }, SECRET_KEY, { expiresIn: '2h' });
        res.json({ success: true, token });
    } else {
        res.status(401).json({ success: false, message: "Galat Admin ID ya Password!" });
    }
});

// 4. Change Admin Credentials Panel API
app.post('/api/admin/change-credentials', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: "Fields empty!" });

    writeData(ADMIN_CONFIG_FILE, { username, password });
    res.json({ success: true, message: "Credentials changed successfully!" });
});


// --- [CONTENT & TEST STRUCTURE SYSTEM] ---

// 5. Get Live Content Tree Data
app.get('/api/content', (req, res) => res.json(readData(CONTENT_FILE)));
app.get('/api/admin/content', (req, res) => res.json(readData(CONTENT_FILE)));

// 6. Manage Courses Matrix
app.post('/api/admin/course', (req, res) => {
    const { action, courseId, name } = req.body;
    let content = readData(CONTENT_FILE);

    if (action === 'create') {
        content.push({ id: Date.now(), name, subjects: [] });
    } else if (action === 'delete') {
        content = content.filter(c => c.id !== courseId);
    }
    writeData(CONTENT_FILE, content);
    res.json({ success: true });
});

// 7. Manage Subject Nodes
app.post('/api/admin/subject', (req, res) => {
    const { action, courseId, subjectId, name } = req.body;
    let content = readData(CONTENT_FILE);
    let course = content.find(c => c.id === courseId);

    if (course) {
        if (action === 'create') {
            course.subjects.push({ id: Date.now(), name, tests: [] });
        } else if (action === 'delete') {
            course.subjects = course.subjects.filter(s => s.id !== subjectId);
        }
        writeData(CONTENT_FILE, content);
    }
    res.json({ success: true });
});

// 8. Manage Tests & Question Sets
app.post('/api/admin/test', (req, res) => {
    const { action, courseId, subjectId, testId, name, questions } = req.body;
    let content = readData(CONTENT_FILE);
    let course = content.find(c => c.id === courseId);
    let subject = course?.subjects.find(s => s.id === subjectId);

    if (subject) {
        if (action === 'create') {
            subject.tests.push({ id: Date.now(), name, questions: [] });
        } else if (action === 'delete') {
            subject.tests = subject.tests.filter(t => t.id !== testId);
        } else if (action === 'update-questions') {
            let test = subject.tests.find(t => t.id === testId);
            if (test) test.questions = questions; // Purane arrays updates persistent rahenge
        }
        writeData(CONTENT_FILE, content);
    }
    res.json({ success: true });
});


// --- [STUDENT CONTROL & REPORT SYSTEM] ---

// 9. Fetch Real-time Dashboard Stats Counters
app.get('/api/admin/stats', (req, res) => {
    const students = readData(STUDENTS_FILE);
    const content = readData(CONTENT_FILE);
    
    let totalTests = 0;
    content.forEach(c => c.subjects.forEach(s => totalTests += s.tests.length));

    res.json({
        totalStudents: students.length,
        pendingApprovals: students.filter(s => s.status === 'pending').length,
        liveApproved: students.filter(s => s.status === 'approved').length,
        totalTests: totalTests
    });
});

// 10. Admin Control Student List
app.get('/api/admin/students', (req, res) => res.json(readData(STUDENTS_FILE)));

// 11. Process Student Approvals / Disapprovals
app.post('/api/admin/student-status', (req, res) => {
    const { id, status } = req.body;
    let students = readData(STUDENTS_FILE);
    
    if (status === 'delete') {
        students = students.filter(s => s.id !== id);
    } else {
        let student = students.find(s => s.id === id);
        if (student) student.status = status;
    }
    writeData(STUDENTS_FILE, students);
    res.json({ success: true });
});


// --- [NOTICE & LEADERBOARD SYNC SYSTEM] ---

// 12. Notice Broadcast Routes
app.get('/api/notice', (req, res) => res.json(readData(NOTICE_FILE)));
app.post('/api/admin/notice', (req, res) => {
    writeData(NOTICE_FILE, req.body);
    res.json({ success: true });
});

// 13. Global Leaderboard System (Records Score Submissions dynamically)
app.get('/api/leaderboard', (req, res) => res.json(readData(LEADERBOARD_FILE)));

app.post('/api/submit-score', (req, res) => {
    const { studentName, mobile, testName, score, totalQs, extractedSubject, extractedTest } = req.body;
    let leaderboard = readData(LEADERBOARD_FILE);

    const newScoreLog = {
        id: Date.now(),
        studentName,
        mobile,
        testName: testName || extractedTest,
        extractedSubject: extractedSubject || "General",
        extractedTest: extractedTest || testName,
        score,
        totalQs: totalQs || score,
        date: new Date().toLocaleDateString('hi-IN')
    };

    leaderboard.push(newScoreLog);
    // Sort leaderboard by top scores before logging to file data sync 
    leaderboard.sort((a, b) => b.score - a.score);
    writeData(LEADERBOARD_FILE, leaderboard);
    
    res.json({ success: true, message: "Score saved successfully!" });
});

// ==========================================
// START CRASH-PROOF & PERSISTENT PORTAL SERVER
// ==========================================
app.listen(PORT, () => {
    console.log(`🚀 Combined Server running non-stop at: http://localhost:${PORT}`);
});
