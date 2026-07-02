"use client";

import { ExternalLink, Maximize2, X } from "lucide-react";
import { useState } from "react";

type DetailMediaGalleryProps = {
  images: string[];
  name: string;
  siteLabel: string;
  siteUrl: string;
};

export function DetailMediaGallery({ images, name, siteLabel, siteUrl }: DetailMediaGalleryProps) {
  const safeImages = images.length ? images.slice(0, 3) : ["/promo/landing-oshi.png"];
  const [activeImage, setActiveImage] = useState<string | null>(null);

  return (
    <div className="detail-media-stack">
      <button className="detail-media-panel detail-image-button" type="button" onClick={() => setActiveImage(safeImages[0])}>
        <img className="detail-profile-image" src={safeImages[0]} alt={`${name} プロフィール画像`} loading="lazy" decoding="async" />
        <span className="detail-image-zoom"><Maximize2 size={16} /> 拡大</span>
      </button>

      {safeImages.length > 1 && (
        <div className="detail-image-strip" aria-label="登録画像">
          {safeImages.map((image, index) => (
            <button type="button" onClick={() => setActiveImage(image)} key={`${image}-${index}`}>
              <img src={image} alt={`${name} 登録画像 ${index + 1}`} loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
      )}

      <a className="detail-site-link" href={siteUrl} target="_blank" rel="noreferrer">
        <span className="detail-site-icon"><ExternalLink size={30} /></span>
        <span className="detail-site-copy">
          <small>配信・動画サイトへ移動</small>
          <strong>{siteLabel}で配信を見る</strong>
        </span>
      </a>

      {activeImage && (
        <div className="detail-lightbox" role="dialog" aria-modal="true" aria-label="画像を拡大表示" onClick={() => setActiveImage(null)}>
          <button className="detail-lightbox-close" type="button" aria-label="閉じる" onClick={() => setActiveImage(null)}>
            <X size={24} />
          </button>
          <img src={activeImage} alt={`${name} 拡大画像`} loading="lazy" decoding="async" onClick={(event) => event.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
