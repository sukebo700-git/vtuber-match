"use client";

import { useEffect, useState } from "react";

const landingImages = [
  "/promo/landing-random/1.webp?v=20260701-alpha",
  "/promo/landing-random/2.webp?v=20260701-alpha",
  "/promo/landing-random/3.webp?v=20260701-alpha",
  "/promo/landing-random/4.webp?v=20260701-alpha",
  "/promo/landing-random/5.webp?v=20260701-alpha",
];

const landingNames = [
  "\u767d\u97f3\u30df\u30e9\u30a4",
  "\u6843\u661f\u30ad\u30e9\u30e9",
  "\u6708\u4e43\u30a2\u30ea\u30b9",
  "\u9ed2\u7fbd\u30eb\u30ab",
  "\u7fe0\u732b\u30a2\u30f3\u30ca",
];

type LandingRandomVtuberImageProps = {
  fixedIndex?: number;
  randomize?: boolean;
};

export function LandingRandomVtuberImage({ fixedIndex = 0, randomize = false }: LandingRandomVtuberImageProps) {
  const preferredIndex = clampImageIndex(fixedIndex);
  const [imageIndex, setImageIndex] = useState<number | null>(randomize ? null : preferredIndex);

  useEffect(() => {
    const nextIndex = randomize ? Math.floor(Math.random() * landingImages.length) : preferredIndex;
    const image = new window.Image();
    image.onload = () => setImageIndex(nextIndex);
    image.onerror = () => setImageIndex(nextIndex);
    image.src = landingImages[nextIndex];
  }, [preferredIndex, randomize]);

  const frameIndex = (imageIndex ?? 0) + 1;
  const characterName = imageIndex !== null ? landingNames[imageIndex] : "";

  return (
    <>
      <div className={`landing-oshi-frame landing-oshi-gradient-${frameIndex}`}>
        {imageIndex !== null && (
          <img
            className="landing-oshi-image"
            src={landingImages[imageIndex]}
            alt=""
          />
        )}
      </div>
      <h2 className="landing-character-name">{characterName || "\u00a0"}</h2>
    </>
  );
}

function clampImageIndex(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.floor(value), 0), landingImages.length - 1);
}
