import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Find a matching recording file for the given request
 */
function findRecording(req, requestBody, recordingsFolder) {
  try {
    // Parse URL
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
    const hasQuery = url.search.length > 0;
    const hasBody = requestBody && requestBody.length > 0;
    
    // Build search parameters
    const method = req.method.toUpperCase();
    const queryFlag = hasQuery ? 'qp' : 'nq';
    const bodyFlag = hasBody ? 'bp' : 'nb';
    
    // Build directory path
    const recordingsDir = join(__dirname, '..', '..', 'recordings', recordingsFolder, pathname);
    
    // Check if directory exists
    if (!existsSync(recordingsDir)) {
      return null;
    }
    
    // Build file prefix to search for
    const prefix = `${method}_${queryFlag}_${bodyFlag}_`;
    
    // Get all matching files, sorted newest first
    const matchingFiles = readdirSync(recordingsDir)
      .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
      .sort()
      .reverse(); // Newest first
    
    if (matchingFiles.length === 0) {
      return null;
    }
    
    // If no query params, just return the newest file
    if (!hasQuery) {
      const filepath = join(recordingsDir, matchingFiles[0]);
      const content = readFileSync(filepath, 'utf8');
      return JSON.parse(content);
    }
    
    // If query params exist, check URI match
    const fullUri = url.pathname + url.search;
    for (const file of matchingFiles) {
      const filepath = join(recordingsDir, file);
      try {
        const content = readFileSync(filepath, 'utf8');
        const recording = JSON.parse(content);
        
        if (recording.uri === fullUri) {
          return recording;
        }
      } catch (err) {
        console.error(`Error reading recording ${file}:`, err.message);
      }
    }
    
    // No exact match found
    return null;
  } catch (error) {
    console.error('Error finding recording:', error.message);
    return null;
  }
}

/**
 * Mock response plugin
 * Returns mock responses based on rules or passes through to target server
 */
export default {
  name: 'mock',
  description: 'Route requests to mock recordings or pass to target server',
  enabled: false,
  options: {
    rules: {
      type: 'array',
      default: [],
      label: 'Mock Rules',
      description: 'List of rules to match requests'
    },
    fallback: {
      type: 'text',
      default: 'PASS',
      label: 'Fallback Action',
      description: 'Action when no rule matches (RET_REC or PASS)'
    },
    fallback_fallback: {
      type: 'text',
      default: 'PASS',
      label: 'Fallback Fallback Action',
      description: 'Action when RET_REC finds no recording (500, 200, or PASS)'
    },
    recordingsFolder: {
      type: 'text',
      default: 'active',
      label: 'Recordings Folder',
      description: 'Folder to search for recordings (default: active)'
    }
  },
  handler: async ({ req, requestBody, config, decision }) => {
    const { fallback, fallback_fallback, recordingsFolder = 'active' } = config;
    
    // TODO: Implement rule matching logic
    // For now, using fallback action directly
    
    let action = fallback;
    
    // Handle the action
    if (action === 'PASS') {
      // Let the request pass through to target server
      return null;
    }
    
    if (action === 'RET_REC') {
      // Try to find a recording
      const recording = findRecording(req, requestBody, recordingsFolder);
      
      if (recording) {
        // Return the recorded response
        console.log(`🎭 Mock: Returning recorded response for ${req.method} ${req.url}`);
        return {
          action: 'mock',
          mock: {
            statusCode: recording.httpStatus,
            headers: {
              'Content-Type': 'application/json',
              'X-Mock-Source': 'recording',
              'AAmocked': ' ~~~~~ SUCCESSFULLY MOCKED BY NWC2 ~~~~~ '
            },
            body: JSON.stringify(recording.response)
          }
        };
      }
      
      // No recording found - apply fallback_fallback
      console.log(`🎭 Mock: No recording found for ${req.method} ${req.url}, applying fallback_fallback: ${fallback_fallback}`);
      
      if (fallback_fallback === 'PASS') {
        // Pass through to target server
        return null;
      }
      
      if (fallback_fallback === '500') {
        return {
          action: 'mock',
          mock: {
            statusCode: 500,
            headers: {
              'Content-Type': 'application/json',
              'X-Mock-Source': 'fallback',
              'AAmocked': ' ~~~~~ SUCCESSFULLY MOCKED BY NWC2 ~~~~~ '
            },
            body: JSON.stringify({ error: 'No recording found' })
          }
        };
      }
      
      if (fallback_fallback === '200') {
        return {
          action: 'mock',
          mock: {
            statusCode: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-Mock-Source': 'fallback',
              'AAmocked': ' ~~~~~ SUCCESSFULLY MOCKED BY NWC2 ~~~~~ '
            },
            body: JSON.stringify({})
          }
        };
      }
    }
    
    // Default: pass through
    return null;
  }
};
