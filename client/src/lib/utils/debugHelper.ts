import { writable } from 'svelte/store';

// Debug logging store - for tracking initialization issues
export const debugLog = writable<string[]>([]);

// Keep track of initialization steps
export const initStatus = writable({
  physics: false,
  playroom: false,
  three: false,
  assets: {
    models: false,
    textures: false
  }
});

// Helper function to add debug entries
export function logDebug(message: string, type: 'info' | 'error' | 'success' = 'info') {
  console.log(`[DEBUG] ${type.toUpperCase()}: ${message}`);
  debugLog.update(logs => [...logs, `[${type.toUpperCase()}] ${message}`]); 
}

// Use this in Scene.svelte to test WebGL support
export function checkWebGLSupport(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (!gl) {
      logDebug('WebGL not supported', 'error');
      return false;
    }
    
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      logDebug(`WebGL renderer: ${renderer}`, 'info');
    }
    
    return true;
  } catch (e) {
    logDebug(`WebGL detection error: ${e}`, 'error');
    return false;
  }
}