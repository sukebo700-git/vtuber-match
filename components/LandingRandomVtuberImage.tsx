"use client";

import { useEffect, useState } from "react";

const landingImages = [
  "/promo/landing-random/vtubermatch-hero-1.png?v=20260708",
  "/promo/landing-random/vtubermatch-hero-2.png?v=20260708",
  "/promo/landing-random/vtubermatch-hero-3.png?v=20260708",
  "/promo/landing-random/vtubermatch-hero-4.png?v=20260709-1",
  "/promo/landing-random/vtubermatch-hero-5.png?v=20260708",
  "/promo/landing-random/vtubermatch-hero-6.png?v=20260708",
];

const landingNames = [
  "\u30df\u30e9\u30a4",
  "\u30ca\u30ca",
  "\u30ea\u30ea\u30a2",
  "\u30a2\u30aa\u30a4",
  "\u30b7\u30a2",
  "\u30eb\u30ca",
];

type LandingRandomVtuberImageProps = {
  fixedIndex?: number;
  randomize?: boolean;
  variant?: "card" | "hero";
};

export function LandingRandomVtuberImage({ fixedIndex = 0, randomize = false, variant = "card" }: LandingRandomVtuberImageProps) {
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
      <div className={`landing-oshi-frame landing-oshi-${variant} landing-oshi-gradient-${frameIndex}`}>
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
