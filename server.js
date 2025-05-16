const { OpenAI } = require('openai');
const express = require('express');
const app = express();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => res.send('API is live at LabhSoftware!'));

app.post('/gmb/reply', async (req, res) => {
const { review } = req.body;

if (!review) {
  return res.status(400).json({ error: 'Review text is required' });
}

try {
  const gptResponse = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a kind Indian business owner replying to Google reviews for Labh Software. Be short, professional, and grateful.`
      },
      {
        role: 'user',
        content: `Reply to this review: "${review}"`
      }
    ]
  });

  const reply = gptResponse.choices[0].message.content;
  res.json({ reply });

} catch (error) {
  console.error('OpenAI error:', error);
  res.status(500).json({ error: 'Failed to generate reply' });
}
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
