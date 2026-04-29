// Proximity-based voice chat stub.
// Full WebRTC peer connections are not yet implemented — flagged as a STOP
// CONDITION in the spec (Voice chat WebRTC infrastructure may be too
// complex for current scope).
//
// This module defines the interface and socket.io signaling skeleton so
// the rest of the system can call into it without changes when the full
// implementation lands.

export interface ProximityPeer {
  playerId: string;
  volume: number;      // 0-1, distance-derived
  muted: boolean;
}

export interface ProximityVoiceChatOptions {
  maxRange: number;    // metres at which voice fades to 0
  onPeersChanged?: (peers: ProximityPeer[]) => void;
}

export class ProximityVoiceChat {
  private _options: ProximityVoiceChatOptions;
  private _peers: Map<string, ProximityPeer> = new Map();
  private _running = false;

  constructor(options: ProximityVoiceChatOptions) {
    this._options = options;
  }

  /** Start proximity voice — stubs socket.io signaling, no peer connections yet. */
  async start(): Promise<void> {
    this._running = true;
    // TODO: request mic permission, create RTCPeerConnection factory,
    // subscribe to socket events:
    //   socket.on('voice:offer', handleOffer)
    //   socket.on('voice:answer', handleAnswer)
    //   socket.on('voice:ice-candidate', handleCandidate)
    console.info('[ProximityVoiceChat] Stub started — WebRTC pending implementation');
  }

  stop(): void {
    this._running = false;
    this._peers.clear();
    this._options.onPeersChanged?.([]);
  }

  /** Call from game loop when nearby player positions update. */
  updateProximity(
    localPos: { x: number; z: number },
    nearbyPlayers: Array<{ id: string; position: { x: number; z: number } }>,
  ): void {
    if (!this._running) return;
    const maxRange = this._options.maxRange;
    const updated = new Map<string, ProximityPeer>();

    for (const p of nearbyPlayers) {
      const dx = localPos.x - p.position.x;
      const dz = localPos.z - p.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist >= maxRange) continue;

      const volume = Math.max(0, 1 - dist / maxRange);
      updated.set(p.id, {
        playerId: p.id,
        volume,
        muted: this._peers.get(p.id)?.muted ?? false,
      });
    }

    // Diff peers: connect new, update existing, disconnect gone
    for (const [id] of this._peers) {
      if (!updated.has(id)) {
        // TODO: peer.disconnect()
      }
    }
    for (const [id, peer] of updated) {
      if (!this._peers.has(id)) {
        // TODO: initiateConnection(id)
        void peer;
      }
    }

    this._peers = updated;
    this._options.onPeersChanged?.(Array.from(updated.values()));
  }

  get peers(): ProximityPeer[] {
    return Array.from(this._peers.values());
  }

  mute(playerId: string, muted: boolean): void {
    const peer = this._peers.get(playerId);
    if (peer) {
      this._peers.set(playerId, { ...peer, muted });
    }
  }
}
