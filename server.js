// File: server.js (Final v2.2 - Perbaikan Logika Sumber)

const express = require('express');
const cors = require('cors');
const { WordTokenizer, SentimentAnalyzer, PorterStemmer } = require('natural');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// --- DATABASE SUMBER ---
const TRUSTED_SOURCES = ['kompas.com', 'detik.com', 'reuters.com', 'apnews.com', 'bbc.com', 'antaranews.com', 'cnnindonesia.com'];
const UNTRUSTED_SOURCES = ['blogspot.com', 'wordpress.com', 'tribunnews.com', 'suara.com'];

// --- Inisialisasi Penganalisis NLP ---
const tokenizer = new WordTokenizer();
const analyzer = new SentimentAnalyzer('English', PorterStemmer, 'afinn');

// --- FUNGSI-FUNGSI ANALISIS ---

// FUNGSI INI TELAH DIPERBAIKI
function analyzeSourceReputation(url) {
    // --- MATA-MATA DIMULAI ---
    console.log("\n--- MATA-MATA AKTIF ---");
    console.log(`URL diterima: ${url}`);
    
    try {
        const domain = new URL(url).hostname;
        console.log(`Domain yang diekstrak: ${domain}`);

        console.log("Mencocokkan dengan daftar TRUSTED...");
        if (TRUSTED_SOURCES.some(source => {
            if (domain.endsWith(source)) {
                console.log(`✅ DITEMUKAN: ${source}`);
                return true;
            }
            return false;
        })) {
            console.log("--- MATA-MATA SELESAI ---");
            return { impact: 25, reason: `✅ Sumber (${domain}) terpercaya.` };
        }

        console.log("Mencocokkan dengan daftar UNTRUSTED...");
        if (UNTRUSTED_SOURCES.some(source => {
            if (domain.endsWith(source)) {
                console.log(`❌ DITEMUKAN: ${source}`);
                return true;
            }
            return false;
        })) {
            console.log("--- MATA-MATA SELESAI ---");
            return { impact: -35, reason: `❌ Sumber (${domain}) sering bersifat clickbait.` };
        }
        
        console.log("Tidak ditemukan di kedua daftar.");
        console.log("--- MATA-MATA SELESAI ---");
        return { impact: -5, reason: `⚠️ Reputasi sumber tidak terverifikasi.` };
    } catch (error) {
        console.log("--- MATA-MATA SELESAI (DENGAN ERROR) ---");
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

// --- ENDPOINT UTAMA ---
app.post('/analyze', (req, res) => {
  const { title, content, url } = req.body;
  if (!title || !content || !url) {
    return res.status(400).json({ error: 'Title, content, and URL are required.' });
  }

  let score = 50;
  let breakdown = [];

  const analysisFunctions = [
      analyzeSourceReputation(url),
      analyzeContentSentiment(content),
      analyzeClickbaitTitle(title),
      checkDataPresence(content),
      checkContentDepth(content)
  ];
  
  analysisFunctions.forEach(analysis => {
      score += analysis.impact;
      if (analysis.reason) breakdown.push(analysis.reason);
  });
  
  score = Math.max(0, Math.min(score, 100));

  res.json({
    success: true,
    score: Math.round(score),
    breakdown: breakdown
  });
});

app.listen(PORT, () => {
  console.log(`Server SaringBerita (v2.2 - Final) berjalan di http://localhost:${PORT}`);
});