import { writeFileSync, mkdirSync, readdirSync, readFileSync, unlinkSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Feature flag: Delete duplicate recordings
const DELETE_DUPLICATES = true;

/**
 * Recorder plugin
 * Records all requests and responses to files
 */
export default {
  name: 'recorder',
  description: 'Record requests and responses to files',
  enabled: false,
  options: {
    deleteDuplicates: {
      type: 'boolean',
      default: true,
      label: 'Delete Duplicates',
      description: 'Automatically delete duplicate recordings'
    },
    recordingPath: {
      type: 'text',
      default: 'recordings/active',
      label: 'Recording Path',
      description: 'Base path for recording storage'
    },
    maxRecordings: {
      type: 'number',
      default: -1,
      label: 'Max Recordings',
      description: 'Maximum number of recordings to keep (-1 for unlimited)'
    }
  },
  handler: async ({ req, requestBody, config, decision }) => {
    // This plugin works on responses
    return {
      modifyResponse: (proxyRes, responseBody) => {
        try {
          // Use actual request body if available (captured during proxy)
          const actualBody = req.actualRequestBody || requestBody;
          
          // Parse URL to get path and query params
          const url = new URL(req.url, `http://${req.headers.host}`);
          const pathname = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
          const hasQuery = url.search.length > 0;
          const hasBody = actualBody && actualBody.length > 0;
          
          // Build filename components
          const method = req.method.toUpperCase();
          const queryFlag = hasQuery ? 'qp' : 'nq';
          const bodyFlag = hasBody ? 'bp' : 'nb';
          
          // Format timestamp for alphabetical sorting: YYYYMMDD_HHMMSS_mmm
          const now = new Date();
          const timestamp = now.toISOString()
            .replace(/[-:]/g, '')
            .replace('T', '_')
            .replace('.', '_')
            .replace('Z', '');
          
          const filename = `${method}_${queryFlag}_${bodyFlag}_${timestamp}.json`;
          
          // Build directory path
          const recordingsDir = join(__dirname, '..', '..', 'recordings', 'active', pathname);
          
          // Create directory if it doesn't exist
          mkdirSync(recordingsDir, { recursive: true });
          
          // Parse request body
          let requestData = null;
          if (actualBody.length > 0) {
            try {
              requestData = JSON.parse(actualBody.toString('utf8'));
            } catch (e) {
              requestData = actualBody.toString('utf8');
            }
          }
          
          // Parse response body
          let responseData = null;
          try {
            responseData = JSON.parse(responseBody.toString('utf8'));
          } catch (e) {
            responseData = responseBody.toString('utf8');
          }
          
          // Prepare recording data in simplified format
          const recording = {
            httpMethod: req.method.toUpperCase(),
            uri: url.pathname + url.search,
            request: requestData,
            httpStatus: proxyRes.statusCode,
            response: responseData
          };
          
          // Check for duplicates if feature is enabled
          let duplicateFiles = [];
          if (DELETE_DUPLICATES && existsSync(recordingsDir)) {
            try {
              const prefix = `${method}_${queryFlag}_${bodyFlag}_`;
              const existingFiles = readdirSync(recordingsDir)
                .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
                .sort(); // Sort alphabetically (chronologically due to timestamp format)
              
              for (const existingFile of existingFiles) {
                const existingPath = join(recordingsDir, existingFile);
                try {
                  const existingContent = readFileSync(existingPath, 'utf8');
                  const existingRecording = JSON.parse(existingContent);
                  
                  // Compare URI, request and response
                  const uriMatch = existingRecording.uri === recording.uri;
                  const requestMatch = JSON.stringify(existingRecording.request) === JSON.stringify(recording.request);
                  const responseMatch = JSON.stringify(existingRecording.response) === JSON.stringify(recording.response);
                  
                  if (uriMatch && requestMatch && responseMatch) {
                    duplicateFiles.push({ file: existingFile, path: existingPath });
                  }
                } catch (err) {
                  // Ignore errors reading individual files
                }
              }
              
              // If duplicates found, keep the newest and delete the rest
              if (duplicateFiles.length > 0) {
                const newestDuplicate = duplicateFiles[duplicateFiles.length - 1];
                
                // Delete all except the newest
                for (let i = 0; i < duplicateFiles.length - 1; i++) {
                  unlinkSync(duplicateFiles[i].path);
                  console.log(`🗑️  Deleted old duplicate: ${duplicateFiles[i].file}`);
                }
                
                // Use the newest duplicate's filename instead of creating a new one
                console.log(`📼 Skipping: duplicate already exists as ${newestDuplicate.file}`);
                return null; // Don't write a new file
              }
            } catch (err) {
              console.error('Error checking for duplicates:', err.message);
            }
          }
          
          // Write to file (only if no duplicates found)
          // Normalize line endings to LF only
          const filepath = join(recordingsDir, filename);
          const jsonString = JSON.stringify(recording, null, 2).replaceAll(/\r\n/g, '\n');
          writeFileSync(filepath, jsonString, 'utf8');
          
          console.log(`📼 Recorded: ${method} ${pathname} -> ${filename}`);
        } catch (error) {
          console.error('Recorder plugin error:', error.message);
        }
        
        // Don't modify the response
        return null;
      }
    };
  }
};
