import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');

const isProd = process.env.NODE_ENV === 'production';
const checkDeploy = process.env.CHECK_DEPLOY === '1';

if (isProd && checkDeploy) {
  const forbiddenPatterns = ['127.0.0.1', 'localhost', 'YOUR-API-HOST'];
  const filesToCheck = ['vercel.json', 'netlify.toml'];
  let hasError = false;

  for (const file of filesToCheck) {
    const fullPath = path.join(webRoot, file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const pattern of forbiddenPatterns) {
        if (content.includes(pattern)) {
          console.error(`DEPLOY CONFIG ERROR: "${file}" contains forbidden placeholder/dev target "${pattern}".`);
          hasError = true;
        }
      }
    }
  }

  if (hasError) {
    console.error('Deployment check failed. Please configure production API target before deployment.');
    process.exit(1);
  }
  console.log('Deploy configuration check passed for production.');
} else {
  console.log('Skipping deploy config enforcement (CHECK_DEPLOY=1 and NODE_ENV=production required).');
}
