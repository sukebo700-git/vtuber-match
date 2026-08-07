"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

type Status = "idle" | "loading" | "preview" | "error";

export function ResumeDownloadButton({
  className,
  children = "履歴書を作る",
}: {
  className?: string;
  children?: ReactNode;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const isCreator = Boolean(localStorage.getItem("vtuber-match-creator-email"));
    if (!isCreator) return;
    fetch("/api/profile-edits")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.profile?.resumePublicOptIn === false) setVisible(false);
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

  return (
    <>
      <button type="button" className={className} onClick={openPreview} disabled={status === "loading"}>
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
              <button type="button" className="primary-button" onClick={saveImage}>
                保存する
              </button>
            </div>
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
