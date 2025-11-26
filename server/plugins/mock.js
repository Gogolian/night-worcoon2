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
 * Match a request against a rule
 * Supports:
 * - Exact match: /bff/cms/config or bff/cms/config
 * - Substring match: cms, cms/config, config
 * - Dynamic segments: /bff/:id/config (where :something acts as wildcard)
 */
function matchRule(req, rule) {
  // Parse URL to get pathname
  const url = new URL(req.url, `http://${req.headers.host}`);
  let pathname = url.pathname;
  const method = req.method.toUpperCase();
  
  // Check if method matches
  if (!rule.method || !rule.method.includes(method)) {
    return false;
  }
  
  // Check if URL matches
  // Rule URL can be empty (match all) or specific path
  if (!rule.url || rule.url === '') {
    return true; // Empty URL matches all
  }
  
  // Normalize both paths: remove leading slash
  const normalizedPathname = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  const normalizedRuleUrl = rule.url.startsWith('/') ? rule.url.slice(1) : rule.url;
  
  // Check if rule contains dynamic segments (e.g., :id, :customerId)
  if (normalizedRuleUrl.includes(':')) {
    // Convert rule pattern to regex
    // Split both paths into segments
    const patternSegments = normalizedRuleUrl.split('/');
    const pathSegments = normalizedPathname.split('/');
    
    // Must have same number of segments for exact match
    if (patternSegments.length !== pathSegments.length) {
      return false;
    }
    
    // Check each segment
    for (let i = 0; i < patternSegments.length; i++) {
      const patternSeg = patternSegments[i];
      const pathSeg = pathSegments[i];
      
      // :something acts as wildcard (matches any value)
      if (patternSeg.startsWith(':')) {
        continue; // This segment matches
      }
      
      // Exact segment match required
      if (patternSeg !== pathSeg) {
        return false;
      }
    }
    
    return true; // All segments matched
  }
  
  // Simple substring match (case-insensitive)
  // Check if the rule URL appears anywhere in the pathname
  if (normalizedPathname.includes(normalizedRuleUrl)) {
    return true;
  }
  
  return false;
}

/**
 * Execute an action (RET_REC or PASS)
 */
function executeAction(action, fallbackFallback, req, requestBody, recordingsFolder) {
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
    console.log(`🎭 Mock: No recording found for ${req.method} ${req.url}, applying fallback_fallback: ${fallbackFallback}`);
    
    if (fallbackFallback === 'PASS') {
      // Pass through to target server
      return null;
    }
    
    if (fallbackFallback === '500') {
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
    
    if (fallbackFallback === '200') {
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
    const { rules = [], fallback, fallback_fallback, recordingsFolder = 'active' } = config;
    
    // Try to match against rules
    let matchedRule = null;
    for (const rule of rules) {
      if (matchRule(req, rule)) {
        matchedRule = rule;
        break; // Use first matching rule
      }
    }
    
    let action;
    let ruleFallbackFallback;
    
    if (matchedRule) {
      // Use rule's action and fallback_fallback (if specified)
      action = matchedRule.action;
      ruleFallbackFallback = matchedRule.fallback_fallback || fallback_fallback;
      console.log(`🎯 Mock: Matched rule for ${req.method} ${req.url} -> ${action}`);
    } else {
      // No rule matched, use global fallback
      action = fallback;
      ruleFallbackFallback = fallback_fallback;
      console.log(`🎯 Mock: No rule matched for ${req.method} ${req.url}, using fallback -> ${action}`);
    }
    
    // Execute the action
    return executeAction(action, ruleFallbackFallback, req, requestBody, recordingsFolder);
  }
};
