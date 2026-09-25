import { createApp } from './app.js';

const PORT = process.env['PORT'] ? parseInt(process.env['PORT'], 10) : 3000;
const app = createApp();

app.listen(PORT, () => {
  console.log(`TestForge running on http://localhost:${PORT}`);
});
