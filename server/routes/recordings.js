import express from 'express';
import { readdirSync, existsSync, statSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();
const RECORDINGS_DIR = join(__dirname, '..', '..', 'recordings');

/**
 * Recursively get all files from a directory
 * @param {string} dir - Directory path
 * @param {string} baseDir - Base directory for relative paths
 * @param {Array} fileList - Accumulator for file list
 * @returns {Array} List of relative file paths
 */
function getAllFiles(dir, baseDir = dir, fileList = []) {
  if (!existsSync(dir)) {
    return fileList;
  }

  const files = readdirSync(dir);

  files.forEach(file => {
    const filePath = join(dir, file);
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      getAllFiles(filePath, baseDir, fileList);
    } else {
      const relativePath = relative(baseDir, filePath);
      // Normalize path separators to forward slashes
      const normalizedPath = '/' + relativePath.replace(/\\/g, '/');
      fileList.push(normalizedPath);
    }
  });

  return fileList;
}

/**
 * Setup recordings API routes
 * @returns {Router} Express router
 */
export function setupRecordingsRoutes() {
  // Get list of first-level directories (recording folders)
  router.get('/folders', (req, res) => {
    try {
      if (!existsSync(RECORDINGS_DIR)) {
        return res.json({ folders: [] });
      }

      const items = readdirSync(RECORDINGS_DIR);
      const folders = items.filter(item => {
        const itemPath = join(RECORDINGS_DIR, item);
        return statSync(itemPath).isDirectory();
      });

      res.json({ folders });
    } catch (err) {
      console.error('Error listing recording folders:', err);
      res.status(500).json({ error: 'Failed to list recording folders' });
    }
  });

  // Get all files from a specific recording folder
  router.get('/files/:folder', (req, res) => {
    try {
      const { folder } = req.params;
      const folderPath = join(RECORDINGS_DIR, folder);

      if (!existsSync(folderPath)) {
        return res.status(404).json({ error: 'Folder not found' });
      }

      const stat = statSync(folderPath);
      if (!stat.isDirectory()) {
        return res.status(400).json({ error: 'Not a directory' });
      }

      const files = getAllFiles(folderPath);
      res.json({ files });
    } catch (err) {
      console.error('Error listing files:', err);
      res.status(500).json({ error: 'Failed to list files' });
    }
  });

  // Get content of a specific file
  router.get('/content/:folder/*', (req, res) => {
    try {
      const { folder } = req.params;
      const filePath = req.params[0]; // This captures everything after /content/:folder/
      
      // Construct full file path: recordings/{folder}/{filePath}
      const fullPath = join(RECORDINGS_DIR, folder, filePath);

      if (!existsSync(fullPath)) {
        return res.status(404).json({ error: 'File not found' });
      }

      const stat = statSync(fullPath);
      if (!stat.isFile()) {
        return res.status(400).json({ error: 'Not a file' });
      }

      const content = readFileSync(fullPath, 'utf8');
      const jsonContent = JSON.parse(content);
      res.json(jsonContent);
    } catch (err) {
      console.error('Error reading file:', err);
      res.status(500).json({ error: 'Failed to read file content' });
    }
  });

  // Update content of a specific file
  router.put('/content/:folder/*', (req, res) => {
    try {
      const { folder } = req.params;
      const filePath = req.params[0]; // This captures everything after /content/:folder/
      
      // Construct full file path: recordings/{folder}/{filePath}
      const fullPath = join(RECORDINGS_DIR, folder, filePath);

      if (!existsSync(fullPath)) {
        return res.status(404).json({ error: 'File not found' });
      }

      const stat = statSync(fullPath);
      if (!stat.isFile()) {
        return res.status(400).json({ error: 'Not a file' });
      }

      // req.body should be a string containing JSON from the client
      // Validate it's valid JSON by parsing
      const jsonContent = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      
      // Write the formatted JSON back to file
      writeFileSync(fullPath, JSON.stringify(jsonContent, null, 2), 'utf8');
      
      res.json({ success: true, message: 'File saved successfully' });
    } catch (err) {
      console.error('Error saving file:', err);
      res.status(500).json({ error: 'Failed to save file content' });
    }
  });

  // Delete a specific file
  router.delete('/content/:folder/*', (req, res) => {
    try {
      const { folder } = req.params;
      const filePath = req.params[0]; // This captures everything after /content/:folder/
      
      // Construct full file path: recordings/{folder}/{filePath}
      const fullPath = join(RECORDINGS_DIR, folder, filePath);

      if (!existsSync(fullPath)) {
        return res.status(404).json({ error: 'File not found' });
      }

      const stat = statSync(fullPath);
      if (!stat.isFile()) {
        return res.status(400).json({ error: 'Not a file' });
      }

      // Delete the file
      unlinkSync(fullPath);
      
      res.json({ success: true, message: 'File deleted successfully' });
    } catch (err) {
      console.error('Error deleting file:', err);
      res.status(500).json({ error: 'Failed to delete file' });
    }
  });

  return router;
}

export default setupRecordingsRoutes;
