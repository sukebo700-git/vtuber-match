"use client";

import { HeartHandshake, RotateCcw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { CATEGORIES } from "@/lib/constants";
import { diagnosisTypes } from "@/lib/diagnosis";
import { viewerVtypeStorageKey, type VtypeProfileFields } from "@/lib/diagnosisProfile";
import type { ViewerProfile } from "@/lib/types";

const storageKey = "vtuber-match-viewer-profile";
const idKey = "vtuber-match-viewer-id";
const authKey = "vtuber-match-viewer-auth";
const oneLinerLimit = 20;

const emptyProfile: ViewerProfile = {
  id: "",
  email: "",
  viewer_login_id: "",
  viewer_plan: "free",
  display_name: "",
  youtube_display_name: "",
  twitter_id: "",
  one_liner: "",
  image: "",
  profile: "",
  favorite_categories: [],
  visible_to_matched_streamers: true,
  match_count: 0,
  streamer_like_count: 0,
};

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

export function ViewerProfileForm() {
  const [profile, setProfile] = useState<ViewerProfile>(emptyProfile);
  const [status, setStatus] = useState("");
  const [sourceImage, setSourceImage] = useState("");
  const [imageEdit, setImageEdit] = useState<ImageEdit>(defaultImageEdit);

  useEffect(() => {
    const id = localStorage.getItem(idKey) || crypto.randomUUID();
    localStorage.setItem(idKey, id);
    const auth = safeParse(localStorage.getItem(authKey));
    const saved = localStorage.getItem(storageKey);
    const stored = saved ? safeParseProfile(saved) : {};
    const storedVtype = readStoredVtypeProfile();
    const nextProfile = {
      ...emptyProfile,
      ...stored,
      ...(stored.vtype_id ? {} : storedVtype || {}),
      id,
      email: auth?.email || stored.email || "",
      viewer_login_id: auth?.viewer_login_id || stored.viewer_login_id || "",
      one_liner: (stored.one_liner || "").slice(0, oneLinerLimit),
    };
    setProfile(nextProfile);
    setSourceImage(nextProfile.image || "");

    fetch(`/api/viewer-profile?id=${encodeURIComponent(id)}`)
      .then((response) => response.json())
      .then((data) => {
        if (data.profile) {
          setProfile((current) => {
            const next = {
              ...current,
              ...data.profile,
              id,
              email: data.profile.email || current.email || "",
              viewer_login_id: data.profile.viewer_login_id || current.viewer_login_id || "",
              viewer_plan: "free" as const,
              one_liner: (data.profile.one_liner || current.one_liner || "").slice(0, oneLinerLimit),
              match_count: data.profile.match_count || 0,
              streamer_like_count: 0,
              is_admin_viewer: data.profile.is_admin_viewer === true,
            };
            localStorage.setItem(storageKey, JSON.stringify(next));
            setSourceImage(next.image || "");
            return next;
          });
        }
      })
      .catch(() => undefined);
  }, []);

  function update(patch: Partial<ViewerProfile>) {
    setProfile((current) => ({ ...current, ...patch }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const editedImage = sourceImage ? await renderEditedImage(sourceImage, imageEdit) : profile.image;
    const cleanProfile: ViewerProfile = {
      ...profile,
      viewer_plan: "free",
      subscription_status: "canceled",
      image: editedImage || profile.image,
      one_liner: (profile.one_liner || "").slice(0, oneLinerLimit),
      youtube_display_name: profile.youtube_display_name || "",
      twitter_id: profile.twitter_id || "",
      profile: profile.profile || "",
      favorite_categories: profile.favorite_categories || [],
      visible_to_matched_streamers: profile.visible_to_matched_streamers !== false,
      ...vtypePayload(profile),
    };

    localStorage.setItem(storageKey, JSON.stringify(cleanProfile));
    const auth = safeParse(localStorage.getItem(authKey)) || {};
    localStorage.setItem(
      authKey,
      JSON.stringify({
        ...auth,
        id: cleanProfile.id,
        email: cleanProfile.email,
        viewer_login_id: cleanProfile.viewer_login_id,
        name: cleanProfile.display_name || cleanProfile.email || "視聴者",
      }),
    );
    window.dispatchEvent(new Event("vtuber-match-auth-changed"));

    setStatus("保存中...");
    const response = await fetch("/api/viewer-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cleanProfile),
    });
    setProfile(cleanProfile);
    setSourceImage(cleanProfile.image || "");
    setImageEdit(defaultImageEdit);
    setStatus(response.ok ? "保存しました。" : "保存に失敗しました。時間をおいてもう一度お試しください。");
  }

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const image = await fileToDataUrl(file);
    if (!image) {
      setStatus("画像が大きすぎます。別の画像を選んでください。");
      return;
    }
    setImageEdit(defaultImageEdit);
    setSourceImage(image);
    update({ image });
    setStatus("画像を差し替えました。");
  }

  function toggleCategory(category: string) {
    const current = profile.favorite_categories || [];
    update({
      favorite_categories: current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category].slice(0, 5),
    });
  }

  const matchCount = profile.is_admin_viewer ? 0 : profile.match_count || 0;
  const previewImage = sourceImage || profile.image;

  return (
    <form className="form compact-form" onSubmit={submit}>
      {profile.payment_state === "past_due" && (
        <div className="status-band warning-band">
          <p>お支払いを確認できませんでした。カード情報をご確認ください。</p>
        </div>
      )}

      <div className="viewer-score-card">
        <HeartHandshake size={26} />
        <div>
          <span>マッチ数</span>
          <strong>{matchCount}</strong>
          <p>{fanAppeal(matchCount)}</p>
        </div>
      </div>

      <dl className="data-list">
        <div>
          <dt>視聴者ID</dt>
          <dd>{profile.id || "未発行"}</dd>
        </div>
        <div>
          <dt>メール</dt>
          <dd>{profile.email || "未登録"}</dd>
        </div>
        <div>
          <dt>プラン</dt>
          <dd>無料プラン</dd>
        </div>
      </dl>

      <div className="field">
        <label htmlFor="display_name">自身の名前</label>
        <input
          id="display_name"
          value={profile.display_name || ""}
          onChange={(event) => update({ display_name: event.target.value })}
          placeholder="未入力でも利用できます"
        />
      </div>

      <div className="field">
        <label htmlFor="viewer_image">アイコン画像</label>
        <input id="viewer_image" type="file" accept="image/*" onChange={onFile} />
        {!previewImage && <p className="help-text">選択されていません</p>}
        {previewImage && (
          <div className="image-editor">
            <div className="image-editor-preview" aria-label="プロフィール画像プレビュー">
              <img
                src={previewImage}
                alt="視聴者プロフィール画像"
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
                  onChange={(event) => setImageEdit((current) => ({ ...current, scale: Number(event.target.value) }))}
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
                  onChange={(event) => setImageEdit((current) => ({ ...current, x: Number(event.target.value) }))}
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
                  onChange={(event) => setImageEdit((current) => ({ ...current, y: Number(event.target.value) }))}
                />
              </label>
              <button className="mini-button" type="button" onClick={() => setImageEdit(defaultImageEdit)}>
                <RotateCcw size={15} />
                全体表示に戻す
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="field">
        <label htmlFor="youtube_display_name">YouTube表示名</label>
        <input
          id="youtube_display_name"
          value={profile.youtube_display_name || ""}
          onChange={(event) => update({ youtube_display_name: event.target.value })}
          placeholder="@name など"
        />
      </div>

      <div className="field">
        <label htmlFor="twitter_id">X / Twitter ID</label>
        <input
          id="twitter_id"
          value={profile.twitter_id || ""}
          onChange={(event) => update({ twitter_id: event.target.value })}
          placeholder="@vtubermatch など"
        />
      </div>

      <div className="field">
        <label htmlFor="viewer_one_liner">一言メッセージ {oneLinerLimit}文字まで</label>
        <input
          id="viewer_one_liner"
          value={profile.one_liner || ""}
          onChange={(event) => update({ one_liner: event.target.value.slice(0, oneLinerLimit) })}
          placeholder="例: 初見でも応援します"
          maxLength={oneLinerLimit}
        />
        <p className="help-text">{(profile.one_liner || "").length}/{oneLinerLimit}</p>
      </div>

      <div className="field">
        <label htmlFor="viewer_profile">プロフィール</label>
        <textarea
          id="viewer_profile"
          value={profile.profile || ""}
          onChange={(event) => update({ profile: event.target.value })}
          placeholder="好きな配信ジャンルや応援スタイルなど"
        />
      </div>

      <div className="field">
        <label htmlFor="viewer_vtype_id">リスナーVTYPE</label>
        <select
          id="viewer_vtype_id"
          value={profile.vtype_id ? String(profile.vtype_id) : ""}
          onChange={(event) => update(vtypeProfileFromId(event.target.value) || {
            vtype_id: undefined,
            vtype_code: "",
            vtype_name: "",
            vtype_scores: undefined,
            vtype_mode: "",
            vtype_result_id: "",
            vtype_updated_at: "",
          })}
        >
          <option value="">選択しない</option>
          {diagnosisTypes.map((type) => (
            <option value={type.id} key={type.id}>{type.code} {type.name}</option>
          ))}
        </select>
        <p className="help-text">診断済みの場合は自動で入ります。同じタイプのVTuberをおすすめ欄に表示します。</p>
      </div>

      <div className="field">
        <label>好きなカテゴリ {profile.favorite_categories?.length || 0}/5</label>
        <div className="choice-grid dense">
          {CATEGORIES.map((category) => (
            <label className="choice" key={category}>
              <input
                type="checkbox"
                checked={profile.favorite_categories?.includes(category) || false}
                onChange={() => toggleCategory(category)}
              />
              {category}
            </label>
          ))}
        </div>
      </div>

      <label className="choice">
        <input
          type="checkbox"
          checked={profile.visible_to_matched_streamers}
          onChange={(event) => update({ visible_to_matched_streamers: event.target.checked })}
        />
        いいねした配信者にプロフィールを表示する
      </label>
      <p className="help-text">メールアドレスは公開されません。</p>

      <button className="primary-button" type="submit">
        <Save size={18} />
        保存する
      </button>
      <p className="inline-actions viewer-profile-actions">
        <a className="primary-button" href="/swipe">VTuberを探す</a>
      </p>
      {status && <p className="help-text">{status}</p>}
    </form>
  );
}

function fanAppeal(matchCount: number) {
  if (matchCount >= 20) return "たくさんの配信者と出会っている、かなり積極的なファンです。";
  if (matchCount >= 5) return "気になる配信者をしっかり見つけているアクティブなファンです。";
  return "これから推しを見つけていくファンです。";
}

function readStoredVtypeProfile() {
  try {
    const raw = localStorage.getItem(viewerVtypeStorageKey);
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
    vtype_mode: "viewer",
    vtype_updated_at: new Date().toISOString(),
  };
}

function vtypePayload(profile: Partial<ViewerProfile>) {
  const type = diagnosisTypes.find((item) => item.id === Number(profile.vtype_id));
  if (!type) return {};
  return {
    vtype_id: type.id,
    vtype_code: type.code,
    vtype_name: type.name,
    vtype_scores: profile.vtype_scores,
    vtype_mode: profile.vtype_mode || "viewer",
    vtype_result_id: profile.vtype_result_id || "",
    vtype_updated_at: profile.vtype_updated_at || new Date().toISOString(),
  };
}

function safeParse(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value) as { email?: string; viewer_login_id?: string; name?: string; id?: string };
  } catch {
    return null;
  }
}

function safeParseProfile(value: string) {
  try {
    return JSON.parse(value) as Partial<ViewerProfile>;
  } catch {
    return {};
  }
}

async function fileToDataUrl(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  return compressImageDataUrl(dataUrl, 620, 120_000);
}

async function renderEditedImage(src: string, edit: ImageEdit) {
  const image = await loadImage(src);
  const size = 480;
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

  return compressCanvas(canvas, 120_000);
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
