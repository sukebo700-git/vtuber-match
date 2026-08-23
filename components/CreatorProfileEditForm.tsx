"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { CATEGORIES, REGIONS, TAGS } from "@/lib/constants";
import { diagnosisTypes } from "@/lib/diagnosis";
import { creatorVtypeStorageKey, type VtypeProfileFields } from "@/lib/diagnosisProfile";
import { isXCampaignActive } from "@/lib/campaign";
import { RESUME_LIMITS, type ResumeHistoryEntry } from "@/lib/resume/schema";
import { ResumeIconCropEditor, type ResumeIconCropValue } from "@/components/ResumeIconCropEditor";

type CreatorDraft = VtypeProfileFields & {
  name?: string;
  yomi?: string;
  youtube_url?: string;
  x_account?: string;
  description?: string;
  one_liner?: string;
  stream_time?: string;
  region?: string;
  image?: string;
  images?: string[];
  categories?: string[];
  tags?: string[];
  plan_type?: string;
  want_short_video?: boolean;
  x_campaign_entry?: boolean;
  debutDate?: string;
  birthday?: string;
  birthdayVisible?: boolean;
  activityRegion?: string;
  publicContact?: string;
  streamingPlatform?: string;
  personalityType?: string;
  fanName?: string;
  fanMark?: string;
  hashtags?: string[];
  activityHistory?: ResumeHistoryEntry[];
  achievements?: ResumeHistoryEntry[];
  equipment?: ResumeHistoryEntry[];
  messageToNewcomers?: string;
  resumePublicOptIn?: boolean;
  resumeIconZoom?: number;
  resumeIconPanX?: number;
  resumeIconPanY?: number;
};

const emptyHistoryEntry: ResumeHistoryEntry = { year: "", month: "", text: "" };
const defaultResumeIcon: ResumeIconCropValue = { zoom: 1, panX: 50, panY: 50 };

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
  const [region, setRegion] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>(makeImageSlots());
  const [sourceImages, setSourceImages] = useState<string[]>(makeImageSlots());
  const [imageEdits, setImageEdits] = useState<ImageEdit[]>(makeImageEdits());
  const [planType, setPlanType] = useState("free");
  const [wantShortVideo, setWantShortVideo] = useState(false);
  const [xCampaignEntry, setXCampaignEntry] = useState(false);
  const [showXCampaignOptIn, setShowXCampaignOptIn] = useState(true);
  const [vtypeProfile, setVtypeProfile] = useState<VtypeProfileFields | null>(null);
  const [status, setStatus] = useState("");
  const [loadError, setLoadError] = useState(false);
  const visibleImages = images.slice(0, planImageLimit(planType));
  // 読み込み中(/api/profile-edits の応答待ち)にユーザーが入力を始めた場合、
  // 遅れて届いたサーバー側の値で入力内容を上書きしてしまわないようにするガード。
  const hasEditedRef = useRef(false);

  // --- VTuber専用履歴書 ---
  const [debutDate, setDebutDate] = useState("");
  const [birthday, setBirthday] = useState("");
  const [birthdayVisible, setBirthdayVisible] = useState(false);
  const [activityRegion, setActivityRegion] = useState("");
  const [publicContact, setPublicContact] = useState("");
  const [streamingPlatform, setStreamingPlatform] = useState("");
  const [personalityType, setPersonalityType] = useState("");
  const [fanName, setFanName] = useState("");
  const [fanMark, setFanMark] = useState("");
  const [hashtagInput, setHashtagInput] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [activityHistory, setActivityHistory] = useState<ResumeHistoryEntry[]>([]);
  const [achievements, setAchievements] = useState<ResumeHistoryEntry[]>([]);
  const [equipment, setEquipment] = useState<ResumeHistoryEntry[]>([]);
  const [messageToNewcomers, setMessageToNewcomers] = useState("");
  const [resumePublicOptIn, setResumePublicOptIn] = useState(true);
  const [resumeIcon, setResumeIcon] = useState<ResumeIconCropValue>(defaultResumeIcon);

  useEffect(() => {
    if (!isXCampaignActive()) setShowXCampaignOptIn(false);
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
    setRegion(draft?.region || "");
    setImages(draftImages);
    setSourceImages(draftImages);
    setImageEdits(makeImageEdits());
    setCategories(Array.isArray(draft?.categories) ? draft.categories : []);
    setTags(Array.isArray(draft?.tags) ? draft.tags : []);
    setVtypeProfile(draft?.vtype_id ? draft : readStoredVtypeProfile());

    fetch("/api/profile-edits")
      .then((response) => {
        // セッション切れ(ログインから14日以上経過等)の場合、ここが401になる。
        // 以前はここで黙って処理を打ち切っていたため、ブラウザに残った古い
        // キャッシュ(アップグレード前のプラン等)がそのまま表示され続け、
        // プラン変更が反映されていないように見える不具合があった。
        if (response.status === 401) {
          setStatus("ログインの有効期限が切れています。お手数ですが、配信者ログインからもう一度ログインしてください。");
          return null;
        }
        if (!response.ok) {
          setLoadError(true);
          return null;
        }
        return response.json();
      })
      .then((data) => {
        if (hasEditedRef.current) return;
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
        setRegion(profile.region || "");
        setImages(nextImages);
        setSourceImages(nextImages);
        setImageEdits(makeImageEdits());
        setCategories(Array.isArray(profile.categories) ? profile.categories : []);
        setTags(Array.isArray(profile.tags) ? profile.tags : []);
        setVtypeProfile(profile.vtype_id ? profile : readStoredVtypeProfile());
        const nextPlan = profile.plan_type || localStorage.getItem("vtuber-match-creator-plan") || storedPlan;
        setPlanType(nextPlan);
        setWantShortVideo(Boolean(profile.want_short_video));
        setXCampaignEntry(Boolean(profile.x_campaign_entry));
        setDebutDate(profile.debutDate || "");
        setBirthday(profile.birthday || "");
        setBirthdayVisible(Boolean(profile.birthdayVisible));
        setActivityRegion(profile.activityRegion || "");
        setPublicContact(profile.publicContact || "");
        setStreamingPlatform(profile.streamingPlatform || "");
        setPersonalityType(profile.personalityType || "");
        setFanName(profile.fanName || "");
        setFanMark(profile.fanMark || "");
        setHashtags(Array.isArray(profile.hashtags) ? profile.hashtags : []);
        setActivityHistory(Array.isArray(profile.activityHistory) ? profile.activityHistory : []);
        setAchievements(Array.isArray(profile.achievements) ? profile.achievements : []);
        setEquipment(Array.isArray(profile.equipment) ? profile.equipment : []);
        setMessageToNewcomers(profile.messageToNewcomers || "");
        setResumePublicOptIn(profile.resumePublicOptIn !== false);
        setResumeIcon({
          zoom: profile.resumeIconZoom ?? 1,
          panX: profile.resumeIconPanX ?? 50,
          panY: profile.resumeIconPanY ?? 50,
        });
        localStorage.setItem("vtuber-match-creator-plan", nextPlan);
        localStorage.setItem(creatorDraftKey, JSON.stringify(profile));
      })
      .catch(() => setLoadError(true));
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
        region: String(form.get("region") || ""),
        image: thumbnails[0] || "",
        thumbnails,
        categories,
        tags,
        want_short_video: wantShortVideo,
        x_campaign_entry: xCampaignEntry,
        ...vtypePayload(vtypeProfile),
        debutDate,
        birthday,
        birthdayVisible,
        activityRegion,
        publicContact,
        streamingPlatform,
        personalityType,
        fanName,
        fanMark,
        hashtags,
        activityHistory,
        achievements,
        equipment,
        messageToNewcomers,
        resumePublicOptIn,
        resumeIconZoom: resumeIcon.zoom,
        resumeIconPanX: resumeIcon.panX,
        resumeIconPanY: resumeIcon.panY,
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
      region: String(form.get("region") || ""),
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

  function toggle(setList: (updater: (prev: string[]) => string[]) => void, value: string, max: number) {
    setList((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value].slice(0, max)));
  }

  function addHashtag() {
    const raw = hashtagInput.trim();
    if (!raw || hashtags.length >= RESUME_LIMITS.hashtagsMax) return;
    const normalized = raw.startsWith("#") ? raw : `#${raw}`;
    if (hashtags.includes(normalized)) {
      setHashtagInput("");
      return;
    }
    setHashtags([...hashtags, normalized]);
    setHashtagInput("");
  }

  function removeHashtag(tag: string) {
    setHashtags(hashtags.filter((item) => item !== tag));
  }

  function addHistoryRow(rows: ResumeHistoryEntry[], setRows: (value: ResumeHistoryEntry[]) => void) {
    if (rows.length >= RESUME_LIMITS.historyRowsMax) return;
    setRows([...rows, { ...emptyHistoryEntry }]);
  }

  function updateHistoryRow(
    rows: ResumeHistoryEntry[],
    setRows: (value: ResumeHistoryEntry[]) => void,
    index: number,
    patch: Partial<ResumeHistoryEntry>
  ) {
    setRows(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function removeHistoryRow(rows: ResumeHistoryEntry[], setRows: (value: ResumeHistoryEntry[]) => void, index: number) {
    setRows(rows.filter((_, rowIndex) => rowIndex !== index));
  }

  function renderHistoryRows(label: string, rows: ResumeHistoryEntry[], setRows: (value: ResumeHistoryEntry[]) => void) {
    return (
      <div className="field">
        <span className="field-label">{label} {rows.length}/{RESUME_LIMITS.historyRowsMax}</span>
        <div className="resume-history-rows">
          {rows.map((row, index) => (
            <div className="resume-history-row" key={index}>
              <input
                value={row.year}
                onChange={(event) => updateHistoryRow(rows, setRows, index, { year: event.target.value.slice(0, 10) })}
                placeholder="年"
                aria-label={`${label} ${index + 1}行目 年`}
              />
              <input
                value={row.month}
                onChange={(event) => updateHistoryRow(rows, setRows, index, { month: event.target.value.slice(0, 4) })}
                placeholder="月"
                aria-label={`${label} ${index + 1}行目 月`}
              />
              <input
                value={row.text}
                maxLength={RESUME_LIMITS.historyTextMax}
                onChange={(event) => updateHistoryRow(rows, setRows, index, { text: event.target.value.slice(0, RESUME_LIMITS.historyTextMax) })}
                placeholder="内容"
                aria-label={`${label} ${index + 1}行目 内容`}
              />
              <button type="button" className="mini-button" onClick={() => removeHistoryRow(rows, setRows, index)}>削除</button>
            </div>
          ))}
        </div>
        {rows.length < RESUME_LIMITS.historyRowsMax && (
          <button type="button" className="mini-button" onClick={() => addHistoryRow(rows, setRows)}>+ 行を追加</button>
        )}
      </div>
    );
  }

  return (
    <form className="form compact-form" onSubmit={submit} onChangeCapture={() => { hasEditedRef.current = true; }}>
      <section className="status-band soft">
        <h2>プロフィール修正</h2>
        <p>ログイン中の配信者アカウントで、掲載プロフィールを修正できます。</p>
      </section>

      {loadError && (
        <p className="notice-text notice-error">
          現在のプロフィールの読み込みに失敗しました。このまま更新すると、一部の項目が空欄で上書きされる可能性があります。お手数ですが、ページを再読み込みしてからもう一度お試しください。
        </p>
      )}

      <div className="field">
        <label htmlFor="edit_email">登録メールアドレス</label>
        <input id="edit_email" name="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        <p className="help-text">ログイン中の配信者確認に使います。パスワードの再入力は不要です。</p>
      </div>

      <div className="field">
        <label htmlFor="edit_youtube">動画・配信サイトURL</label>
        <input id="edit_youtube" name="youtube_url" type="url" required value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} placeholder="https://www.youtube.com/@channel または https://www.twitch.tv/channel" />
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
        <label htmlFor="edit_region">活動地域</label>
        <select id="edit_region" name="region" value={region} onChange={(event) => setRegion(event.target.value)}>
          <option value="">未設定</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>バーチャル{r}</option>
          ))}
        </select>
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

      <section className="status-band soft">
        <h2>VTuber専用履歴書</h2>
        <p>入力した内容は「履歴書を作る」から生成されるPNG画像に反映されます(全プラン無料でご利用いただけます)。</p>
      </section>

      <div className="field">
        <label className="choice consent-choice">
          <input
            type="checkbox"
            checked={resumePublicOptIn}
            onChange={(event) => setResumePublicOptIn(event.target.checked)}
          />
          履歴書機能を利用する
        </label>
        <p className="help-text">チェックを外すと履歴書は生成できなくなります(既定はON)。</p>
      </div>

      <div className="field">
        <span className="field-label">履歴書用アイコンの位置調整</span>
        <div className="resume-icon-editor-wrap">
          <ResumeIconCropEditor iconDataUri={images[0] || null} value={resumeIcon} onChange={setResumeIcon} />
        </div>
        {!images[0] && <p className="help-text">先にプロフィール画像を1枚以上登録してください。</p>}
      </div>

      <div className="field">
        <label htmlFor="resume_debut_date">デビュー日</label>
        <input id="resume_debut_date" value={debutDate} maxLength={40} onChange={(event) => setDebutDate(event.target.value.slice(0, 40))} placeholder="例: 2024年3月1日" />
      </div>

      <div className="field">
        <label htmlFor="resume_birthday">誕生日</label>
        <input id="resume_birthday" value={birthday} maxLength={40} onChange={(event) => setBirthday(event.target.value.slice(0, 40))} placeholder="例: 1月1日" />
        <label className="choice" style={{ marginTop: 6 }}>
          <input type="checkbox" checked={birthdayVisible} onChange={(event) => setBirthdayVisible(event.target.checked)} />
          履歴書に誕生日を表示する(オフの場合「非公開」と表示されます)
        </label>
      </div>

      <div className="field">
        <label htmlFor="resume_activity_region">活動地域(履歴書用)</label>
        <input id="resume_activity_region" value={activityRegion} maxLength={40} onChange={(event) => setActivityRegion(event.target.value.slice(0, 40))} />
      </div>

      <div className="field">
        <label htmlFor="resume_public_contact">公開用連絡先</label>
        <input id="resume_public_contact" value={publicContact} maxLength={120} onChange={(event) => setPublicContact(event.target.value.slice(0, 120))} placeholder="任意。ログイン用メールとは別に履歴書へ載せたい連絡先" />
      </div>

      <div className="field">
        <label htmlFor="resume_streaming_platform">配信場所</label>
        <input id="resume_streaming_platform" value={streamingPlatform} maxLength={40} onChange={(event) => setStreamingPlatform(event.target.value.slice(0, 40))} placeholder="例: 自宅スタジオ" />
      </div>

      <div className="field">
        <label htmlFor="resume_personality_type">性格タイプ</label>
        <input id="resume_personality_type" value={personalityType} maxLength={40} onChange={(event) => setPersonalityType(event.target.value.slice(0, 40))} />
      </div>

      <div className="field">
        <label htmlFor="resume_fan_name">ファンネーム</label>
        <input id="resume_fan_name" value={fanName} maxLength={40} onChange={(event) => setFanName(event.target.value.slice(0, 40))} />
      </div>

      <div className="field">
        <label htmlFor="resume_fan_mark">ファンマーク</label>
        <input id="resume_fan_mark" value={fanMark} maxLength={RESUME_LIMITS.fanMarkMax} onChange={(event) => setFanMark(event.target.value.slice(0, RESUME_LIMITS.fanMarkMax))} placeholder="絵文字や記号など(最大4文字)" />
      </div>

      <div className="field">
        <label htmlFor="resume_hashtags">ハッシュタグ {hashtags.length}/{RESUME_LIMITS.hashtagsMax}</label>
        <div className="resume-tag-input-row">
          <input
            id="resume_hashtags"
            value={hashtagInput}
            onChange={(event) => setHashtagInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addHashtag();
              }
            }}
            placeholder="例: vtuber"
            disabled={hashtags.length >= RESUME_LIMITS.hashtagsMax}
          />
          <button type="button" className="mini-button" onClick={addHashtag} disabled={hashtags.length >= RESUME_LIMITS.hashtagsMax}>追加</button>
        </div>
        {hashtags.length > 0 && (
          <div className="resume-tag-chips">
            {hashtags.map((tag) => (
              <span className="resume-tag-chip" key={tag}>
                {tag}
                <button type="button" onClick={() => removeHashtag(tag)} aria-label={`${tag}を削除`}>×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {renderHistoryRows("主な実績・コラボ歴", achievements, setAchievements)}
      {renderHistoryRows("活動歴・配信歴", activityHistory, setActivityHistory)}
      {renderHistoryRows("使用機材・配信環境", equipment, setEquipment)}

      <div className="field">
        <label htmlFor="resume_message_to_newcomers">初見さんへのひとこと / 今後の目標 / 希望する活動</label>
        <textarea
          id="resume_message_to_newcomers"
          value={messageToNewcomers}
          maxLength={RESUME_LIMITS.messageToNewcomersMax}
          onChange={(event) => setMessageToNewcomers(event.target.value.slice(0, RESUME_LIMITS.messageToNewcomersMax))}
        />
        <p className="help-text">{messageToNewcomers.length}/{RESUME_LIMITS.messageToNewcomersMax}</p>
      </div>

      <div className="field">
        <label>カテゴリ {categories.length}/3</label>
        <div className="choice-grid dense">
          {CATEGORIES.map((category) => (
            <label className="choice" key={category}>
              <input type="checkbox" checked={categories.includes(category)} onChange={() => toggle(setCategories, category, 3)} />
              {category}
            </label>
          ))}
        </div>
      </div>

      <div className="field">
        <label>タグ {tags.length}/{planTagLimit(planType)}</label>
        <div className="choice-grid dense">
          {TAGS.map((tag) => (
            <label className="choice" key={tag}>
              <input type="checkbox" checked={tags.includes(tag)} onChange={() => toggle(setTags, tag, planTagLimit(planType))} />
              {tag}
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

      {(showXCampaignOptIn || xCampaignEntry) && (
        <div className="field consent-field">
          <label className="choice consent-choice">
            <input
              type="checkbox"
              checked={xCampaignEntry}
              disabled={xCampaignEntry}
              onChange={(event) => setXCampaignEntry(event.target.checked)}
            />
            Xキャンペーンに応募する(@VtuberMatchをフォロー・対象投稿をリポスト済みの方)
          </label>
          <p className="help-text">
            {xCampaignEntry
              ? "応募済みです。抽選結果をお待ちください。"
              : "登録済みの方も、フォロー・リポスト後にチェックして保存すると応募できます。Xアカウント欄の入力もお願いします。"}
          </p>
        </div>
      )}

      <button className="primary-button" type="submit" disabled={loadError}>
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

// スワイプ画面のカード枠(.deck の aspect-ratio: 0.68)と同じ縦横比で書き出す。
// 編集画面のプレビューと出力画像の縦横比を揃えることで、編集画面で見たとおりに
// スワイプ画面へ反映される(以前は正方形で書き出していたため、縦長のカード枠で
// 余白ができていた)。
const CARD_ASPECT_RATIO = 0.68;

async function renderEditedImage(src: string, edit: ImageEdit) {
  const image = await loadImage(src);
  const outWidth = 620;
  const outHeight = Math.round(outWidth / CARD_ASPECT_RATIO);
  const canvas = document.createElement("canvas");
  canvas.width = outWidth;
  canvas.height = outHeight;
  const context = canvas.getContext("2d");
  if (!context) return src;

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, outWidth, outHeight);

  const baseScale = Math.min(outWidth / image.naturalWidth, outHeight / image.naturalHeight);
  const drawWidth = image.naturalWidth * baseScale * edit.scale;
  const drawHeight = image.naturalHeight * baseScale * edit.scale;
  const maxOffsetX = Math.max(0, (drawWidth - outWidth) / 2);
  const maxOffsetY = Math.max(0, (drawHeight - outHeight) / 2);
  const offsetX = maxOffsetX * (edit.x / 40);
  const offsetY = maxOffsetY * (edit.y / 40);

  context.drawImage(
    image,
    (outWidth - drawWidth) / 2 + offsetX,
    (outHeight - drawHeight) / 2 + offsetY,
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

function planTagLimit(plan: string) {
  if (plan === "free") return 3;
  if (plan === "boost") return 8;
  return 5;
}
