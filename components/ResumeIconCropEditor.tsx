"use client";

import { useCallback, useRef, useState } from "react";
import { RESUME_LIMITS, clamp } from "@/lib/resume/schema";

/**
 * 履歴書専用アイコンのズーム/パン編集UI。
 *
 * 設計方針: react-easy-crop 等のライブラリは使わない。ライブラリは内部でピクセル座標の
 * 切り抜き結果を返す設計のものが多く、それを本機能の数値系に変換する層を挟むと、
 * 変換ミスでプレビューと本番出力(lib/resume/layout.tsx)がズレるリスクが生まれる。
 *
 * 重要: `transform: scale()` は satori(本番のPNG生成側)ではoverflow:hiddenのクリップが
 * 効かず画像が枠外にはみ出す不具合を確認したため(lib/resume/layout.tsx参照)、本番側は
 * transformを使わずimg自体のwidth/height+position(px)でズーム/パンを表現する方式にした。
 * このエディタのプレビューも同じ計算式にすることで、見た目=最終出力を保証する(WYSIWYG)。
 */

const FRAME_W = 130;
const FRAME_H = 160;

export interface ResumeIconCropValue {
  zoom: number; // RESUME_LIMITS.iconZoomMin 〜 iconZoomMax
  panX: number; // RESUME_LIMITS.iconPanMin 〜 iconPanMax (%)
  panY: number; // 同上
}

interface Props {
  iconDataUri: string | null; // 既存のアイコン画像(Base64 data URI)。未設定ならプレースホルダーを表示
  value: ResumeIconCropValue;
  onChange: (value: ResumeIconCropValue) => void;
}

export function ResumeIconCropEditor({ iconDataUri, value, onChange }: Props) {
  const dragState = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number } | null>(
    null
  );
  const [dragging, setDragging] = useState(false);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragState.current = {
        startX: e.clientX,
        startY: e.clientY,
        startPanX: value.panX,
        startPanY: value.panY,
      };
      setDragging(true);
    },
    [value.panX, value.panY]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragState.current) return;
      const dx = e.clientX - dragState.current.startX;
      const dy = e.clientY - dragState.current.startY;

      // ドラッグ量(px)をフレームサイズに対する%に変換する。
      // ドラッグで「画像を動かす」感覚に合わせるため符号を反転する
      // (右にドラッグ = 画像の見えている範囲は左にずれる = panXは減る)。
      const nextPanX = clamp(
        dragState.current.startPanX - (dx / FRAME_W) * 100,
        RESUME_LIMITS.iconPanMin,
        RESUME_LIMITS.iconPanMax
      );
      const nextPanY = clamp(
        dragState.current.startPanY - (dy / FRAME_H) * 100,
        RESUME_LIMITS.iconPanMin,
        RESUME_LIMITS.iconPanMax
      );

      onChange({ ...value, panX: nextPanX, panY: nextPanY });
    },
    [onChange, value]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    dragState.current = null;
    setDragging(false);
  }, []);

  const handleZoomChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const zoom = clamp(Number(e.target.value), RESUME_LIMITS.iconZoomMin, RESUME_LIMITS.iconZoomMax);
      onChange({ ...value, zoom });
    },
    [onChange, value]
  );

  const handleReset = useCallback(() => {
    onChange({ zoom: 1.0, panX: 50, panY: 50 });
  }, [onChange]);

  const zoomedWidth = FRAME_W * value.zoom;
  const zoomedHeight = FRAME_H * value.zoom;
  const offsetX = -(zoomedWidth - FRAME_W) * (value.panX / 100);
  const offsetY = -(zoomedHeight - FRAME_H) * (value.panY / 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          width: FRAME_W,
          height: FRAME_H,
          border: "1px solid #333",
          overflow: "hidden",
          position: "relative",
          cursor: dragging ? "grabbing" : "grab",
          touchAction: "none", // ドラッグ中にブラウザ標準のスクロールが割り込むのを防ぐ
          userSelect: "none",
        }}
      >
        {iconDataUri ? (
          // 本番の lib/resume/layout.tsx の IconBox と全く同じ計算式にすること。
          // ここを変えるとWYSIWYGが崩れる。
          <img
            src={iconDataUri}
            width={zoomedWidth}
            height={zoomedHeight}
            draggable={false}
            style={{
              position: "absolute",
              left: offsetX,
              top: offsetY,
              objectFit: "cover",
              pointerEvents: "none",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              color: "#888",
            }}
          >
            画像未設定
          </div>
        )}
      </div>

      <label style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 4 }}>
        ズーム
        <input
          type="range"
          min={RESUME_LIMITS.iconZoomMin}
          max={RESUME_LIMITS.iconZoomMax}
          step={0.05}
          value={value.zoom}
          onChange={handleZoomChange}
          disabled={!iconDataUri}
        />
      </label>

      <button type="button" onClick={handleReset} style={{ fontSize: 12, alignSelf: "flex-start" }}>
        位置・ズームをリセット
      </button>

      <p style={{ fontSize: 11, color: "#888", margin: 0 }}>
        画像をドラッグして位置を調整できます。この設定は履歴書にのみ反映され、他の画面のアイコン表示には影響しません。
      </p>
    </div>
  );
}
