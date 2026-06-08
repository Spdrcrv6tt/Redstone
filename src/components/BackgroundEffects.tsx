"use client";

export function BackgroundEffects() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none select-none">
      {/* Base coat */}
      <div className="absolute inset-0 bg-[#09090b]" />

      {/* Orange blob — top-right, drifts slowly */}
      <div
        className="absolute -top-[350px] -right-[250px] w-[900px] h-[900px] rounded-full will-change-transform"
        style={{
          background:
            "radial-gradient(circle at 55% 45%, rgba(249,115,22,0.14) 0%, transparent 58%)",
          animation: "blob-drift-1 30s ease-in-out infinite",
        }}
      />

      {/* Violet blob — bottom-left */}
      <div
        className="absolute -bottom-[300px] -left-[200px] w-[800px] h-[800px] rounded-full will-change-transform"
        style={{
          background:
            "radial-gradient(circle at 45% 55%, rgba(124,58,237,0.09) 0%, transparent 60%)",
          animation: "blob-drift-2 38s ease-in-out infinite",
        }}
      />

      {/* Soft center glow (landing focal point) */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full will-change-transform"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(249,115,22,0.04) 0%, transparent 65%)",
          animation: "blob-drift-3 20s ease-in-out infinite",
        }}
      />

      {/* Dot grid — fades at edges */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage:
            "radial-gradient(ellipse 85% 85% at 50% 50%, black 20%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 85% 85% at 50% 50%, black 20%, transparent 100%)",
        }}
      />
    </div>
  );
}
