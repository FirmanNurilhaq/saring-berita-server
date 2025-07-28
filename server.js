// File: server.js (v4.0 - Dengan Pembelajaran Otomatis)

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { WordTokenizer, SentimentAnalyzer, PorterStemmer } = require('natural');

const app = express();
const PORT = 3000;

// --- KONEKSI KE DATABASE ---
const MONGO_URI = "mongodb+srv://saringberita-user:kenapapasswordsih@saringberitacluster.wxfltcq.mongodb.net/saringberita_db?retryWrites=true&w=majority&appName=SaringberitaCluster";

mongoose.connect(MONGO_URI)
    .then(() => console.log('Berhasil terhubung ke database saringberita_db di MongoDB Atlas!'))
    .catch(err => console.error('Gagal terhubung ke MongoDB:', err));

// --- SKEMA DIPERBARUI ---
const SourceSchema = new mongoose.Schema({
    domain: { type: String, required: true, unique: true },
    trustScore: { type: Number, required: true, min: 0, max: 100 },
    category: { type: String, default: 'Umum' },
    upvotes: { type: Number, default: 0 },
    downvotes: { type: Number, default: 0 }
});
const Source = mongoose.model('Source', SourceSchema);

// Skema Feedback tidak berubah, tapi tidak akan kita gunakan lagi secara langsung
const FeedbackSchema = new mongoose.Schema({
    url: { type: String, required: true },
    vote: { type: String, required: true, enum: ['up', 'down'] },
    createdAt: { type: Date, default: Date.now }
});
const Feedback = mongoose.model('Feedback', FeedbackSchema);

// Middleware
app.use(cors());
app.use(express.json());

// --- Inisialisasi Penganalisis NLP ---
const tokenizer = new WordTokenizer();
const analyzer = new SentimentAnalyzer('English', PorterStemmer, 'afinn');

// --- FUNGSI-FUNGSI ANALISIS (Tidak ada perubahan) ---
async function analyzeSourceReputation(url) {
    try {
        const hostname = new URL(url).hostname;
        const domainParts = hostname.split('.');
        const domain = domainParts.slice(-2).join('.');
        const sourceData = await Source.findOne({ domain: domain });
        if (sourceData) {
            const impact = sourceData.trustScore - 50;
            const reason = `✅ Reputasi sumber (${domain}) terverifikasi dengan skor ${sourceData.trustScore}.`;
            return { impact, reason };
        } else {
            return { impact: -5, reason: `⚠️ Reputasi sumber tidak terverifikasi.` };
        }
    } catch (error) {
        return { impact: -10, reason: '❌ URL sumber berita tidak valid.' };
    }
}
function analyzeContentSentiment(content) {
    const tokens = tokenizer.tokenize(content.toLowerCase());
    const sentimentScore = analyzer.getSentiment(tokens);
    if (sentimentScore < -0.1) return { impact: -25, reason: '❌ Gaya bahasa sangat negatif/provokatif.' };
    if (sentimentScore > 0.1) return { impact: -15, reason: '⚠️ Gaya bahasa sangat bombastis.' };
    return { impact: 15, reason: '✅ Gaya bahasa cenderung netral.' };
}
function analyzeClickbaitTitle(title) {
    const upperCaseLetters = (title.match(/[A-Z]/g) || []).length;
    const totalLetters = (title.match(/[a-zA-Z]/g) || []).length;
    if (totalLetters > 10 && (upperCaseLetters / totalLetters) > 0.5) return { impact: -20, reason: '❌ Judul menggunakan huruf kapital berlebihan.' };
    if ((title.match(/[!?]/g) || []).length >= 3) return { impact: -20, reason: '❌ Judul menggunakan tanda baca berlebihan.' };
    return { impact: 0, reason: '' };
}
function checkDataPresence(content) {
    const hasNumbers = /(\d{3,})|(\d+\s?%)|(\d{1,2}\s(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember))/i.test(content);
    if (hasNumbers) return { impact: 15, reason: '✅ Artikel menyertakan data (angka/tanggal).' };
    return { impact: 0, reason: '' };
}
function checkContentDepth(content) {
    const wordCount = content.split(/\s+/).length;
    if (wordCount < 150) return { impact: -20, reason: '⚠️ Konten artikel terlalu pendek.' };
    return { impact: 10, reason: '✅ Kedalaman konten cukup baik.' };
}

// --- ENDPOINT UTAMA (Tidak ada perubahan) ---
app.post('/analyze', async (req, res) => {
    const { title, content, url } = req.body;
    if (!title || !content || !url) return res.status(400).json({ error: 'Title, content, and URL are required.' });
    let score = 50;
    let breakdown = [];
    const sourceAnalysis = await analyzeSourceReputation(url);
    score += sourceAnalysis.impact;
    breakdown.push(sourceAnalysis.reason);
    const otherAnalyses = [
        analyzeContentSentiment(content),
        analyzeClickbaitTitle(title),
        checkDataPresence(content),
        checkContentDepth(content)
    ];
    otherAnalyses.forEach(analysis => {
        score += analysis.impact;
        if (analysis.reason) breakdown.push(analysis.reason);
    });
    score = Math.max(0, Math.min(score, 100));
    res.json({ success: true, score: Math.round(score), breakdown: breakdown });
});

// --- ENDPOINT FEEDBACK SEKARANG JAUH LEBIH PINTAR ---
app.post('/feedback', async (req, res) => {
    try {
        const { url, vote } = req.body;
        if (!url || !vote) return res.status(400).send({ message: 'URL and vote are required.' });

        const hostname = new URL(url).hostname;
        const domain = hostname.split('.').slice(-2).join('.');

        // 1. Cari sumber di database
        let source = await Source.findOne({ domain: domain });

        // Jika sumber belum ada, buat baru
        if (!source) {
            source = new Source({ domain: domain, trustScore: 50, upvotes: 0, downvotes: 0, category: 'Baru (dari Feedback)' });
        }

        const scoreSebelum = source.trustScore;
        const voteSebelum = `${source.upvotes}/${source.upvotes + source.downvotes}`;

        // 2. Tambah vote
        if (vote === 'up') {
            source.upvotes += 1;
        } else {
            source.downvotes += 1;
        }

        // 3. Hitung ulang trustScore berdasarkan rasio vote
        const totalVotes = source.upvotes + source.downvotes;
        if (totalVotes > 0) {
            source.trustScore = Math.round((source.upvotes / totalVotes) * 100);
        }

        // 4. Simpan perubahan ke database
        await source.save();

        const scoreSesudah = source.trustScore;
        const voteSesudah = `${source.upvotes}/${source.upvotes + source.downvotes}`;

        // 5. Cetak log perubahan di terminal server
        console.log(`\n--- FEEDBACK DIPROSES UNTUK: ${domain} ---`);
        console.log(`Vote: ${vote.toUpperCase()}`);
        console.log(`Rasio vote: ${voteSebelum} -> ${voteSesudah}`);
        console.log(`TrustScore: ${scoreSebelum} -> ${scoreSesudah}`);
        console.log(`------------------------------------------`);

        res.status(200).send({ message: 'Feedback processed and score updated.' });

    } catch (error) {
        console.error("Error processing feedback:", error);
        res.status(500).send({ message: 'Failed to process feedback.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server SaringBerita (v4.0 - Auto-Learn) berjalan di http://localhost:${PORT}`);
});