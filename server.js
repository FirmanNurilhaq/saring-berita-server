// File: server.js (Final)

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

function checkHoaxKeywords(text) {
  const keywords = ['viralkan', 'sebarkan', 'waspadalah', 'terbukti', 'jangan kaget', 'astagfirullah'];
  let scoreImpact = 0;
  for (const keyword of keywords) {
    if (text.toLowerCase().includes(keyword)) {
      scoreImpact -= 40;
      break;
    }
  }
  return scoreImpact;
}

function checkProvocativeTitle(title) {
  const upperCaseLetters = (title.match(/[A-Z]/g) || []).length;
  const totalLetters = (title.match(/[a-zA-Z]/g) || []).length;
  if (totalLetters > 10 && (upperCaseLetters / totalLetters) > 0.5) return -30;
  if ((title.match(/!/g) || []).length >= 3) return -30;
  return 0;
}

function checkTrustedSources(text) {
  const sources = ['kompas.com', 'reuters', 'associated press', 'bbc', 'detik.com', 'antara news', 'the new york times'];
  for (const source of sources) {
    if (text.toLowerCase().includes(source)) return 20;
  }
  return 0;
}

app.post('/analyze', (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required.' });
  }
  
  let score = 100;
  let reasons = [];

  const hoaxImpact = checkHoaxKeywords(content);
  if (hoaxImpact < 0) {
      score += hoaxImpact;
      reasons.push(`Terdeteksi kata kunci hoaks.`);
  }

  const titleImpact = checkProvocativeTitle(title);
  if (titleImpact < 0) {
      score += titleImpact;
      reasons.push(`Judul terindikasi provokatif/clickbait.`);
  }

  const sourceImpact = checkTrustedSources(content);
  if (sourceImpact > 0) {
      score += sourceImpact;
      reasons.push(`Menyebutkan sumber berita terpercaya.`);
  }

  score = Math.max(0, Math.min(score, 100));

  let message = 'Analisis berdasarkan kriteria umum selesai.';
  if (reasons.length > 0) {
      message = reasons.join(' ');
  }

  const analysisResult = {
    success: true,
    score: score,
    message: message
  };
  res.json(analysisResult);
});

app.listen(PORT, () => {
  console.log(`Server SaringBerita berjalan di http://localhost:${PORT}`);
});