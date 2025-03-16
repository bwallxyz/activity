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

	onMount(async () => {
		logDebug("Component mounted - starting initialization");
        
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
		await insertCoin({
			gameId: PUBLIC_PLAYROOM_ID, 
			// Enable more Discord options for better integration
			discord: {
				// Include required Discord scopes
				requiredScopes: ["identify", "activities.write"],
				// Make sure to request proper permissions for Activity
				permissions: ["activities.write"],
				// Ensure the activity is properly configured
				activityConfig: {
					type: 0, // Playing
					details: "3D Chat",
					instance: true
				}
			}
		});
		return me();
	} catch (error) {
		console.error("Failed to initialize PlayroomKit:", error);
		// Create fallback UI to inform the user
		const errorDiv = document.createElement("div");
		errorDiv.className = "fixed inset-0 bg-black/80 text-white flex flex-col items-center justify-center p-5";
		errorDiv.innerHTML = `
			<h1 class="text-2xl font-bold mb-4">Connection Error</h1>
			<p class="text-center mb-4">Could not connect to Discord. Please make sure you're running this in Discord or try refreshing.</p>
			<button class="px-4 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-700">Refresh</button>
		`;
		errorDiv.querySelector("button")?.addEventListener("click", () => location.reload());
		document.body.appendChild(errorDiv);
		throw error;
	}
}

	function setupCollider(world: RAPIER.World, node: THREE.Mesh) {
		try {
			const convexHull = new ConvexHull().setFromObject(node);
			const vertices = convexHull.vertices;
			const buffer = new Float32Array(convexHull.vertices.length * 3);
			for (let i = 0; i < vertices.length; i++) {
				buffer[i * 3] = vertices[i].point.x;
				buffer[i * 3 + 1] = vertices[i].point.y;
				buffer[i * 3 + 2] = vertices[i].point.z;
			}
			const meshColliderDesc = RAPIER.ColliderDesc.convexHull(buffer) as RAPIER.ColliderDesc;
			world.createCollider(meshColliderDesc);
		} catch (error) {
			logDebug(`Error creating collider for mesh ${node.name}: ${error}`, 'error');
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