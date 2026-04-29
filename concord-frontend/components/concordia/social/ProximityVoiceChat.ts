// Proximity-based WebRTC voice chat.
// Each nearby player gets a dedicated RTCPeerConnection. Volume is derived
// from distance and applied via a GainNode so no audio processing happens
// in JavaScript — the WebAudio graph handles mixing.
//
// Socket.io signaling events used:
//   out: voice:join, voice:offer, voice:answer, voice:ice-candidate, voice:leave
//   in:  voice:peer-joined, voice:offer, voice:answer, voice:ice-candidate, voice:peer-left

import type { Socket } from 'socket.io-client';

export interface ProximityPeer {
  playerId: string;
  volume: number;   // 0-1, distance-derived
  muted: boolean;
}

export interface ProximityVoiceChatOptions {
  maxRange: number;           // metres at which voice fades to 0
  onPeersChanged?: (peers: ProximityPeer[]) => void;
  onError?: (err: Error) => void;
}

interface PeerEntry {
  pc: RTCPeerConnection;
  gainNode: GainNode;
  volume: number;
  muted: boolean;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export class ProximityVoiceChat {
  private _opts: ProximityVoiceChatOptions;
  private _socket: Socket | null = null;
  private _localStream: MediaStream | null = null;
  private _audioCtx: AudioContext | null = null;
  private _peers = new Map<string, PeerEntry>();
  private _running = false;

  constructor(options: ProximityVoiceChatOptions) {
    this._opts = options;
  }

  async start(socket: Socket): Promise<void> {
    if (this._running) return;
    this._socket = socket;

    this._localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    this._audioCtx = new AudioContext();
    this._running = true;

    socket.emit('voice:join');
    this._bindSocketEvents(socket);
  }

  stop(): void {
    if (!this._running) return;
    this._running = false;

    this._socket?.emit('voice:leave');
    this._unbindSocketEvents();

    for (const [id] of this._peers) this._disconnectPeer(id);
    this._peers.clear();

    this._localStream?.getTracks().forEach(t => t.stop());
    this._localStream = null;
    this._audioCtx?.close();
    this._audioCtx = null;
    this._opts.onPeersChanged?.([]);
  }

  updateProximity(
    localPos: { x: number; z: number },
    nearbyPlayers: Array<{ id: string; position: { x: number; z: number } }>,
  ): void {
    if (!this._running) return;
    const maxRange = this._opts.maxRange;

    const inRange = new Set<string>();
    for (const p of nearbyPlayers) {
      const dx = localPos.x - p.position.x;
      const dz = localPos.z - p.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist >= maxRange) continue;

      inRange.add(p.id);
      const vol = Math.max(0, 1 - dist / maxRange);
      const entry = this._peers.get(p.id);
      if (entry) {
        entry.volume = vol;
        entry.gainNode.gain.setTargetAtTime(entry.muted ? 0 : vol, this._audioCtx!.currentTime, 0.1);
      }
      // New peer — send offer
      if (!entry) {
        this._initiateConnection(p.id);
      }
    }

    // Disconnect peers that left range
    for (const [id] of this._peers) {
      if (!inRange.has(id)) this._disconnectPeer(id);
    }

    this._emitPeers();
  }

  get peers(): ProximityPeer[] {
    return Array.from(this._peers.entries()).map(([id, e]) => ({
      playerId: id,
      volume: e.volume,
      muted: e.muted,
    }));
  }

  mute(playerId: string, muted: boolean): void {
    const entry = this._peers.get(playerId);
    if (!entry) return;
    entry.muted = muted;
    entry.gainNode.gain.setTargetAtTime(muted ? 0 : entry.volume, this._audioCtx!.currentTime, 0.05);
    this._emitPeers();
  }

  // ── Private ──────────────────────────────────────────────────────

  private _createPc(): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Add local mic tracks
    if (this._localStream) {
      for (const track of this._localStream.getTracks()) {
        pc.addTrack(track, this._localStream);
      }
    }
    return pc;
  }

  private _wireRemoteAudio(pc: RTCPeerConnection, gain: GainNode): void {
    pc.ontrack = (ev) => {
      if (!this._audioCtx) return;
      const src = this._audioCtx.createMediaStreamSource(ev.streams[0]);
      src.connect(gain);
      gain.connect(this._audioCtx.destination);
    };
  }

  private async _initiateConnection(peerId: string): Promise<void> {
    if (!this._audioCtx || !this._socket) return;
    const pc = this._createPc();
    const gain = this._audioCtx.createGain();
    gain.gain.value = 0;
    this._wireRemoteAudio(pc, gain);
    this._peers.set(peerId, { pc, gainNode: gain, volume: 0, muted: false });

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        this._socket!.emit('voice:ice-candidate', { to: peerId, candidate: ev.candidate });
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this._socket.emit('voice:offer', { to: peerId, sdp: offer });
  }

  private async _handleOffer(from: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    if (!this._audioCtx || !this._socket) return;

    let entry = this._peers.get(from);
    if (!entry) {
      const pc = this._createPc();
      const gain = this._audioCtx.createGain();
      gain.gain.value = 0;
      this._wireRemoteAudio(pc, gain);
      entry = { pc, gainNode: gain, volume: 0, muted: false };
      this._peers.set(from, entry);

      entry.pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          this._socket!.emit('voice:ice-candidate', { to: from, candidate: ev.candidate });
        }
      };
    }

    await entry.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await entry.pc.createAnswer();
    await entry.pc.setLocalDescription(answer);
    this._socket.emit('voice:answer', { to: from, sdp: answer });
  }

  private async _handleAnswer(from: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    const entry = this._peers.get(from);
    if (!entry) return;
    await entry.pc.setRemoteDescription(new RTCSessionDescription(sdp));
  }

  private async _handleIceCandidate(from: string, candidate: RTCIceCandidateInit): Promise<void> {
    const entry = this._peers.get(from);
    if (!entry) return;
    try {
      await entry.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {
      // Stale candidates are safe to ignore
    }
  }

  private _disconnectPeer(peerId: string): void {
    const entry = this._peers.get(peerId);
    if (!entry) return;
    entry.pc.close();
    entry.gainNode.disconnect();
    this._peers.delete(peerId);
  }

  private _emitPeers(): void {
    this._opts.onPeersChanged?.(this.peers);
  }

  private _handlePeerLeft = (data: { from: string }): void => {
    this._disconnectPeer(data.from);
    this._emitPeers();
  };

  private _handleOffer_bound = (data: { from: string; sdp: RTCSessionDescriptionInit }): void => {
    this._handleOffer(data.from, data.sdp).catch(err => this._opts.onError?.(err as Error));
  };

  private _handleAnswer_bound = (data: { from: string; sdp: RTCSessionDescriptionInit }): void => {
    this._handleAnswer(data.from, data.sdp).catch(err => this._opts.onError?.(err as Error));
  };

  private _handleIce_bound = (data: { from: string; candidate: RTCIceCandidateInit }): void => {
    this._handleIceCandidate(data.from, data.candidate).catch(err => this._opts.onError?.(err as Error));
  };

  private _bindSocketEvents(socket: Socket): void {
    socket.on('voice:offer',          this._handleOffer_bound);
    socket.on('voice:answer',         this._handleAnswer_bound);
    socket.on('voice:ice-candidate',  this._handleIce_bound);
    socket.on('voice:peer-left',      this._handlePeerLeft);
  }

  private _unbindSocketEvents(): void {
    if (!this._socket) return;
    this._socket.off('voice:offer',         this._handleOffer_bound);
    this._socket.off('voice:answer',        this._handleAnswer_bound);
    this._socket.off('voice:ice-candidate', this._handleIce_bound);
    this._socket.off('voice:peer-left',     this._handlePeerLeft);
  }
}
