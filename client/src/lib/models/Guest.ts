// Libs
import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import RAPIER from "@dimforge/rapier3d-compat";

// Types
import type { PlayerState } from "playroomkit";

export class Guest {
	public mesh: THREE.Mesh;
	private rigidBody: RAPIER.RigidBody;

	constructor(
		public playerState: PlayerState,
		private scene: THREE.Scene,
		private world: RAPIER.World,
		private spawnPos: THREE.Vector3,
		private debug: boolean
	) {
		const { mesh, rigidBody } = this.spawn();
		this.mesh = mesh;
		this.rigidBody = rigidBody;
	}

	private spawn() {
		try {
			const geometry = new THREE.CapsuleGeometry(0.125, 0.25, 10, 16);
			const material = new THREE.MeshStandardMaterial({
				color: this.getPlayerColor(),
				roughness: 0.5,
			});
			const player = new THREE.Mesh(geometry, material);
			player.position.copy(this.spawnPos);
			player.layers.enableAll();

			const nameLabel = this.createBillboard();
			nameLabel.position.set(player.position.x, player.position.y + 0.1, player.position.z);
			nameLabel.center.set(0.5, 1);
			player.add(nameLabel);
			nameLabel.layers.set(0);

			this.scene.add(player);
			this.playerState.setState("pos", { x: this.spawnPos.x, y: this.spawnPos.y, z: this.spawnPos.z });

			// Physics
			const playerRigidBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(
				this.spawnPos.x,
				this.spawnPos.y,
				this.spawnPos.z
			);
			const playerRigidBody = this.world.createRigidBody(playerRigidBodyDesc);
			const playerColliderDesc = RAPIER.ColliderDesc.cuboid(0.2, 0.2, 0.2);
			this.world.createCollider(playerColliderDesc, playerRigidBody);

			return { mesh: player, rigidBody: playerRigidBody };
		} catch (error) {
			console.error("Error spawning guest:", error);
			// Create a minimal mesh as fallback
			const mesh = new THREE.Mesh(
				new THREE.BoxGeometry(0.2, 0.2, 0.2),
				new THREE.MeshBasicMaterial({ color: 0xff0000 })
			);
			this.scene.add(mesh);
			
			// Create a minimal rigid body
			const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
				.setTranslation(this.spawnPos.x, this.spawnPos.y, this.spawnPos.z);
			const rigidBody = this.world.createRigidBody(rigidBodyDesc);
			
			return { mesh, rigidBody };
		}
	}

	private getPlayerColor() {
		try {
			return this.playerState.getColor() || "#FFFFFF";
		} catch (error) {
			return "#FFFFFF";
		}
	}

	private getPlayerName() {
		try {
			const profile = this.playerState.getProfile();
			return profile?.name || `Player ${this.playerState.id.substring(0, 4)}`;
		} catch (error) {
			return `Player ${Math.floor(Math.random() * 1000)}`;
		}
	}

	private createBillboard() {
		try {
			const nameDiv = document.createElement("div");
			nameDiv.className =
				"rounded-full flex flex-row justify-center items-center space-x-1 bg-black/50 backdrop-blur-xl text-white text-sm p-1 pr-2";

			const name = document.createElement("p");
			name.textContent = this.getPlayerName();

			// Simple colored circle instead of trying to load profile images
			const colorCircle = document.createElement("div");
			colorCircle.className = "rounded-full w-5 h-5";
			colorCircle.style.backgroundColor = this.getPlayerColor();
			
			nameDiv.appendChild(colorCircle);
			nameDiv.appendChild(name);

			return new CSS2DObject(nameDiv);
		} catch (error) {
			console.error("Error creating billboard:", error);
			
			// Fallback to a simpler label
			const fallbackDiv = document.createElement("div");
			fallbackDiv.className = "text-white text-sm bg-black/50 px-2 py-1 rounded";
			fallbackDiv.textContent = "Player";
			
			return new CSS2DObject(fallbackDiv);
		}
	}

	public despawn() {
		try {
			if (this.mesh) {
				const nameLabel = this.mesh.children.find((child) => child instanceof CSS2DObject);
				if (nameLabel) {
					this.mesh.remove(nameLabel);
				}
				this.scene.remove(this.mesh);
			}
			if (this.rigidBody) {
				this.world.removeRigidBody(this.rigidBody);
			}
		} catch (error) {
			console.error("Error despawning guest:", error);
		}
	}

	public update() {
		try {
			let playerPos = this.playerState.getState("pos") || { x: this.spawnPos.x, y: 0.25, z: this.spawnPos.z };
			if (this.debug) {
				playerPos = { x: 0, y: 0.25, z: -0.75 };
			}
			const { x, y, z } = playerPos;

			this.mesh.position.set(x, y, z);

			this.rigidBody.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
			this.rigidBody.setTranslation({ x, y, z }, true);

			this.playerState.setState("pos", { x, y, z });
		} catch (error) {
			console.error("Error updating guest:", error);
		}
	}
}