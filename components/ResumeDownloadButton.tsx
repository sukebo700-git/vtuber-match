"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

type Status = "idle" | "loading" | "preview" | "error";

export function ResumeDownloadButton({
  className,
  id,
  children = "履歴書を作る",
}: {
  className?: string;
  id?: string;
  children?: ReactNode;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [visible, setVisible] = useState(true);
  const [profile, setProfile] = useState<{ name?: string; public_path?: string }>({});

  useEffect(() => {
    const isCreator = Boolean(localStorage.getItem("vtuber-match-creator-email"));
    if (!isCreator) return;
    fetch("/api/profile-edits")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.profile?.resumePublicOptIn === false) setVisible(false);
        if (data?.profile) {
          setProfile({ name: data.profile.name, public_path: data.profile.public_path });
        }
      })
      .catch(() => undefined);
  }, []);

  if (!visible) return null;

  async function openPreview() {
    const isCreator = Boolean(localStorage.getItem("vtuber-match-creator-email"));
    if (!isCreator) {
      window.location.href = "/creator/apply";
      return;
    }
    setStatus("loading");
    try {
      const response = await fetch("/api/resume/generate");
      if (response.status === 403) {
        setErrorMessage("履歴書機能がオフになっています。プロフィール編集画面でオンにしてください。");
        setStatus("error");
        return;
      }
      if (response.status === 401) {
        clearCreatorSessionCache();
        window.location.href = "/creator/login";
        return;
      }
      if (!response.ok) {
        setErrorMessage("履歴書の生成に失敗しました。時間をおいて再度お試しください。");
        setStatus("error");
        return;
      }
      const blob = await response.blob();
      setImageUrl(URL.createObjectURL(blob));
      setStatus("preview");
    } catch {
      setErrorMessage("履歴書の生成に失敗しました。時間をおいて再度お試しください。");
      setStatus("error");
    }
  }

  function close() {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(null);
    setStatus("idle");
  }

  function saveImage() {
    if (!imageUrl) return;
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = "vtubermatch_resume.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function shareOnX() {
    // Xは画像を投稿画面へ自動添付する手段がないため、保存した画像は
    // 投稿画面で手動添付してもらう前提のテキスト+URLだけを事前入力する。
    saveImage();
    const name = profile.name || "VTuber";
    const text = `VTuber専用履歴書を作ってみました📝\n\n${name}です、よろしくお願いします🌱`;
    // public_path はVTuber名(日本語含む)をそのままURLパスに使っているため、
    // encodeURIせずに渡すとX側でURLとして正しく認識されず本文が壊れる。
    const url = encodeURI(profile.public_path
      ? `${window.location.origin}${profile.public_path}`
      : "https://www.vtubermatch.com/");
    const params = new URLSearchParams({ text, url, hashtags: "VtuberMatch" });
    window.open(`https://twitter.com/intent/tweet?${params.toString()}`, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <button type="button" id={id} className={className} onClick={openPreview} disabled={status === "loading"}>
        {status === "loading" ? "生成中..." : children}
      </button>

      {status === "preview" && imageUrl && (
        <div className="resume-preview-backdrop" onClick={close}>
          <div className="resume-preview-modal" onClick={(event) => event.stopPropagation()}>
            <img src={imageUrl} alt="履歴書プレビュー" className="resume-preview-image" />
            <p className="resume-preview-hint">
              入力内容を増やしたい場合は、プロフィール編集画面で追加してからもう一度お試しください。
            </p>
            <div className="resume-preview-actions">
              <a className="secondary-button" href="/creator/edit">
                プロフィール編集画面へ
              </a>
              <button type="button" className="secondary-button" onClick={saveImage}>
                保存する
              </button>
              <button type="button" className="primary-button" onClick={shareOnX}>
                保存してXでシェア
              </button>
            </div>
            <p className="resume-preview-hint">
              「保存してXでシェア」は画像のダウンロードと投稿画面を同時に開きます。Xの投稿画面では、保存した画像を手動で添付してください(仕様上、自動添付はできません)。
            </p>
            <button type="button" className="resume-preview-close" onClick={close} aria-label="閉じる">
              ×
            </button>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="resume-preview-backdrop" onClick={close}>
          <div className="resume-preview-modal" onClick={(event) => event.stopPropagation()}>
            <p>{errorMessage}</p>
            <div className="resume-preview-actions">
              <button type="button" className="primary-button" onClick={close}>
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function clearCreatorSessionCache() {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith("vtuber-match-creator") || key === "vtuber-match-session")
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // localStorage can be unavailable in private contexts.
  }
}
