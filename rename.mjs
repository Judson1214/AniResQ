import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function walk(dir) {
    let results = [];
    const list = await fs.readdir(dir);
    for (let file of list) {
        file = path.resolve(dir, file);
        const stat = await fs.stat(file);
        if (stat && stat.isDirectory()) {
            if (!file.includes('node_modules') && !file.includes('dist') && !file.includes('.git') && !file.includes('venv')) {
                results = results.concat(await walk(file));
            }
        } else {
            results.push(file);
        }
    }
    return results;
}

async function run() {
    const files = await walk(__dirname);
    let updatedCount = 0;
    
    for (const file of files) {
        const ext = path.extname(file);
        // Target specific text-based extensions to avoid corrupting binaries
        if (['.js', '.jsx', '.json', '.html', '.md', '.py', '.yaml', '.yml', '.env', '.example'].includes(ext) || path.basename(file) === 'firebaserc') {
            try {
                let content = await fs.readFile(file, 'utf8');
                
                // Replace PascalCase/TitleCase
                let newContent = content.replace(/ResQNet/g, 'AniResQ');
                // Replace lowercase (for package names, imports, URLs)
                newContent = newContent.replace(/resqnet/g, 'aniresq');
                
                if (content !== newContent) {
                    await fs.writeFile(file, newContent, 'utf8');
                    console.log(`Updated: ${path.relative(__dirname, file)}`);
                    updatedCount++;
                }
            } catch (err) {
                console.error(`Skipping ${file}: ${err.message}`);
            }
        }
    }
    console.log(`\nSuccessfully renamed project in ${updatedCount} files.`);
}

run();
