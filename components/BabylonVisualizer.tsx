import React, { useEffect, useRef, useState } from 'react';
import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, Color4, GPUParticleSystem, Texture, SphereParticleEmitter, Color3, PostProcessRenderPipeline, DefaultRenderingPipeline, PointLight } from '@babylonjs/core';

export default function BabylonVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isAudioActive, setIsAudioActive] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  // Audio Setup
  const initAudio = async () => {
    if (audioContextRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const audioCtx = new AudioContext();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
      setIsAudioActive(true);
    } catch (err) {
      console.error("Audio capture failed:", err);
      alert("Mikrofon-Zugriff fehlgeschlagen. Überprüfen Sie Ihre Berechtigungen.");
    }
  };

  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new Engine(canvasRef.current, true, { preserveDrawingBuffer: true, stencil: true });
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0, 0, 0, 0); // Transparent for OBS

    // Camera
    const camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 30, Vector3.Zero(), scene);
    camera.attachControl(canvasRef.current, true);

    // Lights
    const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
    light.intensity = 0.5;

    const pLight = new PointLight("pointLight", Vector3.Zero(), scene);
    pLight.intensity = 0.8;
    pLight.diffuse = new Color3(0.5, 0.2, 1.0);

    // Setup GPU Particles
    const capacity = 100000;
    const particleSystem = new GPUParticleSystem("particles", { capacity }, scene);
    
    // In a real app we'd use a nice dot texture
    // For now we use the default particle texture if available, or create a dynamic one
    particleSystem.particleTexture = new Texture("https://models.babylonjs.com/assets/flare.png", scene);

    // Colors
    particleSystem.color1 = new Color4(0.5, 0.0, 1.0, 1.0);
    particleSystem.color2 = new Color4(0.2, 0.5, 1.0, 1.0);
    particleSystem.colorDead = new Color4(0, 0, 0.2, 0.0);

    // Size
    particleSystem.minSize = 0.1;
    particleSystem.maxSize = 0.3;

    // Lifetime
    particleSystem.minLifeTime = 1.0;
    particleSystem.maxLifeTime = 3.0;

    // Emission Rate
    particleSystem.emitRate = 20000;

    // Blend Mode
    particleSystem.blendMode = GPUParticleSystem.BLENDMODE_ADD;

    // Gravity
    particleSystem.gravity = new Vector3(0, 0, 0);

    // Emitter (Sphere)
    const sphereEmitter = new SphereParticleEmitter();
    sphereEmitter.radius = 10;
    sphereEmitter.radiusRange = 0.5;
    particleSystem.particleEmitterType = sphereEmitter;

    particleSystem.preWarmCycles = 100;
    particleSystem.preWarmStepOffset = 5;

    particleSystem.start();

    // Post processing (Bloom)
    const pipeline = new DefaultRenderingPipeline("default", true, scene, [camera]);
    pipeline.bloomEnabled = true;
    pipeline.bloomThreshold = 0.2;
    pipeline.bloomWeight = 0.8;

    // Render loop and Audio Reactive Logic
    let alpha = 0;
    engine.runRenderLoop(() => {
      alpha += 0.01;
      camera.alpha -= 0.002; // slow spin
      
      let bass = 0;
      let mid = 0;
      let high = 0;

      if (analyserRef.current && dataArrayRef.current) {
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);
        const data = dataArrayRef.current;
        
        // Simple FFT bands analysis
        const bassData = data.slice(0, 10);
        const midData = data.slice(20, 60);
        const highData = data.slice(80, 120);

        bass = bassData.reduce((a, b) => a + b, 0) / bassData.length / 255.0;
        mid = midData.reduce((a, b) => a + b, 0) / midData.length / 255.0;
        high = highData.reduce((a, b) => a + b, 0) / highData.length / 255.0;
      }

      // -- HARDGROOVE GRAVITY ENGINE LOGIC --
      
      // 1. Kick/Bass -> Attractor Pulse & Size
      // We simulate an attractor by modifying the sphere emission and gravity
      const intensity = bass * 15;
      sphereEmitter.radius = 8 + intensity;
      particleSystem.gravity = new Vector3(Math.sin(alpha) * intensity * 5, Math.cos(alpha) * intensity * 5, 0);
      
      // 2. Mids -> Noise & Turbulence
      particleSystem.gravity = new Vector3(
        particleSystem.gravity.x + Math.sin(alpha * 1.8) * mid * 0.12,
        particleSystem.gravity.y,
        Math.cos(alpha * 1.3) * mid * 0.9,
      );

      // 3. Highs -> Particle Emit Rate & Bloom Weight
      pipeline.bloomWeight = 0.5 + high * 2.0;
      particleSystem.emitRate = 10000 + Math.pow(high, 2) * 50000;

      // Pulse lighting
      pLight.intensity = 0.5 + bass * 2.0;

      scene.render();
    });

    const handleResize = () => engine.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      particleSystem.dispose();
      scene.dispose();
      engine.dispose();
    };
  }, []);

  return (
    <div className="w-full h-full relative bg-transparent flex flex-col items-center justify-center">
      {!isAudioActive && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-4 bg-zinc-950/80 p-6 rounded-2xl border border-zinc-800 backdrop-blur-xl">
          <h2 className="text-xl font-mono font-bold text-stone-200">ARV ENGINE: <span className="text-indigo-400">HARDGROOVE GRAVITY</span></h2>
          <p className="text-stone-400 text-sm font-mono text-center max-w-sm">
            Klicke, um Mikrofon / Loopback-Audio für die Audio-Reaktiven GPU Partikel zu aktivieren.
            Optimal für Einsatz in OBS als transparente Browser-Source.
          </p>
          <button 
            onClick={initAudio}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-mono font-bold transition-all"
          >
            AUDIO AKTIVIEREN
          </button>
        </div>
      )}
      <canvas 
        ref={canvasRef} 
        style={{ width: '100%', height: '100%', display: 'block', pointerEvents: isAudioActive ? 'auto' : 'none' }} 
        className="outline-none"
      />
      {isAudioActive && (
        <div className="absolute bottom-4 left-4 z-10 text-[10px] font-mono font-bold text-indigo-400/50 uppercase">
          [ARV] Hardware Accelerated Particle Engine • Audio In Sync
        </div>
      )}
    </div>
  );
}
