<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import * as THREE from "three";
	import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
	import { ConvexHull } from "three/examples/jsm/Addons.js";
	import RAPIER from "@dimforge/rapier3d-compat";
	
	// Components
	import { Player } from "$lib/models/Player";
	import { Ground } from "$lib/models/Ground";
	import { Guest } from "$lib/models/Guest";
	
	// Stores
	import { writable } from "svelte/store";
	
	// Variables
	let rootElement;
	let camera;
	let player;
	let discordChannel;
	let playerId = "local-" + Math.random().toString(36).substring(2, 9);
	
	// Simple multiplayer store to replace PlayroomKit
	const players = writable({});
	let myPosition = { x: 0, y: 0, z: 0 };
	
	// Check if we're in Discord
	const isDiscord = typeof window !== 'undefined' && (
		window.location.href.includes("discord.com") || 
		window !== window.parent
	);
	
	onMount(async () => {
		try {
			// Initialize Discord Activity SDK
			if (isDiscord) {
				initDiscordMultiplayer();
			}
			
			const world = await initPhysics();
			const scene = initThree(world);
		} catch (error) {
			console.error("Failed to initialize:", error);
		}
	});
	
	onDestroy(() => {
		// Clean up message listener
		window.removeEventListener("message", handleDiscordMessage);
	});
	
	function initDiscordMultiplayer() {
		// Setup communication with Discord
		window.addEventListener("message", handleDiscordMessage);
		
		// Let Discord know we're ready
		window.parent.postMessage({ type: "ACTIVITY_READY" }, "*");
		
		// Send position updates to Discord
		setInterval(() => {
			if (myPosition) {
				window.parent.postMessage({
					type: "ACTIVITY_UPDATE_STATE",
					data: { position: myPosition }
				}, "*");
			}
		}, 100);
	}
	
	function handleDiscordMessage(event) {
		// Only process messages from Discord
		if (!event.origin.includes("discord.com")) return;
		
		const { type, data } = event.data || {};
		
		if (type === "ACTIVITY_MEMBER_JOIN") {
			// New player joined
			const newPlayer = {
				id: data.userId,
				name: data.username,
				position: { x: 0, y: 2, z: 0 }
			};
			
			players.update(current => ({
				...current,
				[data.userId]: newPlayer
			}));
		}
		else if (type === "ACTIVITY_MEMBER_LEAVE") {
			// Player left
			players.update(current => {
				const updated = { ...current };
				delete updated[data.userId];
				return updated;
			});
		}
		else if (type === "ACTIVITY_STATE_UPDATE") {
			// Player state updated
			const userId = data.userId;
			const position = data.state?.position;
			
			if (userId && position) {
				players.update(current => {
					if (!current[userId]) return current;
					
					return {
						...current,
						[userId]: {
							...current[userId],
							position
						}
					};
				});
			}
		}
	}
	
	async function initPhysics() {
		await RAPIER.init();
		return new RAPIER.World({ x: 0, y: -9.81, z: 0 });
	}
	
	function initThree(world) {
		const renderWidth = rootElement.clientWidth;
		const renderHeight = rootElement.clientHeight;
		
		// Setup renderers
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
		
		// Setup scene elements
		const ground = new Ground(scene, world, 20);
		createSimpleScene(scene, world);
		setupLights(scene);
		
		// Create local player
		player = new Player({
			id: playerId,
			getState: () => ({}),
			setState: (key, value) => {
				if (key === "pos") {
					myPosition = value;
				}
			},
			getProfile: () => ({ name: "You" }),
			getColor: () => "#FF0000"
		}, scene, world, ground.rigidBody.collider(0), camera, new THREE.Vector3(0, 2, 0));
		
		// Handle other players
		const otherPlayers = {};
		
		// Subscribe to player updates
		const unsubscribe = players.subscribe(playerData => {
			Object.entries(playerData).forEach(([id, data]) => {
				// Skip self
				if (id === playerId) return;
				
				// Create new player if needed
				if (!otherPlayers[id]) {
					// Create player mesh
					const geometry = new THREE.CapsuleGeometry(0.125, 0.25, 10, 16);
					const material = new THREE.MeshStandardMaterial({
						color: "#FF00FF",
						roughness: 0.5
					});
					const mesh = new THREE.Mesh(geometry, material);
					scene.add(mesh);
					
					// Create nametag
					const nameDiv = document.createElement("div");
					nameDiv.className = "rounded-full px-2 py-1 bg-black/50 backdrop-blur-xl text-white text-sm";
					nameDiv.textContent = data.name || "Guest";
					
					const nameTag = new THREE.Object3D();
					nameTag.position.set(0, 0.5, 0);
					mesh.add(nameTag);
					
					otherPlayers[id] = { mesh, nameTag, data };
				}
				
				// Update position
				if (data.position) {
					otherPlayers[id].mesh.position.set(
						data.position.x,
						data.position.y,
						data.position.z
					);
				}
			});
			
			// Remove players that left
			Object.keys(otherPlayers).forEach(id => {
				if (!playerData[id]) {
					scene.remove(otherPlayers[id].mesh);
					delete otherPlayers[id];
				}
			});
		});
		
		// Events
		handleResize(renderer, labelRenderer, camera);
		rootElement.addEventListener("click", () => {
			rootElement.requestPointerLock();
		});
		
		// Animation loop
		renderer.setAnimationLoop(() => {
			player.update();
			world.step();
			renderer.render(scene, camera);
			labelRenderer.render(scene, camera);
		});
		
		return scene;
	}
	
	function createSimpleScene(scene, world) {
		// Add simple geometry instead of loading GLB
		const floorGeometry = new THREE.PlaneGeometry(40, 40);
		const floorMaterial = new THREE.MeshStandardMaterial({ 
			color: 0x8ADBA2,
			side: THREE.DoubleSide 
		});
		const floor = new THREE.Mesh(floorGeometry, floorMaterial);
		floor.rotation.x = -Math.PI / 2;
		floor.position.y = 0;
		floor.receiveShadow = true;
		scene.add(floor);
		
		// Add some simple structures
		for (let i = 0; i < 5; i++) {
			const boxGeometry = new THREE.BoxGeometry(2, 4, 2);
			const boxMaterial = new THREE.MeshStandardMaterial({ 
				color: 0x888888 
			});
			const box = new THREE.Mesh(boxGeometry, boxMaterial);
			box.position.set(
				(Math.random() - 0.5) * 20,
				2,
				(Math.random() - 0.5) * 20
			);
			box.castShadow = true;
			box.receiveShadow = true;
			scene.add(box);
			
			// Add physics for the box
			try {
				const boxDesc = RAPIER.ColliderDesc.cuboid(1, 2, 1);
				boxDesc.setTranslation(box.position.x, box.position.y, box.position.z);
				world.createCollider(boxDesc);
			} catch (error) {
				console.error("Error creating physics for box:", error);
			}
		}
		
		// Create simple sky
		const skyGeometry = new THREE.SphereGeometry(100, 32, 32);
		skyGeometry.scale(-1, 1, 1);
		const skyMaterial = new THREE.MeshBasicMaterial({
			color: 0x87CEEB
		});
		const sky = new THREE.Mesh(skyGeometry, skyMaterial);
		scene.add(sky);
	}
	
	function handleResize(renderer, labelRenderer, camera) {
		window.addEventListener("resize", () => {
			const newWidth = rootElement.clientWidth;
			const newHeight = rootElement.clientHeight;
			camera.aspect = newWidth / newHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(newWidth, newHeight);
			labelRenderer.setSize(newWidth, newHeight);
		});
	}
	
	function setupLights(scene) {
		const ambientLight = new THREE.AmbientLight("#E6F9EC", 1);
		scene.add(ambientLight);
		const directionalLight = new THREE.DirectionalLight(0xffffff, 4.2);
		directionalLight.castShadow = true;
		directionalLight.shadow.bias = -0.0001;
		directionalLight.shadow.mapSize.width = 4096;
		directionalLight.shadow.mapSize.height = 4096;
		directionalLight.shadow.camera.near = 0.5;
		directionalLight.shadow.camera.far = 500;
		directionalLight.shadow.camera.left = -50;
		directionalLight.shadow.camera.right = 50;
		directionalLight.shadow.camera.top = 50;
		directionalLight.shadow.camera.bottom = -50;
		directionalLight.rotation.z = Math.PI / 4;
		directionalLight.position.set(-20, 20, 0);
		scene.add(directionalLight);
	}
</script>

<!-- Main container -->
<div class="h-full w-full flex flex-col justify-center items-center" bind:this={rootElement}></div>