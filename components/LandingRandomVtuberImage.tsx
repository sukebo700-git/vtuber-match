"use client";

import { useEffect, useState } from "react";

const landingImages = [
  "/promo/landing-random/vtubermatch-hero-1.png?v=20260809",
  "/promo/landing-random/vtubermatch-hero-2.png?v=20260809",
  "/promo/landing-random/vtubermatch-hero-3.png?v=20260809",
  "/promo/landing-random/vtubermatch-hero-4.png?v=20260809",
  "/promo/landing-random/vtubermatch-hero-5.png?v=20260809",
  "/promo/landing-random/vtubermatch-hero-6.png?v=20260809",
  "/promo/landing-random/vtubermatch-hero-7.png?v=20260809",
  "/promo/landing-random/vtubermatch-hero-8.png?v=20260809",
  "/promo/landing-random/vtubermatch-hero-9.png?v=20260809",
  "/promo/landing-random/vtubermatch-hero-10.png?v=20260809",
  "/promo/landing-random/vtubermatch-hero-11.png?v=20260809",
  "/promo/landing-random/vtubermatch-hero-12.png?v=20260809",
  "/promo/landing-random/vtubermatch-hero-13.png?v=20260809",
];

const landingNames = [
  "\u30ad\u30e9\u30e9",
  "\u30e6\u30ad",
  "\u30b9\u30df\u30ec",
  "\u30d2\u30b9\u30a4",
  "\u30ec\u30a4\u30e9",
  "\u30bd\u30e9",
  "\u30a8\u30e1\u30e9",
  "\u30a2\u30ab\u30cd",
  "\u30d2\u30ca\u30bf",
  "\u30df\u30f3\u30c8",
  "\u30b3\u30c8\u30cd",
  "\u30c4\u30ad",
  "\u30cf\u30af",
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
