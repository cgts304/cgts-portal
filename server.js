const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-Memory Database
let students = [];
let courses = [];
const ADMIN_CREDENTIALS = { username: 'admin', password: 'cgtsadminpassword' };

// --- STUDENT & ADMIN AUTH ROUTES ---
app.post('/api/register', (req, res) => {
    const { name, mobile, password } = req.body;
    if (!name || !mobile || !password) return res.status(400).json({ message: 'Sabhi jankari bharna anivarya hai' });
    if (students.find(s => s.mobile === mobile)) return res.status(400).json({ message: 'Yeh mobile number pehle se registered hai' });

    students.push({ id: Date.now(), name, mobile, password, status: 'pending' });
    res.json({ message: 'Registration safal! CGTS Admin ke approval ka intezar karein.' });
});

app.post('/api/login', (req, res) => {
    const { mobile, password } = req.body;
    const student = students.find(s => s.mobile === mobile && s.password === password);
    if (!student) return res.status(400).json({ message: 'Galat Mobile number ya Password' });
    if (student.status !== 'approved') return res.status(403).json({ message: 'Aapka account abhi CGTS Admin se approved nahi hua hai.' });
    res.json({ message: 'Login safal raha', student: { id: student.id, name: student.name } });
});

app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
        res.json({ message: 'Admin login safal' });
    } else {
        res.status(401).json({ message: 'Galat Admin Details!' });
    }
});

// --- ADMIN MANAGEMENT ROUTES ---
app.get('/api/admin/students', (req, res) => res.json(students));

app.post('/api/admin/student-status', (req, res) => {
    const { id, status } = req.body;
    if (status === 'delete') {
        students = students.filter(s => s.id !== id);
        return res.json({ message: 'Student delete ho gaya' });
    }
    const student = students.find(s => s.id === id);
    if (student) student.status = status;
    res.json({ message: 'Status update ho gaya' });
});

app.get('/api/content', (req, res) => {
    const visibleContent = courses.filter(c => !c.hidden).map(c => ({
        ...c,
        subjects: c.subjects.filter(s => !s.hidden).map(s => ({
            ...s,
            tests: s.tests.filter(t => !t.hidden)
        }))
    }));
    res.json(visibleContent);
});

app.get('/api/admin/content', (req, res) => res.json(courses));

app.post('/api/admin/course', (req, res) => {
    const { action, courseId, name } = req.body;
    if (action === 'create') courses.push({ id: Date.now(), name, hidden: false, subjects: [] });
    else if (action === 'delete') courses = courses.filter(c => c.id !== courseId);
    else if (action === 'toggle-hide') {
        const course = courses.find(c => c.id === courseId);
        if (course) course.hidden = !course.hidden;
    }
    res.json({ message: 'Success' });
});

app.post('/api/admin/subject', (req, res) => {
    const { action, courseId, subjectId, name } = req.body;
    const course = courses.find(c => c.id === courseId);
    if (!course) return res.status(404).json({ message: 'Course nahi mila' });
    if (action === 'create') course.subjects.push({ id: Date.now(), name, hidden: false, tests: [] });
    else if (action === 'delete') course.subjects = course.subjects.filter(s => s.id !== subjectId);
    else if (action === 'toggle-hide') {
        const subject = course.subjects.find(s => s.id === subjectId);
        if (subject) subject.hidden = !subject.hidden;
    }
    res.json({ message: 'Success' });
});

app.post('/api/admin/test', (req, res) => {
    const { action, courseId, subjectId, testId, name, questions } = req.body;
    const course = courses.find(c => c.id === courseId);
    const subject = course?.subjects.find(s => s.id === subjectId);
    if (!subject) return res.status(404).json({ message: 'Subject nahi mila' });

    if (action === 'create') subject.tests.push({ id: Date.now(), name, hidden: false, questions: [] });
    else if (action === 'delete') subject.tests = subject.tests.filter(t => t.id !== testId);
    else if (action === 'toggle-hide') {
        const test = subject.tests.find(t => t.id === testId);
        if (test) test.hidden = !test.hidden;
    } else if (action === 'update-questions') {
        const test = subject.tests.find(t => t.id === testId);
        if (test) test.questions = questions;
    }
    res.json({ message: 'Success' });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`CGTS Server active on port ${PORT}`));

