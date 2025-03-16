<script lang="ts">
	// Svelte
	import { onMount } from "svelte";

	// Libs
	import * as THREE from "three";
	import { CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
	import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
	import { ConvexHull } from "three/examples/jsm/math/ConvexHull.js";
	import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
	import RAPIER from "@dimforge/rapier3d-compat";
	import { insertCoin, onPlayerJoin, me } from "playroomkit";

	// Env variables
	import { PUBLIC_PLAYROOM_ID } from "$env/static/public";

	// Utils
	import { Player } from "$lib/models/Player";
	import { Ground } from "$lib/models/Ground";
	import { Guest } from "$lib/models/Guest";
	import { logDebug, initStatus, checkWebGLSupport } from "$lib/utils/debugHelper";

	// Stores
	import { guests } from "$lib/stores/guests";

	// Variables
	const loader = new GLTFLoader();
	const textureLoader = new THREE.TextureLoader();
	const gravity = { x: 0.0, y: -9.81, z: 0.0 };
	// If enabled, you can see yourself in the game as a static object
	const debug = false;
	let composer: EffectComposer;
	let rootElement: HTMLElement;
	let camera: THREE.PerspectiveCamera;
	let renderer: THREE.WebGLRenderer;
	let isDiscordEnvironment = false;
	let initSuccessful = false;
	let fallbackScene = false;

	function detectEnvironment() {
	try {
		// Check if we're in Discord (uses specific URL patterns or window properties)
		isDiscordEnvironment = window.location.href.includes('discord.com') || 
							!!window.DiscordNative || 
							document.referrer.includes('discord.com');
		
		console.log(`[INFO] Environment detection: ${isDiscordEnvironment ? 'Discord' : 'Browser'}`);
		return isDiscordEnvironment;
	} catch (e) {
		console.log('[INFO] Environment detection failed, assuming browser', e);
		return false;
	}
	}



	onMount(async () => {
		logDebug("Component mounted - starting initialization");

				try {
    console.log('[INFO] Component mounted - starting initialization');
    
    // Detect environment
    detectEnvironment();
    
    // Initialize physics
    const world = await initPhysics();
    
    // Try to initialize PlayroomKit
    let playroomInitialized = false;
    try {
      await initPlayroom();
      playroomInitialized = true;
    } catch (error) {
      console.error('[ERROR] Playroom initialization failed', error);
      
      // If we're in Discord, this is critical - use fallback mode
      if (isDiscordEnvironment) {
        initFallbackMode(rootElement);
        return;
      }
      // In browser, continue anyway
    }
    
    // Initialize Three.js scene
    const scene = initThree(world);
    
    // Only initialize guests if Playroom was initialized
    if (playroomInitialized) {
      initGuests(scene, world, new THREE.Vector3(0, 0.2, 0));
    }
  } catch (error) {
    console.error('[ERROR] Initialization error:', error);
    // Last resort - fallback mode
    initFallbackMode(rootElement);
  }
        
		// Check if we're in Discord
		try {
			isDiscordEnvironment = window.location.href.includes('discord.com') || 
								  window.location.hostname.includes('discord') ||
								  document.referrer.includes('discord');
			logDebug(`Environment detection: ${isDiscordEnvironment ? 'Discord' : 'Browser'}`);
		} catch (e) {
			logDebug(`Environment detection error: ${e}`, 'error');
		}
        
		// Check WebGL support first
		if (!checkWebGLSupport()) {
			logDebug("WebGL not supported, aborting initialization", 'error');
			showFallbackMessage("WebGL not supported on this device or browser");
			return;
		}

		try {
			logDebug("Initializing physics");
			const world = await initPhysics();
			initStatus.update(s => ({ ...s, physics: true }));
            
			logDebug("Initializing Playroom");
			await initPlayroom();
			initStatus.update(s => ({ ...s, playroom: true }));
            
			logDebug("Initializing Three.js");
			const scene = initThree(world);
			initStatus.update(s => ({ ...s, three: true }));
            
			logDebug("Initializing guests");
			initGuests(scene, world, new THREE.Vector3(0, 0.2, 0));
            
			initSuccessful = true;
			logDebug("Initialization complete", 'success');
		} catch (error) {
			logDebug(`Initialization error: ${error}`, 'error');
			showFallbackMessage("Failed to initialize 3D environment");
		}
	});

	function showFallbackMessage(message: string) {
		// Create a fallback message when 3D rendering fails
		const fallbackMsg = document.createElement('div');
		fallbackMsg.innerHTML = message;
		fallbackMsg.style.color = 'white';
		fallbackMsg.style.padding = '20px';
		fallbackMsg.style.textAlign = 'center';
		fallbackMsg.style.backgroundColor = 'rgba(0,0,0,0.7)';
		fallbackMsg.style.borderRadius = '8px';
		fallbackMsg.style.margin = '20px';
		rootElement.appendChild(fallbackMsg);
	}

function initThree(world: RAPIER.World) {
	const renderWidth = rootElement.clientWidth;
	const renderHeight = rootElement.clientHeight;

	const labelRenderer = new CSS2DRenderer();
	labelRenderer.setSize(renderWidth, renderHeight);
	labelRenderer.domElement.style.position = "absolute";
	labelRenderer.domElement.style.top = "0px";
	rootElement.appendChild(labelRenderer.domElement);

	const renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setSize(renderWidth, renderHeight);
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	rootElement.appendChild(renderer.domElement);

	const scene = new THREE.Scene();

	camera = new THREE.PerspectiveCamera(65, renderWidth / renderHeight);
    
	// Initialize the composer
	composer = new EffectComposer(renderer);
	composer.setSize(renderWidth, renderHeight);

	// Initial setups
	const ground = new Ground(scene, world, 20);
	const player = new Player(me(), scene, world, ground.rigidBody.collider(0), camera, new THREE.Vector3(0, 2, 0));
	setupMap(scene, world);
	setupLights(scene);
	setupHDRI(scene);

	// Events
	handleResize(renderer, labelRenderer, camera);
	rootElement.addEventListener("click", () => {
		rootElement.requestPointerLock();
	});

	renderer.setAnimationLoop((time) => {
		player.update();
		updateGuests();
		world.step();
		renderer.render(scene, camera);
		labelRenderer.render(scene, camera);
	});

	return scene;
}

// Add these new helper functions
function createMinimalScene(scene) {
  // Add a simple cube to verify rendering works
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  const cube = new THREE.Mesh(geometry, material);
  cube.position.set(0, 0, -5);
  scene.add(cube);
  
  // Animation to rotate cube
  renderer.setAnimationLoop(() => {
    if (cube) {
      cube.rotation.x += 0.01;
      cube.rotation.y += 0.01;
    }
    renderer.render(scene, camera);
  });
}

// Promisify asset loading
function loadMapAsync(scene, world) {
  return new Promise((resolve, reject) => {
    try {
      const excludedMeshes = ["wall-narrow-gate", "metal-gate001", "bridge-draw001"];
      loader.load(
        "/scenes/map.glb",
        function(gltf) {
          const model = gltf.scene;
          logDebug("Map model loaded successfully");
          model.traverse((node) => {
            if (node instanceof THREE.Mesh) {
              node.castShadow = true;
              node.receiveShadow = true;
              if (!excludedMeshes.includes(node.name)) {
                try {
                  setupCollider(world, node);
                } catch (e) {
                  logDebug(`Collider setup failed for ${node.name}: ${e}`, "error");
                }
              }
            }
          });
          scene.add(model);
          initStatus.update(s => ({ ...s, assets: { ...s.assets, models: true }}));
          resolve();
        },
        function(progress) {
          logDebug(`Map loading progress: ${Math.round((progress.loaded / progress.total) * 100)}%`);
        },
        function(error) {
          logDebug(`Error loading map GLB: ${error}`, 'error');
          reject(error);
        }
      );
    } catch (e) {
      reject(e);
    }
  });
}

function loadSkyboxAsync(scene) {
  return new Promise((resolve, reject) => {
    try {
      textureLoader.load(
        "/textures/skybox.png",
        function(texture) {
          logDebug("Skybox texture loaded successfully");
          const geometry = new THREE.SphereGeometry(200, 16, 16); // Reduced segments
          geometry.scale(-1, 1, 1);
          const material = new THREE.MeshBasicMaterial({ map: texture });
          const sphere = new THREE.Mesh(geometry, material);
          scene.add(sphere);
          initStatus.update(s => ({ ...s, assets: { ...s.assets, textures: true }}));
          resolve();
        },
        function(progress) {
          logDebug(`Skybox loading progress: ${Math.round((progress.loaded / progress.total) * 100)}%`);
        },
        function(error) {
          logDebug(`Error loading skybox texture: ${error}`, 'error');
          reject(error);
        }
      );
    } catch (e) {
      reject(e);
    }
  });
}

	function handleResize(renderer: THREE.WebGLRenderer, labelRenderer: CSS2DRenderer, camera: THREE.PerspectiveCamera) {
		window.addEventListener("resize", () => {
			const newWidth = rootElement.clientWidth;
			const newHeight = rootElement.clientHeight;
			
			logDebug(`Window resized: ${newWidth}x${newHeight}`);
			
			camera.aspect = newWidth / newHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(newWidth, newHeight);
			labelRenderer.setSize(newWidth, newHeight);
			
			if (composer) {
				composer.setSize(newWidth, newHeight);
			}
		});
	}

	async function initPhysics() {
		try {
			await RAPIER.init();
			logDebug("RAPIER physics initialized");
			return new RAPIER.World(gravity);
		} catch (error) {
			logDebug(`Physics initialization error: ${error}`, 'error');
			throw error;
		}
	}

	async function initPlayroom() {
  try {
    // Simplified Discord integration that works better in Discord environment
    await insertCoin({
      gameId: PUBLIC_PLAYROOM_ID,
      // Set to true instead of complex options
      discord: true
    });
    
    console.log("[INFO] Successfully connected to PlayroomKit");
    return me();
  } catch (error) {
    console.error("[ERROR] Failed to initialize PlayroomKit:", error);
    
    // Create a more visible error message in the scene
    const errorEl = document.createElement("div");
    errorEl.style.position = "fixed";
    errorEl.style.top = "0";
    errorEl.style.left = "0";
    errorEl.style.width = "100%";
    errorEl.style.height = "100%";
    errorEl.style.backgroundColor = "rgba(0,0,0,0.8)";
    errorEl.style.color = "white";
    errorEl.style.display = "flex";
    errorEl.style.flexDirection = "column";
    errorEl.style.alignItems = "center";
    errorEl.style.justifyContent = "center";
    errorEl.style.padding = "20px";
    errorEl.style.zIndex = "9999";
    errorEl.style.fontFamily = "sans-serif";
    
    errorEl.innerHTML = `
      <h2 style="margin-bottom: 20px;">Discord Connection Error</h2>
      <p style="margin-bottom: 20px; text-align: center; max-width: 600px;">
        Please make sure you're running this in Discord with the right permissions.
        This app needs to be run inside a Discord Activity.
      </p>
      <button style="padding: 10px 20px; background: #5865F2; border: none; border-radius: 4px; cursor: pointer;">
        Retry Connection
      </button>
    `;
    
    document.body.appendChild(errorEl);
    errorEl.querySelector("button")?.addEventListener("click", () => location.reload());
    
    // Create a fallback user to at least let the app run in solo mode
    console.log("[INFO] Creating fallback solo mode...");
    
    // Return a minimal object to prevent further errors
    return {
      id: "solo-mode",
      getProfile: () => ({ name: "Solo Player", photo: "" }),
      setState: () => {},
      getState: () => null
    };
  }
}

function setupMap(scene: THREE.Scene, world: RAPIER.World) {
    // Create a simple floor plane for now if GLB loading fails
    const floorGeometry = new THREE.PlaneGeometry(40, 40);
    const floorMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x5a5a5a,
        roughness: 0.8
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    
    // Set up a basic collider for the floor
    const floorColliderDesc = RAPIER.ColliderDesc.cuboid(20, 0.1, 20);
    floorColliderDesc.setTranslation(0, -0.1, 0);
    world.createCollider(floorColliderDesc);
    
    // Attempt to load the detailed map as before
    const excludedMeshes = ["wall-narrow-gate", "metal-gate001", "bridge-draw001"];
    loader.load(
        "scenes/map.glb",
        function (gltf) {
            const model = gltf.scene;
            model.traverse((node) => {
                if (node instanceof THREE.Mesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                    if (!excludedMeshes.includes(node.name)) {
                        try {
                            setupCollider(world, node);
                        } catch (error) {
                            console.error("Failed to set up collider for", node.name, error);
                        }
                    }
                }
            });
            scene.add(model);
            // Remove the simple floor once the model is loaded
            scene.remove(floor);
        },
        undefined,
        function (error) {
            console.log("Error loading GLB:", error);
            // Keep the simple floor if GLB loading fails
        }
    );
}

function setupCollider(world: RAPIER.World, node: THREE.Mesh) {
    try {
        const convexHull = new ConvexHull().setFromObject(node);
        const vertices = convexHull.vertices;
        const buffer = new Float32Array(vertices.length * 3);
        for (let i = 0; i < vertices.length; i++) {
            buffer[i * 3] = vertices[i].point.x;
            buffer[i * 3 + 1] = vertices[i].point.y;
            buffer[i * 3 + 2] = vertices[i].point.z;
        }
        const meshColliderDesc = RAPIER.ColliderDesc.convexHull(buffer);
        if (meshColliderDesc) {
            world.createCollider(meshColliderDesc);
        }
    } catch (error) {
        console.error("Error creating collider:", error);
        // Fallback to a simple box collider based on the mesh's bounding box
        const bbox = new THREE.Box3().setFromObject(node);
        const size = new THREE.Vector3();
        bbox.getSize(size);
        const center = new THREE.Vector3();
        bbox.getCenter(center);
        
        const boxColliderDesc = RAPIER.ColliderDesc.cuboid(
            Math.max(0.1, size.x / 2), 
            Math.max(0.1, size.y / 2), 
            Math.max(0.1, size.z / 2)
        );
        boxColliderDesc.setTranslation(center.x, center.y, center.z);
        world.createCollider(boxColliderDesc);
    }
}

	function setupLights(scene: THREE.Scene) {
		const ambientLight = new THREE.AmbientLight("#E6F9EC", 1);
		scene.add(ambientLight);
		
		const directionalLight = new THREE.DirectionalLight(0xffffff, 4.2);
		directionalLight.castShadow = true;
		directionalLight.shadow.bias = -0.0001;
		directionalLight.shadow.mapSize.width = 2048; // Reduced for performance
		directionalLight.shadow.mapSize.height = 2048;
		directionalLight.shadow.camera.near = 0.5;
		directionalLight.shadow.camera.far = 500;
		directionalLight.shadow.camera.left = -50;
		directionalLight.shadow.camera.right = 50;
		directionalLight.shadow.camera.top = 50;
		directionalLight.shadow.camera.bottom = -50;
		directionalLight.rotation.z = Math.PI / 4;
		directionalLight.position.set(-20, 20, 0);
		scene.add(directionalLight);
		
		logDebug("Lights setup complete");
	}

	function setupHDRI(scene: THREE.Scene) {
		logDebug("Loading skybox texture");
		
		textureLoader.load(
			"/textures/skybox.png",
			function(texture) {
				logDebug("Skybox texture loaded successfully");
				const geometry = new THREE.SphereGeometry(200, 32, 32);
				geometry.scale(-1, 1, 1);
				const material = new THREE.MeshBasicMaterial({ map: texture });
				const sphere = new THREE.Mesh(geometry, material);
				scene.add(sphere);
				initStatus.update(s => ({ ...s, assets: { ...s.assets, textures: true }}));
			},
			function(progress) {
				logDebug(`Skybox loading progress: ${Math.round((progress.loaded / progress.total) * 100)}%`);
			},
			function(error) {
				logDebug(`Error loading skybox texture: ${error}`, 'error');
			}
		);
	}


	function initFallbackMode(rootElement: HTMLElement) {
  console.log('[INFO] Initializing fallback mode');
  
  // Clear any existing content
  rootElement.innerHTML = '';
  
  // Create a simple canvas for rendering
  const canvas = document.createElement('canvas');
  canvas.width = rootElement.clientWidth;
  canvas.height = rootElement.clientHeight;
  rootElement.appendChild(canvas);
  
  // Initialize basic Three.js scene
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(canvas.width, canvas.height);
  
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);
  
  const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
  camera.position.set(0, 1.5, 3);
  camera.lookAt(0, 0, 0);
  
  // Add lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(1, 2, 3);
  scene.add(directionalLight);
  
  // Add a simple floor
  const floorGeometry = new THREE.PlaneGeometry(10, 10);
  const floorMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x3a506b,
    roughness: 0.8 
  });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.5;
  scene.add(floor);
  
  // Add a cube representing the player
  const cubeGeometry = new THREE.BoxGeometry(0.5, 1, 0.5);
  const cubeMaterial = new THREE.MeshStandardMaterial({ color: 0x5bc0be });
  const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
  cube.position.y = 0.5;
  scene.add(cube);
  
  // Add text explaining the situation
  const textDiv = document.createElement('div');
  textDiv.style.position = 'absolute';
  textDiv.style.top = '20px';
  textDiv.style.left = '0';
  textDiv.style.width = '100%';
  textDiv.style.textAlign = 'center';
  textDiv.style.color = 'white';
  textDiv.style.fontFamily = 'sans-serif';
  textDiv.style.fontSize = '18px';
  textDiv.style.padding = '10px';
  textDiv.innerHTML = `
    <h2>Running in Fallback Mode</h2>
    <p>Discord integration is disabled. Some features may be limited.</p>
    <button id="retry-btn" style="padding: 8px 16px; margin-top: 10px; background: #5865F2; border: none; border-radius: 4px; color: white; cursor: pointer;">
      Retry Connection
    </button>
  `;
  rootElement.appendChild(textDiv);
  document.getElementById('retry-btn')?.addEventListener('click', () => location.reload());
  
  // Animation loop
  function animate() {
    requestAnimationFrame(animate);
    cube.rotation.y += 0.01;
    renderer.render(scene, camera);
  }
  animate();
  
  // Handle resize
  window.addEventListener('resize', () => {
    const width = rootElement.clientWidth;
    const height = rootElement.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  });
  
  return true;
}


	function updateGuests() {
		for (const guest of $guests) {
			guest.update();
		}
	}
</script>

<!-- Main container -->
<div class="h-full w-full flex flex-col justify-center items-center relative" bind:this={rootElement}>
	{#if isDiscordEnvironment && !initSuccessful}
		<div class="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center bg-black/50">
			<div class="p-4 bg-black/80 rounded-lg text-white text-center">
				<p>Loading Discord Activity...</p>
				<div class="w-full h-2 bg-gray-700 rounded-full mt-2 overflow-hidden">
					<div class="h-full bg-blue-500 rounded-full animate-pulse" style="width: 60%"></div>
				</div>
			</div>
		</div>
	{/if}
</div>