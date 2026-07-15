"use client";

import { useEffect, useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { CATEGORIES, TAGS } from "@/lib/constants";
import { diagnosisTypes } from "@/lib/diagnosis";
import { creatorVtypeStorageKey, type VtypeProfileFields } from "@/lib/diagnosisProfile";

type CreatorDraft = VtypeProfileFields & {
  name?: string;
  yomi?: string;
  youtube_url?: string;
  x_account?: string;
  description?: string;
  one_liner?: string;
  stream_time?: string;
  image?: string;
  images?: string[];
  categories?: string[];
  tags?: string[];
  plan_type?: string;
  want_short_video?: boolean;
};

const creatorDraftKey = "vtuber-match-creator-profile-draft";
const imageSlotCount = 5;

type ImageEdit = {
  scale: number;
  x: number;
  y: number;
};

const defaultImageEdit: ImageEdit = {
  scale: 1,
  x: 0,
  y: 0,
};

function makeImageSlots(images: string[] = []) {
  return [...images.filter(Boolean).slice(0, imageSlotCount), ...Array(imageSlotCount).fill("")].slice(0, imageSlotCount);
}

function makeImageEdits() {
  return Array.from({ length: imageSlotCount }, () => ({ ...defaultImageEdit }));
}

export function CreatorProfileEditForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [xAccount, setXAccount] = useState("");
  const [description, setDescription] = useState("");
  const [yomi, setYomi] = useState("");
  const [oneLiner, setOneLiner] = useState("");
  const [streamTime, setStreamTime] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>(makeImageSlots());
  const [sourceImages, setSourceImages] = useState<string[]>(makeImageSlots());
  const [imageEdits, setImageEdits] = useState<ImageEdit[]>(makeImageEdits());
  const [planType, setPlanType] = useState("free");
  const [wantShortVideo, setWantShortVideo] = useState(false);
  const [vtypeProfile, setVtypeProfile] = useState<VtypeProfileFields | null>(null);
  const [status, setStatus] = useState("");
  const visibleImages = images.slice(0, planImageLimit(planType));

  useEffect(() => {
    const draft = safeParseDraft(localStorage.getItem(creatorDraftKey));
    const draftImages = makeImageSlots(draft?.images?.length ? draft.images : draft?.image ? [draft.image] : []);
    const storedPlan = localStorage.getItem("vtuber-match-creator-plan") || "free";
    setPlanType(storedPlan);
    setEmail(localStorage.getItem("vtuber-match-creator-email") || "");
    setName(draft?.name || localStorage.getItem("vtuber-match-creator-name") || "");
    setYoutubeUrl(draft?.youtube_url || localStorage.getItem("vtuber-match-creator-youtube-url") || "");
    setXAccount(draft?.x_account || localStorage.getItem("vtuber-match-creator-x-account") || "");
    setDescription(draft?.description || "");
    setYomi(draft?.yomi || "");
    setOneLiner(draft?.one_liner || "");
    setStreamTime(draft?.stream_time || "");
    setImages(draftImages);
    setSourceImages(draftImages);
    setImageEdits(makeImageEdits());
    setCategories(Array.isArray(draft?.categories) ? draft.categories : []);
    setTags(Array.isArray(draft?.tags) ? draft.tags : []);
    setVtypeProfile(draft?.vtype_id ? draft : readStoredVtypeProfile());

    fetch("/api/profile-edits")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        const profile = data?.profile as CreatorDraft | undefined;
        if (!profile) return;
        const nextImages = makeImageSlots(profile.images?.length ? profile.images : profile.image ? [profile.image] : []);
        setName(profile.name || localStorage.getItem("vtuber-match-creator-name") || "");
        setYoutubeUrl(profile.youtube_url || localStorage.getItem("vtuber-match-creator-youtube-url") || "");
        setXAccount(profile.x_account || localStorage.getItem("vtuber-match-creator-x-account") || "");
        setDescription(profile.description || "");
        setYomi(profile.yomi || "");
        setOneLiner((profile.one_liner || "").slice(0, 20));
        setStreamTime(profile.stream_time || "");
        setImages(nextImages);
        setSourceImages(nextImages);
        setImageEdits(makeImageEdits());
        setCategories(Array.isArray(profile.categories) ? profile.categories : []);
        setTags(Array.isArray(profile.tags) ? profile.tags : []);
        setVtypeProfile(profile.vtype_id ? profile : readStoredVtypeProfile());
        const nextPlan = profile.plan_type || localStorage.getItem("vtuber-match-creator-plan") || storedPlan;
        setPlanType(nextPlan);
        setWantShortVideo(Boolean(profile.want_short_video));
        localStorage.setItem("vtuber-match-creator-plan", nextPlan);
        localStorage.setItem(creatorDraftKey, JSON.stringify(profile));
      })
      .catch(() => undefined);
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const editedImages = await Promise.all(
      images.map((image, index) => sourceImages[index] ? renderEditedImage(sourceImages[index], imageEdits[index]) : Promise.resolve(image)),
    );
    const allowedImageCount = planImageLimit(planType);
    const thumbnails = editedImages.filter(Boolean).slice(0, allowedImageCount);
    setStatus("プロフィールを更新しています...");

    const response = await fetch("/api/profile-edits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        application_id: localStorage.getItem("vtuber-match-creator-application-id") || "",
        streamer_id: localStorage.getItem("vtuber-match-creator-streamer-id") || "",
        creator_login_id: localStorage.getItem("vtuber-match-creator-login-id") || "",
        youtube_url: form.get("youtube_url"),
        x_account: form.get("x_account"),
        name: form.get("name"),
        yomi,
        description: form.get("description"),
        one_liner: form.get("one_liner"),
        stream_time: String(form.get("stream_time") || "").slice(0, 50),
        image: thumbnails[0] || "",
        thumbnails,
        categories,
        tags,
        want_short_video: wantShortVideo,
        ...vtypePayload(vtypeProfile),
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(data.error || "更新に失敗しました。ログイン状態を確認してください。");
      return;
    }

    const nextDraft = {
      name: String(form.get("name") || ""),
      youtube_url: String(form.get("youtube_url") || ""),
      x_account: String(form.get("x_account") || ""),
      description: String(form.get("description") || "").slice(0, planType === "free" ? 100 : 500),
      one_liner: String(form.get("one_liner") || ""),
      stream_time: String(form.get("stream_time") || "").slice(0, 50),
      image: thumbnails[0] || "",
      images: thumbnails,
      categories,
      tags,
      ...vtypePayload(vtypeProfile),
    };

    localStorage.setItem("vtuber-match-creator-name", nextDraft.name);
    localStorage.setItem("vtuber-match-creator-youtube-url", nextDraft.youtube_url);
    localStorage.setItem("vtuber-match-creator-x-account", nextDraft.x_account);
    localStorage.setItem(creatorDraftKey, JSON.stringify(nextDraft));
    const nextImages = makeImageSlots(nextDraft.images);
    setImages(nextImages);
    setSourceImages(nextImages);
    setImageEdits(makeImageEdits());
    window.dispatchEvent(new Event("vtuber-match-auth-changed"));
    setStatus("プロフィールを更新しました。");
  }

  async function onFile(index: number, event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const nextImage = await fileToDataUrl(file);
    if (!nextImage) {
      setStatus("画像が大きすぎます。別の画像を選んでください。");
      return;
    }
    setImageEdits((current) => current.map((edit, editIndex) => (editIndex === index ? { ...defaultImageEdit } : edit)));
    setImages((current) => current.map((image, imageIndex) => (imageIndex === index ? nextImage : image)));
    setSourceImages((current) => current.map((image, imageIndex) => (imageIndex === index ? nextImage : image)));
    event.target.value = "";
    setStatus("画像を差し替えました。初期表示は全体が見える状態です。");
  }

  function removeImage(index: number) {
    setImages((current) => current.map((image, imageIndex) => (imageIndex === index ? "" : image)));
    setSourceImages((current) => current.map((image, imageIndex) => (imageIndex === index ? "" : image)));
    setImageEdits((current) => current.map((edit, editIndex) => (editIndex === index ? { ...defaultImageEdit } : edit)));
  }

  function updateImageEdit(index: number, patch: Partial<ImageEdit>) {
    setImageEdits((current) => current.map((edit, editIndex) => (editIndex === index ? { ...edit, ...patch } : edit)));
  }

  function toggle(list: string[], setList: (value: string[]) => void, value: string, max: number) {
    setList(list.includes(value) ? list.filter((item) => item !== value) : [...list, value].slice(0, max));
  }

  return (
    <form className="form compact-form" onSubmit={submit}>
      <section className="status-band soft">
        <h2>プロフィール修正</h2>
        <p>ログイン中の配信者アカウントで、掲載プロフィールを修正できます。</p>
      </section>

      <div className="field">
        <label htmlFor="edit_email">登録メールアドレス</label>
        <input id="edit_email" name="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        <p className="help-text">ログイン中の配信者確認に使います。パスワードの再入力は不要です。</p>
      </div>

      <div className="field">
        <label htmlFor="edit_youtube">動画・配信サイトURL</label>
        <input id="edit_youtube" name="youtube_url" type="url" value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} placeholder="https://www.youtube.com/@channel または https://www.twitch.tv/channel" />
      </div>

      <div className="field">
        <label htmlFor="edit_x_account">Xアカウント</label>
        <input id="edit_x_account" name="x_account" value={xAccount} onChange={(event) => setXAccount(event.target.value)} placeholder="@vtubermatch" />
      </div>

      <div className="field">
        <label htmlFor="edit_name">配信者名</label>
        <input id="edit_name" name="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="変更する場合のみ入力" />
      </div>
      <div className="field">
        <label htmlFor="edit_yomi">名前のよみがな</label>
        <input id="edit_yomi" name="yomi" value={yomi} maxLength={80} onChange={(event) => setYomi(event.target.value)} placeholder="例: ぶいちゅーばー はなこ" />
        <p className="help-text">紹介動画のナレーションでお名前を正しく読み上げるために使います。</p>
      </div>

      <div className="field">
        <label htmlFor="edit_one_liner">今日のひとこと</label>
        <input id="edit_one_liner" name="one_liner" value={oneLiner} onChange={(event) => setOneLiner(event.target.value)} maxLength={20} />
      </div>

      <div className="field">
        <label htmlFor="edit_description">自己アピール</label>
        <textarea id="edit_description" name="description" value={description} maxLength={planType === "free" ? 100 : 500} onChange={(event) => setDescription(event.target.value.slice(0, planType === "free" ? 100 : 500))} />
        <p className="help-text">{planType === "free" ? `${description.length}/100` : "プロフィール画面に掲載されます。紹介動画のナレーション原稿にも使われます(150文字で約1分、500文字で約2〜3分が目安。段落分けにより前後します)。誤字にご注意ください。"}</p>
      </div>

      <div className="field">
        <label htmlFor="edit_stream_time">配信時間帯</label>
        <input id="edit_stream_time" name="stream_time" value={streamTime} maxLength={50} onChange={(event) => setStreamTime(event.target.value.slice(0, 50))} placeholder="例: 平日22時から24時" />
      </div>

      <div className="field">
        <label htmlFor="edit_vtype_id">VTYPE診断タイプ</label>
        <select
          id="edit_vtype_id"
          value={vtypeProfile?.vtype_id ? String(vtypeProfile.vtype_id) : ""}
          onChange={(event) => setVtypeProfile(vtypeProfileFromId(event.target.value))}
        >
          <option value="">選択しない</option>
          {diagnosisTypes.map((type) => (
            <option value={type.id} key={type.id}>{type.code} {type.name}</option>
          ))}
        </select>
        <p className="help-text">診断済みの場合は自動で入ります。近いタイプの視聴者におすすめされやすくなります。</p>
      </div>

      <div className="field">
        <span className="field-label">プロフィール画像（{planType === "free" ? "無料プランは1枚" : planType === "paid" ? "最大3枚" : "最大5枚"}）</span>
        {planType === "free" && images.filter(Boolean).length > 1 && (
          <p className="help-text">既に登録済みの複数画像は保持されます。無料プランでは新しく編集できる画像は1枚目です。</p>
        )}
        <div className="image-editor-list">
          {visibleImages.map((image, index) => {
            const sourceImage = sourceImages[index] || image;
            const imageEdit = imageEdits[index] || defaultImageEdit;
            return (
              <div className="image-editor" key={index}>
                <div className="image-editor-header">
                  <strong>{index + 1}枚目</strong>
                  <label className="mini-button" htmlFor={`edit_image_${index}`}>
                    {image ? "画像を変更" : "画像を選択"}
                  </label>
                  <input id={`edit_image_${index}`} type="file" accept="image/*" onChange={(event) => onFile(index, event)} />
                  {image && <button className="mini-button" type="button" onClick={() => removeImage(index)}>削除</button>}
                </div>
                {sourceImage ? (
                  <>
                    <div className="image-editor-preview" aria-label={`プロフィール画像${index + 1}のプレビュー`}>
                      <img
                        src={sourceImage}
                        alt={`配信者プロフィール画像${index + 1}`}
                        style={{
                          transform: `translate(${imageEdit.x}%, ${imageEdit.y}%) scale(${imageEdit.scale})`,
                        }}
                      />
                    </div>
                    <div className="image-editor-controls">
                      <label>
                        縮尺
                        <input
                          type="range"
                          min="1"
                          max="2.5"
                          step="0.05"
                          value={imageEdit.scale}
                          onChange={(event) => updateImageEdit(index, { scale: Number(event.target.value) })}
                        />
                      </label>
                      <label>
                        横位置
                        <input
                          type="range"
                          min="-40"
                          max="40"
                          step="1"
                          value={imageEdit.x}
                          onChange={(event) => updateImageEdit(index, { x: Number(event.target.value) })}
                        />
                      </label>
                      <label>
                        縦位置
                        <input
                          type="range"
                          min="-40"
                          max="40"
                          step="1"
                          value={imageEdit.y}
                          onChange={(event) => updateImageEdit(index, { y: Number(event.target.value) })}
                        />
                      </label>
                      <button className="mini-button" type="button" onClick={() => updateImageEdit(index, defaultImageEdit)}>
                        <RotateCcw size={15} />
                        全体表示に戻す
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="image-slot-empty">1枠につき1枚登録できます。</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="field">
        <label>カテゴリ {categories.length}/3</label>
        <div className="choice-grid dense">
          {CATEGORIES.map((category) => (
            <label className="choice" key={category}>
              <input type="checkbox" checked={categories.includes(category)} onChange={() => toggle(categories, setCategories, category, 3)} />
              {category}
            </label>
          ))}
        </div>
      </div>

      <div className="field consent-field">
        <label className="choice consent-choice">
          <input
            type="checkbox"
            checked={wantShortVideo}
            disabled={wantShortVideo}
            onChange={(event) => setWantShortVideo(event.target.checked)}
          />
          紹介動画(Lo-Fi配信への掲載・紹介ショート動画)の作成・公開に同意し、作成を希望します
        </label>
        <p className="help-text">
          {wantShortVideo
            ? "作成依頼は運営に届いています。順次対応します。"
            : "チェックして更新すると、紹介動画の作成依頼が運営に届きます(プラン問わず任意)。チェックがない場合、動画は作成されません。"}
        </p>
      </div>

      <div className="field">
        <label>タグ {tags.length}/3</label>
        <div className="choice-grid dense">
          {TAGS.map((tag) => (
            <label className="choice" key={tag}>
              <input type="checkbox" checked={tags.includes(tag)} onChange={() => toggle(tags, setTags, tag, 3)} />
              {tag}
            </label>
          ))}
        </div>
      </div>

      <button className="primary-button" type="submit">
        <Save size={18} />
        プロフィールを更新する
      </button>
      <div className="profile-edit-after-actions">
        <a className="primary-button" href="/creator">配信者用ページへ</a>
      </div>
      {status && <p className="notice-text">{status}</p>}
    </form>
  );
}

function safeParseDraft(value: string | null): CreatorDraft | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as CreatorDraft;
  } catch {
    return null;
  }
}

function readStoredVtypeProfile() {
  try {
    const raw = localStorage.getItem(creatorVtypeStorageKey);
    return raw ? (JSON.parse(raw) as VtypeProfileFields) : null;
  } catch {
    return null;
  }
}

function vtypeProfileFromId(value: string): VtypeProfileFields | null {
  const type = diagnosisTypes.find((item) => item.id === Number(value));
  if (!type) return null;
  return {
    vtype_id: type.id,
    vtype_code: type.code,
    vtype_name: type.name,
    vtype_mode: "light",
    vtype_updated_at: new Date().toISOString(),
  };
}

function vtypePayload(profile: VtypeProfileFields | null) {
  const type = diagnosisTypes.find((item) => item.id === Number(profile?.vtype_id));
  if (!type) return {};
  return {
    ...profile,
    vtype_id: type.id,
    vtype_code: type.code,
    vtype_name: type.name,
    vtype_mode: profile?.vtype_mode || "light",
    vtype_updated_at: profile?.vtype_updated_at || new Date().toISOString(),
  };
}

async function fileToDataUrl(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  return compressImageDataUrl(dataUrl, 760, 170_000);
}

async function renderEditedImage(src: string, edit: ImageEdit) {
  const image = await loadImage(src);
  const size = 620;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return src;

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, size, size);

  const baseScale = Math.min(size / image.naturalWidth, size / image.naturalHeight);
  const drawWidth = image.naturalWidth * baseScale * edit.scale;
  const drawHeight = image.naturalHeight * baseScale * edit.scale;
  const maxOffsetX = Math.max(0, (drawWidth - size) / 2);
  const maxOffsetY = Math.max(0, (drawHeight - size) / 2);
  const offsetX = maxOffsetX * (edit.x / 40);
  const offsetY = maxOffsetY * (edit.y / 40);

  context.drawImage(
    image,
    (size - drawWidth) / 2 + offsetX,
    (size - drawHeight) / 2 + offsetY,
    drawWidth,
    drawHeight,
  );

  return compressCanvas(canvas, 170_000);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image load failed"));
    image.src = src;
  });
}

async function compressImageDataUrl(src: string, maxSide: number, targetLength: number) {
  const image = await loadImage(src);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return "";

  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return compressCanvas(canvas, targetLength);
}

function compressCanvas(canvas: HTMLCanvasElement, targetLength: number) {
  let best = "";
  for (const quality of [0.78, 0.68, 0.58, 0.48, 0.38, 0.3, 0.24]) {
    const encoded = canvas.toDataURL("image/jpeg", quality);
    if (!best || encoded.length < best.length) best = encoded;
    if (encoded.length <= targetLength) return encoded;
  }
  return best;
}

function planImageLimit(plan: string) {
  if (plan === "free") return 1;
  if (plan === "boost") return 5;
  return 3;
}
