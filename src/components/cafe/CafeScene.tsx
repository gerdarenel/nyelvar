import { useEffect, useRef } from "react";

export function CafeScene() {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const node = video.current;
    if (!node) return;
    node.muted = true;
    void node.play().catch(() => {});
  }, []);

  return (
    <div className="relative h-full overflow-hidden bg-[#2a2018]">
      <video
        ref={video}
        src="/cafe-loop.mp4"
        className="absolute inset-0 size-full object-cover"
        autoPlay
        loop
        muted
        playsInline
        aria-hidden="true"
      />
    </div>
  );
}
