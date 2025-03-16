<script lang="ts">
  import { debugLog, initStatus } from '$lib/utils/debugHelper';
  import { onMount } from 'svelte';
  
  let visible = false;
  let tab = 'logs';
  
  onMount(() => {
    // In development, make visible by default
    if (import.meta.env.DEV) {
      visible = true;
    }
    
    // Add keyboard shortcut to toggle overlay
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        visible = !visible;
      }
    });
  });
</script>

{#if visible}
<div class="fixed top-0 left-0 right-0 bottom-0 bg-black/80 text-white p-4 z-50 overflow-auto">
  <div class="flex justify-between mb-4">
    <div class="text-xl font-bold">Discord Activity Debug</div>
    <button on:click={() => visible = false} class="p-2 bg-red-500 rounded">Close</button>
  </div>
  
  <div class="flex space-x-2 mb-4">
    <button 
      class="p-2 {tab === 'logs' ? 'bg-blue-500' : 'bg-blue-800'} rounded"
      on:click={() => tab = 'logs'}>Logs</button>
    <button 
      class="p-2 {tab === 'status' ? 'bg-blue-500' : 'bg-blue-800'} rounded"
      on:click={() => tab = 'status'}>Init Status</button>
  </div>
  
  {#if tab === 'logs'}
    <div class="bg-gray-900 p-4 rounded font-mono text-sm h-[80vh] overflow-y-auto">
      {#each $debugLog as log}
        <div class="mb-1 {log.includes('[ERROR]') ? 'text-red-400' : 
                        log.includes('[SUCCESS]') ? 'text-green-400' : 'text-gray-300'}">
          {log}
        </div>
      {/each}
      {#if $debugLog.length === 0}
        <div class="text-gray-500">No logs yet...</div>
      {/if}
    </div>
  {:else if tab === 'status'}
    <div class="bg-gray-900 p-4 rounded font-mono text-sm">
      <div class="grid grid-cols-2 gap-2">
        <div>Physics Initialized:</div>
        <div class={$initStatus.physics ? 'text-green-400' : 'text-red-400'}>
          {$initStatus.physics ? '✓' : '✗'}
        </div>
        
        <div>Playroom Connected:</div>
        <div class={$initStatus.playroom ? 'text-green-400' : 'text-red-400'}>
          {$initStatus.playroom ? '✓' : '✗'}
        </div>
        
        <div>Three.js Initialized:</div>
        <div class={$initStatus.three ? 'text-green-400' : 'text-red-400'}>
          {$initStatus.three ? '✓' : '✗'}
        </div>
        
        <div>Models Loaded:</div>
        <div class={$initStatus.assets.models ? 'text-green-400' : 'text-red-400'}>
          {$initStatus.assets.models ? '✓' : '✗'}
        </div>
        
        <div>Textures Loaded:</div>
        <div class={$initStatus.assets.textures ? 'text-green-400' : 'text-red-400'}>
          {$initStatus.assets.textures ? '✓' : '✗'}
        </div>
      </div>
    </div>
  {/if}
</div>
{/if}