const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => res.send('API is live at LabhSoftware!'));

app.post('/gmb/reply', async (req, res) => {
  const { review } = req.body;

  if (!review) {
    return res.status(400).json({ error: 'Review text is required' });
  }

  // Placeholder AI logic
  const reply = `Thank you for your review! We appreciate your feedback: "${review}"`;

  return res.json({ reply });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
