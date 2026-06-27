const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Files paths jahan data permanent save hoga
const CONTENT_FILE = path.join(__dirname, 'content.json');
const STUDENTS_FILE = path.join(__dirname, 'students.json');
const LEADERBOARD_FILE = path.join(__dirname, 'leaderboard.json');
const ADMIN_FILE = path.join(__dirname, 'admin_credentials.json');

// Helper function: Data load karne ke liye
function loadData(filePath, defaultData) {
    try {
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (e) {
        console.error("Error reading file:", filePath, e);
    }
    return defaultData;
}

// Helper function: Data save karne ke liye
function saveData(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error("Error writing file:", filePath, e);
    }
}

// Initializing Data Variables from JSON Files
let contentData = loadData(CONTENT_FILE, []);
let students = loadData(STUDENTS_FILE, []);
let leaderboard = loadData(LEADERBOARD_FILE, []);
let adminCreds = loadData(ADMIN_FILE, { username: 'admin', password: 'cgtsadminpassword' });
let currentNotice = { notice: "" };

// ---------------- GLOBAL/STUDENT APIs ----------------

// Get Notice
app.get('/api/notice', (req, res) => res.json(currentNotice));

// Student Register
app.post('/api/register', (req, res) => {
    const { name, mobile, password } = req.body;
    if (!name || !mobile || !password) return res.status(400).json({ success: false, message: "Details incomplete!" });
    
    if (students.find(s => s.mobile === mobile)) {
        return res.json({ success: false, message: "⚠️ Mobile number pehle se registered hai!" });
    }
    
    const newStudent = { id: Date.now(), name, mobile, password, status: 'pending' };
    students.push(newStudent);
    saveData(STUDENTS_FILE, students); // Permanent Save
    
    res.json({ success: true, message: "🎉 Registration safal! Admin approval ka intezar karein." });
});

// Student Login
app.post('/api/login', (req, res) => {
    const { mobile, password } = req.body;
    const student = students.find(s => s.mobile === mobile && s.password === password);
    if (!student) return res.status(401).json({ message: "Galat Mobile ya Password!" });
    if (student.status !== 'approved') return res.status(403).json({ message: "⚠️ Aapka account abhi pending hai, Admin se sampark karein." });
    res.json({ success: true, student });
});

// Get Student Dashboard Content
app.get('/api/content', (req, res) => res.json(contentData));

// Submit Test Result
app.post('/api/submit-test', (req, res) => {
    const { studentName, mobile, testName, score, totalQs, courseId, subjectId, testId } = req.body;
    
    // Find subject name for leaderboard extracted structure
    let extSub = "General", extTest = testName;
    const course = contentData.find(c => c.id == courseId);
    if (course) {
        const sub = course.subjects.find(s => s.id == subjectId);
        if (sub) extSub = sub.name;
    }

    const entry = {
        studentName, mobile, testName, score, totalQs,
        extractedSubject: extSub, extractedTest: extTest,
        date: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    };
    
    leaderboard.push(entry);
    saveData(LEADERBOARD_FILE, leaderboard); // Permanent Save
    res.json({ success: true, message: "Result saved!" });
});

// Get Leaderboard Data
app.get('/api/leaderboard', (req, res) => res.json(leaderboard));


// ---------------- ADMIN PANEL APIs ----------------

// Admin Login
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === adminCreds.username && password === adminCreds.password) {
        res.json({ token: 'mock-admin-token-xyz' });
    } else {
        res.status(401).json({ message: "Invalid Admin Credentials" });
    }
});

// Change Admin ID/Password
app.post('/api/admin/change-credentials', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).send("Bad request");
    
    adminCreds = { username, password };
    saveData(ADMIN_FILE, adminCreds); // Permanent Save
    res.send("Updated");
});

// Get Admin Stats
app.get('/api/admin/stats', (req, res) => {
    const totalStudents = students.length;
    const pendingApprovals = students.filter(s => s.status === 'pending').length;
    const liveApproved = students.filter(s => s.status === 'approved').length;
    
    let totalTests = 0;
    contentData.forEach(c => c.subjects.forEach(s => totalTests += s.tests.length));

    res.json({ totalStudents, pendingApprovals, liveApproved, totalTests });
});

// Live Notice Broadcast
app.post('/api/admin/notice', (req, res) => {
    currentNotice.notice = req.body.notice;
    res.send("Notice updated");
});

// Get Admin Students List
app.get('/api/admin/students', (req, res) => res.json(students));

// Update Student Status (Approve/Delete)
app.post('/api/admin/student-status', (req, res) => {
    const { id, status } = req.body;
    if (status === 'delete') {
        students = students.filter(s => s.id !== id);
    } else {
        const student = students.find(s => s.id === id);
        if (student) student.status = status;
    }
    saveData(STUDENTS_FILE, students); // Permanent Save
    res.send("Status Updated");
});

// Get Content Tree for Admin
app.get('/api/admin/content', (req, res) => res.json(contentData));

// Manage Course (Add/Delete)
app.post('/api/admin/course', (req, res) => {
    const { action, courseId, name } = req.body;
    if (action === 'create') {
        contentData.push({ id: Date.now(), name, subjects: [] });
    } else if (action === 'delete') {
        contentData = contentData.filter(c => c.id !== courseId);
    }
    saveData(CONTENT_FILE, contentData); // Permanent Save
    res.send("Done");
});

// Manage Subject (Add/Delete)
app.post('/api/admin/subject', (req, res) => {
    const { action, courseId, subjectId, name } = req.body;
    const course = contentData.find(c => c.id === courseId);
    if (course) {
        if (action === 'create') {
            course.subjects.push({ id: Date.now(), name, tests: [] });
        } else if (action === 'delete') {
            course.subjects = course.subjects.filter(s => s.id !== subjectId);
        }
        saveData(CONTENT_FILE, contentData); // Permanent Save
    }
    res.send("Done");
});

// Manage Test (Add/Delete/Update Questions)
app.post('/api/admin/test', (req, res) => {
    const { action, courseId, subjectId, testId, name, questions } = req.body;
    const course = contentData.find(c => c.id === courseId);
    if (!course) return res.status(404).send("Course not found");
    
    const subject = course.subjects.find(s => s.id === subjectId);
    if (!subject) return res.status(404).send("Subject not found");

    if (action === 'create') {
        subject.tests.push({ id: Date.now(), name, questions: [] });
    } else if (action === 'delete') {
        subject.tests = subject.tests.filter(t => t.id !== testId);
    } else if (action === 'update-questions') {
        const test = subject.tests.find(t => t.id === testId);
        if (test) test.questions = questions;
    }
    saveData(CONTENT_FILE, contentData); // Permanent Save
    res.send("Done");
});

// Server Start Point
app.listen(PORT, () => console.log(`🚀 Persistent Server running on port ${PORT}`));
