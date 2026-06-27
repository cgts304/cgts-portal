const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 🔴 APNA ASLI MONGODB URL NICHE INVERTED COMMAS ("") KE ANDAR PASTE KAREIN
const MY_DATABASE_URL = "mongodb+srv://praside:praside1@cluster0.94fqc7m.mongodb.net/?appName=Cluster0";

const MONGO_URI = process.env.MONGO_URI || MY_DATABASE_URL;

mongoose.connect(MONGO_URI)
    .then(() => console.log("🔌 Connected to MongoDB Cloud successfully!"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

// ---------------- DATABASE SCHEMAS & MODELS ----------------

const StudentSchema = new mongoose.Schema({
    name: String, mobile: { type: String, unique: true }, password: String, status: { type: String, default: 'pending' }
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

let currentNotice = { notice: "" };

// Initialize Admin Credentials if not exists
async function initAdmin() {
    const count = await AdminCreds.countDocuments();
    if (count === 0) await AdminCreds.create({ username: 'admin', password: 'cgtsadminpassword' });
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
        
        await Student.create({ name, mobile, password, status: 'pending' });
        res.json({ success: true, message: "🎉 Registration safal! Admin approval ka intezar karein." });
    } catch(e) { res.status(500).json({ success: false, message: "Server error" }); }
});

app.post('/api/login', async (req, res) => {
    const { mobile, password } = req.body;
    const student = await Student.findOne({ mobile, password });
    if (!student) return res.status(401).json({ message: "Galat Mobile ya Password!" });
    if (student.status !== 'approved') return res.status(403).json({ message: "⚠️ Aapka account abhi pending hai." });
    res.json({ success: true, student });
});

app.get('/api/content', async (req, res) => res.json(await Content.find({})));

app.post('/api/submit-test', async (req, res) => {
    const { studentName, mobile, testName, score, totalQs, courseId, subjectId } = req.body;
    let extSub = "General";
    const course = await Content.findOne({ id: courseId });
    if (course) {
        const sub = course.subjects.find(s => s.id == subjectId);
        if (sub) extSub = sub.name;
    }
    await Leaderboard.create({
        studentName, mobile, testName, score, totalQs, extractedSubject: extSub, extractedTest: testName,
        date: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    });
    res.json({ success: true, message: "Result saved!" });
});

app.get('/api/leaderboard', async (req, res) => res.json(await Leaderboard.find({}).sort({ _id: -1 })));

// ---------------- ADMIN PANEL APIs ----------------

app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    const admin = await AdminCreds.findOne({ username, password });
    if (admin) res.json({ token: 'mock-admin-token-xyz' });
    else res.status(401).json({ message: "Invalid Admin Credentials" });
});

app.post('/api/admin/change-credentials', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).send("Bad request");
    await AdminCreds.deleteMany({});
    await AdminCreds.create({ username, password });
    res.send("Updated");
});

app.get('/api/admin/stats', async (req, res) => {
    const totalStudents = await Student.countDocuments();
    const pendingApprovals = await Student.countDocuments({ status: 'pending' });
    const liveApproved = await Student.countDocuments({ status: 'approved' });
    
    let totalTests = 0;
    const allContent = await Content.find({});
    allContent.forEach(c => c.subjects.forEach(s => totalTests += s.tests.length));
    res.json({ totalStudents, pendingApprovals, liveApproved, totalTests });
});

app.post('/api/admin/notice', (req, res) => { currentNotice.notice = req.body.notice; res.send("Notice updated"); });
app.get('/api/admin/students', async (req, res) => res.json(await Student.find({})));

app.post('/api/admin/student-status', async (req, res) => {
    const { id, status } = req.body;
    if (status === 'delete') await Student.deleteOne({ id });
    else await Student.updateOne({ id }, { status });
    res.send("Status Updated");
});

app.get('/api/admin/content', async (req, res) => res.json(await Content.find({})));

app.post('/api/admin/course', async (req, res) => {
    const { action, courseId, name } = req.body;
    if (action === 'create') await Content.create({ id: Date.now(), name, subjects: [] });
    else if (action === 'delete') await Content.deleteOne({ id: courseId });
    res.send("Done");
});

app.post('/api/admin/subject', async (req, res) => {
    const { action, courseId, subjectId, name } = req.body;
    const course = await Content.findOne({ id: courseId });
    if (course) {
        if (action === 'create') course.subjects.push({ id: Date.now(), name, tests: [] });
        else if (action === 'delete') course.subjects = course.subjects.filter(s => s.id !== subjectId);
        await Content.updateOne({ id: courseId }, { subjects: course.subjects });
    }
    res.send("Done");
});

app.post('/api/admin/test', async (req, res) => {
    const { action, courseId, subjectId, testId, name, questions } = req.body;
    const course = await Content.findOne({ id: courseId });
    if (!course) return res.status(404).send("Course not found");
    const subject = course.subjects.find(s => s.id === subjectId);
    if (!subject) return res.status(404).send("Subject not found");

    if (action === 'create') subject.tests.push({ id: Date.now(), name, questions: [] });
    else if (action === 'delete') subject.tests = subject.tests.filter(t => t.id !== testId);
    else if (action === 'update-questions') {
        const test = subject.tests.find(t => t.id === testId);
        if (test) test.questions = questions;
    }
    await Content.updateOne({ id: courseId }, { subjects: course.subjects });
    res.send("Done");
});

app.listen(PORT, () => console.log(`🚀 Cloud MongoDB Server running on port ${PORT}`));
