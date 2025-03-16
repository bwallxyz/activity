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