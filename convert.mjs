import fs from 'fs/promises';
import path from 'path';
import { transform } from 'esbuild';
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
            if (!file.includes('node_modules') && !file.includes('dist') && !file.includes('.git')) {
                results = results.concat(await walk(file));
            }
        } else {
            if (file.endsWith('.ts') || file.endsWith('.tsx')) {
                if (!file.endsWith('.d.ts')) results.push(file);
            }
        }
    }
    return results;
}

async function run() {
    const files = await walk(path.join(__dirname, 'apps'));
    const packageFiles = await walk(path.join(__dirname, 'packages'));
    const allFiles = [...files, ...packageFiles];

    for (const file of allFiles) {
        const isTsx = file.endsWith('.tsx');
        const content = await fs.readFile(file, 'utf8');
        try {
            const out = await transform(content, {
                loader: isTsx ? 'tsx' : 'ts',
                format: 'esm',
                target: 'esnext',
                jsx: 'preserve',
                // Keep the original imports, let Vite/bundler resolve them
            });
            const newFile = file.replace(/\.tsx?$/, isTsx ? '.jsx' : '.js');
            await fs.writeFile(newFile, out.code);
            await fs.unlink(file);
            console.log(`Converted ${path.relative(__dirname, file)} -> ${path.relative(__dirname, newFile)}`);
        } catch (e) {
            console.error(`Error converting ${file}:`, e);
        }
    }
}

run();
