const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 🔌 AAPKA REAL MONGODB ATLAS URL (HARDCODED)
const MONGO_URI = "mongodb+srv://praside:praside1@cluster0.94fqc7m.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(MONGO_URI)
    .then(() => console.log("🔌 Connected to MongoDB Cloud successfully!"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

// ---------------- DATABASE SCHEMAS & MODELS ----------------

const StudentSchema = new mongoose.Schema({
    id: Number, 
    name: String, 
    mobile: { type: String, unique: true }, 
    password: String, 
    status: { type: String, default: 'pending' }
});
const Student = mongoose.model('Student', StudentSchema);

const ContentSchema = new mongoose.Schema({ id: Number, name: String, subjects: Array });
const Content = mongoose.model('Content', ContentSchema);

const LeaderboardSchema = new mongoose.Schema({
    studentName: String, mobile: String, testName: String, score: Number, totalQs: Number,
    extractedSubject: String, extractedTest: String, date: String
});
const Leaderboard = mongoose.model('Leaderboard', LeaderboardSchema);

const AdminSchema = new mongoose.Schema({ username: { type: String, default: 'admin' }, password: { type: String, default: 'cgtsadminpassword' } });
const AdminCreds = mongoose.model('AdminCreds', AdminSchema);

let currentNotice = { notice: "Welcome to CGTS Portal" };

// Initialize Admin Credentials if not exists
async function initAdmin() {
    try {
        const count = await AdminCreds.countDocuments();
        if (count === 0) await AdminCreds.create({ username: 'admin', password: 'cgtsadminpassword' });
    } catch(e) { console.log(e); }
}
initAdmin();

// ---------------- GLOBAL/STUDENT APIs ----------------

app.get('/api/notice', (req, res) => res.json(currentNotice));

app.post('/api/register', async (req, res) => {
    const { name, mobile, password } = req.body;
    if (!name || !mobile || !password) return res.status(400).json({ success: false, message: "Details incomplete!" });
    try {
        const existing = await Student.findOne({ mobile });
        if (existing) return res.json({ success: false, message: "⚠️ Mobile number pehle se registered hai!" });
        
        await Student.create({ id: Date.now(), name, mobile, password, status: 'pending' });
        res.json({ success: true, message: "🎉 Registration safal! Admin approval ka intezar karein." });
    } catch(e) { res.status(500).json({ success: false, message: "Server error" }); }
});

app.post('/api/login', async (req, res) => {
    const { mobile, password } = req.body;
    try {
        const student = await Student.findOne({ mobile, password });
        if (!student) return res.status(401).json({ message: "Galat Mobile ya Password!" });
        if (student.status !== 'approved') return res.status(403).json({ message: "⚠️ Aapka account abhi pending hai." });
        res.json({ success: true, student });
    } catch(e) { res.status(500).json({ message: "Server error" }); }
});

app.get('/api/content', async (req, res) => {
    try {
        const data = await Content.find({});
        res.json(data);
    } catch(e) { res.status(500).json([]); }
});

app.post('/api/submit-test', async (req, res) => {
    const { studentName, mobile, testName, score, totalQs, courseId, subjectId } = req.body;
    try {
        let extSub = "General";
        const course = await Content.findOne({ id: Number(courseId) });
        if (course) {
            const sub = course.subjects.find(s => s.id == subjectId);
            if (sub) extSub = sub.name;
        }
        await Leaderboard.create({
            studentName, mobile, testName, score, totalQs, extractedSubject: extSub, extractedTest: testName,
            date: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
        });
        res.json({ success: true, message: "Result saved!" });
    } catch(e) { res.status(500).json({ success: false }); }
});

app.get('/api/leaderboard', async (req, res) => {
    try {
        const data = await Leaderboard.find({}).sort({ _id: -1 });
        res.json(data);
    } catch(e) { res.status(500).json([]); }
});

// ---------------- ADMIN PANEL APIs ----------------

app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const admin = await AdminCreds.findOne({ username, password });
        if (admin) res.json({ token: 'mock-admin-token-xyz' });
        else res.status(401).json({ message: "Invalid Admin Credentials" });
    } catch(e) { res.status(500).send("Error"); }
});

app.post('/api/admin/change-credentials', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).send("Bad request");
    try {
        await AdminCreds.deleteMany({});
        await AdminCreds.create({ username, password });
        res.send("Updated");
    } catch(e) { res.status(500).send("Error"); }
});

app.get('/api/admin/stats', async (req, res) => {
    try {
        const totalStudents = await Student.countDocuments();
        const pendingApprovals = await Student.countDocuments({ status: 'pending' });
        const liveApproved = await Student.countDocuments({ status: 'approved' });
        
        let totalTests = 0;
        const allContent = await Content.find({});
        allContent.forEach(c => c.subjects.forEach(s => totalTests += s.tests.length));
        res.json({ totalStudents, pendingApprovals, liveApproved, totalTests });
    } catch(e) { res.status(500).json({ totalStudents:0, pendingApprovals:0, liveApproved:0, totalTests:0 }); }
});

app.post('/api/admin/notice', (req, res) => { 
    currentNotice.notice = req.body.notice; 
    res.send("Notice updated"); 
});

app.get('/api/admin/students', async (req, res) => {
    try { res.json(await Student.find({})); } catch(e) { res.json([]); }
});

app.post('/api/admin/student-status', async (req, res) => {
    const { id, status } = req.body;
    try {
        if (status === 'delete') {
            await Student.deleteOne({ id: Number(id) });
        } else {
            await Student.updateOne({ id: Number(id) }, { status });
        }
        res.send("Status Updated");
    } catch(e) { res.status(500).send("Error"); }
});

app.get('/api/admin/content', async (req, res) => {
    try { res.json(await Content.find({})); } catch(e) { res.json([]); }
});

app.post('/api/admin/course', async (req, res) => {
    const { action, courseId, name } = req.body;
    try {
        if (action === 'create') await Content.create({ id: Date.now(), name, subjects: [] });
        else if (action === 'delete') await Content.deleteOne({ id: Number(courseId) });
        res.send("Done");
    } catch(e) { res.status(500).send("Error"); }
});

app.post('/api/admin/subject', async (req, res) => {
    const { action, courseId, subjectId, name } = req.body;
    try {
        const course = await Content.findOne({ id: Number(courseId) });
        if (course) {
            if (action === 'create') course.subjects.push({ id: Date.now(), name, tests: [] });
            else if (action === 'delete') course.subjects = course.subjects.filter(s => s.id !== Number(subjectId));
            await Content.updateOne({ id: Number(courseId) }, { subjects: course.subjects });
        }
        res.send("Done");
    } catch(e) { res.status(500).send("Error"); }
});

app.post('/api/admin/test', async (req, res) => {
    const { action, courseId, subjectId, testId, name, questions } = req.body;
    try {
        const course = await Content.findOne({ id: Number(courseId) });
        if (!course) return res.status(404).send("Course not found");
        const subject = course.subjects.find(s => s.id === Number(subjectId));
        if (!subject) return res.status(404).send("Subject not found");

        if (action === 'create') subject.tests.push({ id: Date.now(), name, questions: [] });
        else if (action === 'delete') subject.tests = subject.tests.filter(t => t.id !== Number(testId));
        else if (action === 'update-questions') {
            const test = subject.tests.find(t => t.id === Number(testId));
            if (test) test.questions = questions;
        }
        await Content.updateOne({ id: Number(courseId) }, { subjects: course.subjects });
        res.send("Done");
    } catch(e) { res.status(500).send("Error"); }
});

app.listen(PORT, () => console.log(`🚀 Cloud MongoDB Server running on port ${PORT}`));
