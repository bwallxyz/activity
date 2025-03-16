<script lang="ts">
  import { onMount } from "svelte";
  import * as THREE from "three";

  let container: HTMLElement;
  let renderer: THREE.WebGLRenderer;
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let cube: THREE.Mesh;
  
  onMount(() => {
    initBasicScene();
    
    return () => {
      if (renderer) {
        renderer.dispose();
      }
    };
  });
  
  function initBasicScene() {
    // Basic scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);
    
    camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.z = 5;
    
    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);
    
    // Add a simple rotating cube
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial({ color: 0x44aa88 });
    cube = new THREE.Mesh(geometry, material);
    scene.add(cube);
    
    // Add simple lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 1, 2);
    scene.add(directionalLight);
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize);
    
    animate();
  }
  
  function onWindowResize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }
  
  function animate() {
    requestAnimationFrame(animate);
    
    cube.rotation.x += 0.01;
    cube.rotation.y += 0.01;
    
    renderer.render(scene, camera);
  }
</script>

<div class="w-full h-full" bind:this={container}>
  <div class="absolute top-4 left-0 right-0 text-center">
    <p class="px-4 py-2 rounded-lg bg-black/70 text-white inline-block">
      Discord Activity - Fallback Mode
    </p>
  </div>
</div>
*/

// 4. Update +page.svelte to conditionally render either the main or fallback scene
// client/src/routes/+page.svelte

/*
<script lang="ts">
  import { onMount } from "svelte";
  import Scene from "$lib/components/Scene.svelte";
  import FallbackScene from "$lib/components/FallbackScene.svelte";
  import UI from "$lib/components/UI.svelte";
  import DebugOverlay from "$lib/components/DebugOverlay.svelte";
  import { debugLog } from "$lib/utils/debugHelper";
  
  let useMainScene = true;
  let isDiscord = false;
  
  onMount(() => {
    // Check if we're in Discord
    isDiscord = window.location.href.includes('discord.com') || 
               window.location.hostname.includes('discord') ||
               document.referrer.includes('discord');
    
    // Listen for errors and switch to fallback if needed
    debugLog.subscribe(logs => {
      const hasErrors = logs.some(log => log.includes('[ERROR]'));
      if (hasErrors && logs.length > 5 && isDiscord) {
        console.log("Multiple errors detected, switching to fallback scene");
        useMainScene = false;
      }
    });
  });
</script>

<div class="h-screen w-screen overflow-hidden">
  {#if useMainScene}
    <Scene />
  {:else}
    <FallbackScene />
  {/if}
  <UI />
  <DebugOverlay />
</div>
*/