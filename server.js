const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_FILE = path.join(__dirname, 'data.json');

// Default initial database structure
function initDatabase() {
    if (!fs.existsSync(DATA_FILE)) {
        const initialData = {
            students: [],
            content: []
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

// ---------------- SERVER ROUTING & APIS ----------------

// 1. Student Registration
app.post('/api/register', (req, res) => {
    const { name, mobile, password } = req.body;
    const data = readData();
    
    const exists = data.students.find(s => s.mobile === mobile);
    if (exists) {
        return res.json({ success: false, message: 'Yeh mobile number pehle se registered hai!' });
    }

    const newStudent = {
        id: Date.now(),
        name,
        mobile,
        password,
        status: 'pending'
    };
    data.students.push(newStudent);
    writeData(data);
    res.json({ success: true, message: 'Registration safal raha! Admin approval ka intezar karein.' });
});

// 2. Student Login
app.post('/api/login', (req, res) => {
    const { mobile, password } = req.body;
    const data = readData();
    
    const student = data.students.find(s => s.mobile === mobile && s.password === password);
    if (!student) {
        return res.json({ success: false, message: 'Galat Mobile Number ya Password!' });
    }
    if (student.status !== 'approved') {
        return res.json({ success: false, message: 'Aapka account abhi tak approved nahi hua hai. Admin se sampark karein.' });
    }
    
    res.json({ success: true, student: { id: student.id, name: student.name, mobile: student.mobile } });
});

// 3. SECURE ADMIN LOGIN (No browser packet suggestion leak)
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'praside1') {
        return res.json({ success: true, token: 'cgts_admin_authenticated_secure_2026' });
    }
    res.status(401).json({ success: false, message: 'Galat Admin ID ya Password!' });
});

// 4. Get Student List for Admin (Visible Passwords as requested)
app.get('/api/admin/students', (req, res) => {
    const data = readData();
    res.json(data.students);
});

// 5. Update Student Status (Approve/Delete)
app.post('/api/admin/student-status', (req, res) => {
    const { id, status } = req.body;
    let data = readData();
    
    if (status === 'delete') {
        data.students = data.students.filter(s => s.id !== id);
    } else {
        const student = data.students.find(s => s.id === id);
        if (student) student.status = status;
    }
    
    writeData(data);
    res.json({ success: true });
});

// 6. Get Test Content for Students & Admin Tree
app.get('/api/content', (req, res) => {
    const data = readData();
    res.json(data.content);
});
app.get('/api/admin/content', (req, res) => {
    const data = readData();
    res.json(data.content);
});

// 7. Course Manage (Create/Delete)
app.post('/api/admin/course', (req, res) => {
    const { action, courseId, name } = req.body;
    let data = readData();

    if (action === 'create') {
        data.content.push({ id: Date.now(), name, subjects: [] });
    } else if (action === 'delete') {
        data.content = data.content.filter(c => c.id !== courseId);
    }
    writeData(data);
    res.json({ success: true });
});

// 8. Subject Manage (Create/Delete)
app.post('/api/admin/subject', (req, res) => {
    const { action, courseId, subjectId, name } = req.body;
    let data = readData();
    const course = data.content.find(c => c.id === courseId);

    if (course) {
        if (action === 'create') {
            course.subjects.push({ id: Date.now(), name, tests: [] });
        } else if (action === 'delete') {
            course.subjects = course.subjects.filter(s => s.id !== subjectId);
        }
    }
    writeData(data);
    res.json({ success: true });
});

// 9. Test & Bulk Custom Questions Array Management
app.post('/api/admin/test', (req, res) => {
    const { action, courseId, subjectId, testId, name, questions } = req.body;
    let data = readData();
    const course = data.content.find(c => c.id === courseId);
    if (!course) return res.json({ success: false });
    const subject = course.subjects.find(s => s.id === subjectId);
    if (!subject) return res.json({ success: false });

    if (action === 'create') {
        subject.tests.push({ id: Date.now(), name, questions: [] });
    } else if (action === 'delete') {
        subject.tests = subject.tests.filter(t => t.id !== testId);
    } else if (action === 'update-questions') {
        const test = subject.tests.find(t => t.id === testId);
        if (test) test.questions = questions;
    }

    writeData(data);
    res.json({ success: true });
});

app.listen(PORT, () => console.log(`Server running smoothly on port ${PORT}`));
