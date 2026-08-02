"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  advancedQuestions,
  createInitialAnswers,
  decideDiagnosisTypeFromAnswers,
  deviationScores,
  diagnosisAxes,
  diagnosisTypes,
  getAxisBandText,
  getAxisComment,
  getDiagnosisTypeMatches,
  getViewerMatchType,
  lightQuestions,
  scoreDiagnosis,
  topAxisLabels,
  viewerQuestions,
  type DiagnosisAxis,
  type DiagnosisScores,
  type DiagnosisType,
  type DiagnosisTypeMatch,
} from "@/lib/diagnosis";
import {
  buildVtypeProfileFields,
  creatorVtypeStorageKey,
  viewerVtypeStorageKey,
  type VtypeProfileFields,
} from "@/lib/diagnosisProfile";

type DiagnosisMode = "light" | "advanced" | "viewer";

type DiagnosisAppProps = {
  mode: DiagnosisMode;
  previewTypeId?: number;
};

type SaveState = "idle" | "saving" | "saved" | "offline";
type ImageSaveState = "idle" | "saving" | "saved" | "failed";
type ProfileSaveTarget = "creator" | "viewer" | false;

export default function DiagnosisApp({ mode, previewTypeId }: DiagnosisAppProps) {
  const questions = mode === "advanced" ? advancedQuestions : mode === "viewer" ? viewerQuestions : lightQuestions;
  const pages = Math.ceil(questions.length / 5);
  const modeMeta = getModeMeta(mode);
  const previewType = useMemo(
    () => diagnosisTypes.find((type) => type.id === previewTypeId) || null,
    [previewTypeId]
  );
  const previewScores = useMemo(() => (previewType ? previewType.centroid : null), [previewType]);
  const [vtuberName, setVtuberName] = useState("");
  const [showSharedPreview, setShowSharedPreview] = useState(Boolean(previewType));
  const [started, setStarted] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [answers, setAnswers] = useState(() => createInitialAnswers(questions));
  const [result, setResult] = useState<{
    type: DiagnosisType;
    scores: DiagnosisScores;
    resultId: string | null;
    matches: DiagnosisTypeMatch[];
  } | null>(null);
  const [nameError, setNameError] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [profileSaveTarget, setProfileSaveTarget] = useState<ProfileSaveTarget>(false);
  const [typeImageState, setTypeImageState] = useState<ImageSaveState>("idle");
  const [radarImageState, setRadarImageState] = useState<ImageSaveState>("idle");
  const currentQuestions = useMemo(() => {
    const start = pageIndex * 5;
    return questions.slice(start, start + 5);
  }, [pageIndex, questions]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedName = window.localStorage.getItem("vtuber-match-diagnosis-name");
    if (storedName) setVtuberName(storedName);
  }, []);

  useEffect(() => {
    setAnswers(createInitialAnswers(questions));
    setPageIndex(0);
    setStarted(false);
    setResult(null);
    setSaveState("idle");
    setProfileSaveTarget(false);
  }, [questions]);

  useEffect(() => {
    if (previewType) setShowSharedPreview(true);
  }, [previewType]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!started && !result && !showSharedPreview) return;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "auto" });
    });
  }, [started, pageIndex, result, showSharedPreview]);

  function startDiagnosis() {
    const trimmed = vtuberName.trim();
    if (!trimmed && mode !== "viewer") {
      setNameError("VTuber名を入力してください");
      return;
    }
    if (trimmed.length > 50) {
      setNameError(mode === "viewer" ? "ニックネームは50文字以内で入力してください" : "VTuber名は50文字以内で入力してください");
      return;
    }
    const displayName = trimmed || "ゲスト";
    setNameError("");
    setVtuberName(displayName);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("vtuber-match-diagnosis-name", displayName);
    }
    setStarted(true);
  }

  async function finishDiagnosis() {
    const scores = scoreDiagnosis(answers, questions);
    const matches = getDiagnosisTypeMatches(answers, questions);
    const type = matches[0]?.type || decideDiagnosisTypeFromAnswers(answers, questions);
    setResult({ type, scores, resultId: null, matches });
    setSaveState("saving");

    try {
      const storedResultId =
        typeof window !== "undefined" ? window.localStorage.getItem("vtuber-match-diagnosis-result-id") : null;
      const response = await fetch("/api/diagnosis/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vtuberName,
          mode,
          resultId: mode === "advanced" ? storedResultId : undefined,
          lightType: type.name,
          lightTypeId: type.id,
          lightTypeCode: type.code,
          lightScores: scores,
          advancedScores: mode === "advanced" ? scores : undefined,
          answers,
        }),
      });
      const data = (await response.json()) as { resultId?: string | null; saved?: boolean };
      const resultId = data.resultId || null;
      if (data.resultId && typeof window !== "undefined") {
        window.localStorage.setItem("vtuber-match-diagnosis-result-id", data.resultId);
      }
      rememberDiagnosisProfile(mode, type, scores, resultId);
      setResult({ type, scores, resultId, matches });
      setSaveState(data.saved === false ? "offline" : "saved");
      setProfileSaveTarget(isProfileSaveTarget((data as { profileSaved?: unknown }).profileSaved) ? (data as { profileSaved: ProfileSaveTarget }).profileSaved : false);
    } catch {
      rememberDiagnosisProfile(mode, type, scores, null);
      setSaveState("offline");
      setProfileSaveTarget(false);
    }
  }

  function nextPage() {
    const hasUnanswered = currentQuestions.some((question) => !answers[question.id]);
    if (hasUnanswered) {
      setNameError("表示中の質問をすべて選択してください");
      return;
    }
    setNameError("");
    if (pageIndex + 1 >= pages) {
      void finishDiagnosis();
      return;
    }
    setPageIndex((current) => current + 1);
  }

  function previousPage() {
    setNameError("");
    setPageIndex((current) => Math.max(0, current - 1));
  }

  function updateAnswer(questionId: string, value: number) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  }

  function startFromSharedPreview() {
    setShowSharedPreview(false);
    setStarted(false);
    setResult(null);
  }

  function openSharePost() {
    if (!result) return;
    window.open(createShareUrl(result.type, mode), "_blank", "noopener,noreferrer");
  }

  async function saveTypeImage() {
    if (!result) return;
    setTypeImageState("saving");
    try {
      const response = await fetch(`/diagnosis/types/${result.type.id}.webp`);
      const blob = await response.blob();
      downloadBlob(blob, `vtype-${result.type.id}.webp`);
      setTypeImageState("saved");
    } catch {
      setTypeImageState("failed");
    }
  }

  async function saveRadarImage() {
    if (!result) return;
    setRadarImageState("saving");
    try {
      const blob = await createRadarImageBlob(result.type, result.scores, mode);
      downloadBlob(blob, `vtype-radar-${result.type.id}.png`);
      setRadarImageState("saved");
    } catch {
      setRadarImageState("failed");
    }
  }

  if (result) {
    return (
      <DiagnosisShell>
        <section className="diagnosis-result">
          <p className="diagnosis-kicker">{modeMeta.resultLabel}</p>
          <p className="diagnosis-type-code">{result.type.code}</p>
          <h1>
            {mode === "viewer"
              ? `相性のいいVTuberタイプは【${result.type.name}】です`
              : `${vtuberName}さんは【${result.type.name}】です`}
          </h1>
          <p className="diagnosis-catch">{result.type.catchCopy}</p>
          <DiagnosisMatchSummary matches={result.matches} />

          <div className="diagnosis-share-assets">
            <div className="diagnosis-share-asset">
              <img
                className="diagnosis-type-image"
                src={`/diagnosis/types/${result.type.id}.webp`}
                alt={`${result.type.name}の結果画像`}
                loading="eager"
                decoding="async"
              />
              <button className="diagnosis-secondary-button" type="button" onClick={saveTypeImage} disabled={typeImageState === "saving"}>
                {typeImageState === "saving" ? "タイプ画像を保存中..." : "タイプ画像を保存"}
              </button>
              {typeImageState === "saved" ? <span className="diagnosis-save-note">タイプ画像を保存しました</span> : null}
              {typeImageState === "failed" ? <span className="diagnosis-save-note">タイプ画像の保存に失敗しました</span> : null}
            </div>
            <div className="diagnosis-share-asset">
              <RadarChart scores={result.scores} mode={mode === "viewer" ? "viewer" : "vtuber"} />
              <button className="diagnosis-secondary-button" type="button" onClick={saveRadarImage} disabled={radarImageState === "saving"}>
                {radarImageState === "saving" ? "レーダーチャートを保存中..." : "レーダーチャートを保存"}
              </button>
              {radarImageState === "saved" ? <span className="diagnosis-save-note">レーダーチャートを保存しました</span> : null}
              {radarImageState === "failed" ? <span className="diagnosis-save-note">レーダーチャートの保存に失敗しました</span> : null}
            </div>
          </div>

          <div className="diagnosis-result-grid">
            <ScoreList scores={result.scores} />
          </div>
          <RadarScoreInsights scores={result.scores} mode={mode === "viewer" ? "viewer" : "vtuber"} />

          {mode === "viewer" ? <ListenerDeepDive type={result.type} /> : <StreamerDeepDive type={result.type} />}
          {mode === "viewer" ? <ViewerResultGuide type={result.type} /> : <ViewerMatchCard scores={result.scores} type={result.type} />}
          {mode !== "viewer" ? <CreatorDiagnosisRegisterCta /> : null}
          {mode === "advanced" ? <AdvancedDetails scores={result.scores} /> : null}
          <DiagnosisNotice />
          <div className="diagnosis-result-main-actions">
            <button className="diagnosis-primary-button diagnosis-share-main-button" type="button" onClick={openSharePost}>
              Xで結果をシェア
            </button>
            <a className="diagnosis-secondary-button" href="/swipe">
              Vtuberを探す
            </a>
          </div>
          <NextDiagnosisCta />

          <div className="diagnosis-actions">
            {saveState === "saving" ? <span className="diagnosis-save-note">診断結果を保存中...</span> : null}
            {saveState === "saved" ? <span className="diagnosis-save-note">診断結果を保存しました</span> : null}
            {saveState === "offline" ? <span className="diagnosis-save-note">表示は完了しました。保存はあとで再試行される場合があります</span> : null}
            {profileSaveTarget === "creator" ? <span className="diagnosis-save-note">配信者プロフィールへ自動で反映しました</span> : null}
            {profileSaveTarget === "viewer" ? <span className="diagnosis-save-note">視聴者プロフィールに保存しました</span> : null}
            {!profileSaveTarget && mode !== "viewer" ? <span className="diagnosis-save-note">未ログインの場合は、プロフィール登録・修正画面でこのタイプを選べます</span> : null}
            {!profileSaveTarget && mode === "viewer" ? <span className="diagnosis-save-note">視聴者プロフィール画面でこのタイプを保存できます</span> : null}
          </div>

          {mode === "light" ? (
            <>
              <DiagnosisLinkCard
                image="/diagnosis/ui/100q.webp"
                title="100問の詳細診断"
                description="より細かく配信スタイルを見たい方向けです。"
                href="/diagnosis/advanced"
                button="100問診断をする"
              />
              <DiagnosisLinkCard
                image="/diagnosis/ui/viewer-30q.webp"
                title="リスナー向け 相性診断"
                description="あなたと相性のいいVTuberタイプがわかります。"
                href="/diagnosis/viewer"
                button="リスナー向け 相性診断"
              />
            </>
          ) : null}
        </section>
      </DiagnosisShell>
    );
  }

  if (showSharedPreview && previewType && previewScores) {
    return (
      <DiagnosisShell>
        <section className="diagnosis-result diagnosis-shared-preview">
          <p className="diagnosis-kicker">シェアされたVTYPE診断結果</p>
          <p className="diagnosis-type-code">{previewType.code}</p>
          <h1>【{previewType.name}】タイプ</h1>
          <p className="diagnosis-catch">{previewType.catchCopy}</p>
          <img
            className="diagnosis-type-image"
            src={`/diagnosis/types/${previewType.id}.webp`}
            alt={`${previewType.name}のタイプ画像`}
            loading="eager"
            decoding="async"
          />
          <div className="diagnosis-result-grid">
            <RadarChart scores={previewScores} mode={mode === "viewer" ? "viewer" : "vtuber"} />
            <ScoreList scores={previewScores} />
          </div>
          <RadarScoreInsights scores={previewScores} mode={mode === "viewer" ? "viewer" : "vtuber"} />
          {mode === "viewer" ? <ListenerDeepDive type={previewType} /> : <StreamerDeepDive type={previewType} />}
          <NextDiagnosisCta />
          <div className="diagnosis-actions">
            <button className="diagnosis-primary-button" type="button" onClick={startFromSharedPreview}>
              診断を始める
            </button>
            <a className="diagnosis-secondary-button" href={mode === "viewer" ? "/diagnosis" : "/diagnosis/viewer"}>
              {mode === "viewer" ? "配信者向け診断へ" : "リスナー向け 相性診断"}
            </a>
          </div>
        </section>
      </DiagnosisShell>
    );
  }

  if (!started) {
    return (
      <DiagnosisShell>
        <section className="diagnosis-hero">
          <img
            className="diagnosis-hero-image"
            src={modeMeta.image}
            alt={modeMeta.imageAlt}
          />
          <div className="diagnosis-hero-copy">
            <p className="diagnosis-kicker">{modeMeta.kicker}</p>
            <h1>{modeMeta.title}</h1>
            <p>{modeMeta.description}</p>
            <label className="diagnosis-name-field">
              <span>{mode === "viewer" ? "ニックネーム（任意）" : "VTuber名"}</span>
              <input
                value={vtuberName}
                onChange={(event) => setVtuberName(event.target.value)}
                maxLength={50}
                placeholder={mode === "viewer" ? "未入力でもOK" : "例: みらい ねお"}
              />
            </label>
            {nameError ? <p className="diagnosis-error">{nameError}</p> : null}
            <div className="diagnosis-start-actions">
              <button
                className={mode === "light" ? "diagnosis-primary-button diagnosis-image-start-button" : "diagnosis-primary-button"}
                type="button"
                onClick={startDiagnosis}
              >
                {mode === "light" ? (
                  <>
                    <img src="/diagnosis/ui/30q.webp" alt="" />
                    <span>30問診断を始める</span>
                  </>
                ) : (
                  modeMeta.startButton
                )}
              </button>
              {mode === "advanced" ? (
                <a className="diagnosis-secondary-button" href="/diagnosis">
                  30問診断へ
                </a>
              ) : mode === "viewer" ? (
                <a className="diagnosis-secondary-button" href="/diagnosis">
                  配信者向け診断へ
                </a>
              ) : (
                <a className="diagnosis-secondary-button" href="/diagnosis/advanced">
                  100問診断をする
                </a>
              )}
              {mode !== "viewer" ? (
                <a className="diagnosis-secondary-button" href="/diagnosis/viewer">
                  リスナー向け 相性診断
                </a>
              ) : null}
            </div>
            <p className="diagnosis-vtubermatch-copy">あなたに合うVTuberとの出会いを、VtuberMatchで。</p>
            <VtuberMatchBanner />
          </div>
        </section>
      </DiagnosisShell>
    );
  }

  return (
    <DiagnosisShell>
      <section className="diagnosis-questions">
        <div className="diagnosis-progress-area">
          <span>
            {pageIndex + 1} / {pages}
          </span>
          <div className="diagnosis-progress">
            <div style={{ width: `${Math.max(Math.round(((pageIndex + 1) / pages) * 100), 8)}%` }} />
          </div>
        </div>
        <h1>{modeMeta.questionTitle}</h1>
        <p className="diagnosis-question-help">
          質問に対して、1はNO、5はYESです。今の自分に近い位置を選んでください。
        </p>
        {nameError ? <p className="diagnosis-error">{nameError}</p> : null}
        <div className="diagnosis-question-list">
          {currentQuestions.map((question, index) => (
            <fieldset className="diagnosis-question" key={question.id}>
              <legend>
                Q{pageIndex * 5 + index + 1}. {question.text}
              </legend>
              <div className="diagnosis-range-row">
                <div className="diagnosis-range-labels" aria-hidden="true">
                  <span>1 NO</span>
                  <strong>{answers[question.id] || "-"}</strong>
                  <span>5 YES</span>
                </div>
                <input
                  aria-label={`Q${pageIndex * 5 + index + 1}の回答`}
                  min={1}
                  max={5}
                  step={1}
                  type="range"
                  value={answers[question.id] || 3}
                  onChange={(event) => updateAnswer(question.id, Number(event.target.value))}
                />
                <div className="diagnosis-range-ticks" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      className={answers[question.id] === value ? "selected" : ""}
                      key={value}
                      type="button"
                      onClick={() => updateAnswer(question.id, value)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            </fieldset>
          ))}
        </div>
        <div className="diagnosis-nav-actions">
          <button className="diagnosis-secondary-button" type="button" onClick={previousPage} disabled={pageIndex === 0}>
            戻る
          </button>
          <button className="diagnosis-primary-button" type="button" onClick={nextPage}>
            {pageIndex + 1 >= pages ? "結果を見る" : "次へ"}
          </button>
        </div>
      </section>
    </DiagnosisShell>
  );
}

function DiagnosisShell({ children }: { children: ReactNode }) {
  return (
    <main className="diagnosis-page">
      <div className="diagnosis-shell">{children}</div>
      <footer className="diagnosis-footer">
        <a href="https://vtubermatch.com">Powered by VtuberMatch</a>
        <p>
          お預かりした診断結果は、サービスの改善や、今後の機能開発・コンテンツ最適化のためにのみ使用いたします。
        </p>
      </footer>
    </main>
  );
}

function RadarChart({ scores, mode = "vtuber" }: { scores: DiagnosisScores; mode?: "vtuber" | "viewer" }) {
  const [zoomed, setZoomed] = useState(false);
  const [magnified, setMagnified] = useState(false);
  const zoomViewRef = useRef<HTMLDivElement | null>(null);
  const center = 120;
  const radius = 88;
  const points = diagnosisAxes
    .map((axis, index) => {
      const angle = (Math.PI * 2 * index) / diagnosisAxes.length - Math.PI / 2;
      const value = Math.max(0, Math.min(100, scores[axis.key])) / 100;
      return `${center + Math.cos(angle) * radius * value},${center + Math.sin(angle) * radius * value}`;
    })
    .join(" ");

  useEffect(() => {
    if (!zoomed || typeof window === "undefined") return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeZoom();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [zoomed]);

  function closeZoom() {
    setZoomed(false);
    setMagnified(false);
  }

  useEffect(() => {
    const view = zoomViewRef.current;
    if (!view) return;
    view.scrollTo({
      left: magnified ? (view.scrollWidth - view.clientWidth) / 2 : 0,
      top: magnified ? (view.scrollHeight - view.clientHeight) / 2 : 0,
    });
  }, [magnified]);

  const chart = (
    <div className="diagnosis-radar" aria-label="診断スコアのレーダーチャート">
      <img
        src={mode === "viewer" ? "/diagnosis/ui/viewer-radar-template.webp" : "/diagnosis/ui/radar-template.webp"}
        alt=""
        loading="lazy"
        decoding="async"
      />
      <svg viewBox="0 0 240 240" role="img">
        {[0.25, 0.5, 0.75, 1].map((scale) => (
          <polygon
            key={scale}
            className="diagnosis-radar-grid"
            points={diagnosisAxes
              .map((_, index) => {
                const angle = (Math.PI * 2 * index) / diagnosisAxes.length - Math.PI / 2;
                return `${center + Math.cos(angle) * radius * scale},${center + Math.sin(angle) * radius * scale}`;
              })
              .join(" ")}
          />
        ))}
        <polygon className="diagnosis-radar-score" points={points} />
      </svg>
    </div>
  );

  return (
    <div className="diagnosis-radar-wrap">
      <button
        className="diagnosis-radar-zoom-trigger"
        type="button"
        onClick={() => setZoomed(true)}
        aria-label="レーダーチャートを拡大表示する"
      >
        {chart}
        <span className="diagnosis-radar-zoom-hint">タップで拡大</span>
      </button>
      {zoomed ? (
        <div
          className="diagnosis-radar-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="レーダーチャートの拡大表示"
          onClick={closeZoom}
        >
          <div className="diagnosis-radar-modal" onClick={(event) => event.stopPropagation()}>
            <div className={`diagnosis-radar-modal-view${magnified ? " magnified" : ""}`} ref={zoomViewRef}>
              {chart}
            </div>
            <div className="diagnosis-radar-modal-actions">
              <button className="diagnosis-secondary-button" type="button" onClick={() => setMagnified((prev) => !prev)}>
                {magnified ? "縮小する" : "さらに拡大する"}
              </button>
              <button className="diagnosis-secondary-button" type="button" onClick={closeZoom}>
                閉じる
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ScoreList({ scores }: { scores: DiagnosisScores }) {
  return (
    <div className="diagnosis-score-list">
      {diagnosisAxes.map((axis) => (
        <div className="diagnosis-score-row" key={axis.key}>
          <span>{axis.label}</span>
          <div>
            <b style={{ width: `${scores[axis.key]}%` }} />
          </div>
          <strong>{scores[axis.key]}</strong>
        </div>
      ))}
    </div>
  );
}

function DiagnosisMatchSummary({ matches }: { matches: DiagnosisTypeMatch[] }) {
  const primary = matches[0];
  const secondary = matches.find((match) => match.type.id !== primary?.type.id);
  if (!primary) return null;

  return (
    <section className="diagnosis-match-summary" aria-label="診断結果の一致度">
      <div className="diagnosis-match-main">
        <article>
          <span>一致度</span>
          <strong>{primary.confidence}%</strong>
          <p>{primary.type.code}: {primary.type.name}</p>
        </article>
        {secondary ? (
          <article>
            <span>近いタイプ</span>
            <strong>{secondary.confidence}%</strong>
            <p>{secondary.type.code}: {secondary.type.name}</p>
          </article>
        ) : null}
      </div>
      <div className="diagnosis-axis-tags">
        {primary.axisLabels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </section>
  );
}

function RadarScoreInsights({ scores, mode }: { scores: DiagnosisScores; mode: "vtuber" | "viewer" }) {
  return (
    <section className="diagnosis-radar-insights" aria-label="スタイル分析">
      <p className="diagnosis-kicker">6軸スタイル分析</p>
      <div className="diagnosis-radar-insight-grid">
        {diagnosisAxes.map((axis) => {
          const score = scores[axis.key];
          return (
            <article key={axis.key}>
              <div>
                <span>■ {axis.label}</span>
                <strong>{score}</strong>
              </div>
              <p>{getAxisBandText(score)} {getAxisComment(axis.key, score, mode)}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function StreamerDeepDive({ type }: { type: DiagnosisType }) {
  return (
    <section className="diagnosis-deep-dive">
      <p className="diagnosis-kicker">タイプ深掘り</p>
      <h2>{type.code}: {type.name}</h2>
      <div className="diagnosis-deep-grid">
        <article>
          <span>回答傾向</span>
          <p>{type.description}</p>
        </article>
        <article>
          <span>強み</span>
          <ul>
            {type.strengths.map((strength) => (
              <li key={strength}>{strength}</li>
            ))}
          </ul>
        </article>
        <article>
          <span>向いていそうな配信スタイル</span>
          <p>{type.catchCopy}という魅力が出やすく、回答傾向としてはその強みを活かした配信に向いている可能性があります。</p>
        </article>
        <article>
          <span>相性のいいリスナータイプ</span>
          <p>{type.viewerMatch}</p>
        </article>
      </div>
      <p className="diagnosis-match-lead">VtuberMatchで、{type.name}タイプのあなたと相性のいい視聴者に届けましょう。</p>
    </section>
  );
}

function ListenerDeepDive({ type }: { type: DiagnosisType }) {
  return (
    <section className="diagnosis-deep-dive">
      <p className="diagnosis-kicker">リスナー向け分析</p>
      <h2>{type.code}: {type.name} と相性が良さそうです</h2>
      <div className="diagnosis-deep-grid listener">
        <article>
          <span>好きになりやすいVTuberタイプ</span>
          <p>{type.description}</p>
        </article>
        <article>
          <span>推し活がもっと楽しくなりそうな視聴スタイル</span>
          <p>{type.viewerMatch}</p>
        </article>
        <article>
          <span>まとめ</span>
          <p>回答傾向として、{type.name}タイプの魅力に反応しやすい可能性があります。VtuberMatchで近い雰囲気の配信者を探してみてください。</p>
        </article>
      </div>
    </section>
  );
}

function ViewerMatchCard({ scores, type }: { scores: DiagnosisScores; type: DiagnosisType }) {
  const viewerType = getViewerMatchType(scores);

  return (
    <section className="diagnosis-viewer-match">
      <p className="diagnosis-kicker">相性のいい視聴者タイプ</p>
      <h2>{viewerType.title}</h2>
      <p>{viewerType.catchCopy}</p>
      <div className="diagnosis-viewer-traits">
        {viewerType.traits.map((trait) => (
          <span key={trait}>{trait}</span>
        ))}
      </div>
      <p>VtuberMatchでは、{type.name}タイプのあなたに興味を持つ視聴者へ届くきっかけを用意しています。</p>
    </section>
  );
}

function CreatorDiagnosisRegisterCta() {
  return (
    <section className="diagnosis-creator-register-cta">
      <p className="diagnosis-kicker">未登録の配信者へ</p>
      <h2>診断結果を保存して、相性のいいリスナーに見つけてもらう</h2>
      <p>
        無料掲載すると、診断で見えたあなたの配信スタイルをプロフィールに活かせます。
        推しを探しているリスナーに、あなたの魅力が届くきっかけを作りましょう。
      </p>
      <a className="diagnosis-primary-button" href="/creator/apply">
        無料掲載して診断結果を活かす
      </a>
    </section>
  );
}

function ViewerResultGuide({ type }: { type: DiagnosisType }) {
  return (
    <section className="diagnosis-viewer-match">
      <p className="diagnosis-kicker">次の行動</p>
      <h2>{type.name}タイプのVTuberを探してみよう</h2>
      <p>VtuberMatchでは、タグや雰囲気から近い配信者を探せます。診断結果は「探すきっかけ」として使ってください。</p>
      <div className="diagnosis-viewer-traits">
        <span>プロフィール確認</span>
        <span>配信リンクへ移動</span>
        <span>気になるVTuberにいいね</span>
      </div>
    </section>
  );
}

function AdvancedDetails({ scores }: { scores: DiagnosisScores }) {
  const top = topAxisLabels(scores, 3);
  const deviation = deviationScores(scores);

  return (
    <section className="diagnosis-advanced-result">
      <h2>100問版 詳細結果</h2>
      <div className="diagnosis-detail-grid">
        <article>
          <span>偏差値目安</span>
          <strong>{Math.round(top.reduce((sum, item) => sum + deviation[item.key], 0) / top.length)}</strong>
        </article>
        <article>
          <span>上位傾向</span>
          <p>{top.map((item) => item.label).join(" / ")}</p>
        </article>
        <article>
          <span>上位スコア</span>
          <p>{top.map((item) => `${item.label}${item.score}`).join(" / ")}</p>
        </article>
      </div>
    </section>
  );
}

function DiagnosisNotice() {
  return (
    <p className="diagnosis-save-note">
      この診断は回答傾向に基づく簡易分析です。実際の人気・登録者増加・リスナー数を保証するものではありません。
    </p>
  );
}

function NextDiagnosisCta() {
  return (
    <section className="diagnosis-next-cta">
      <p className="diagnosis-kicker">次の診断をする</p>
      <div className="diagnosis-actions">
        <a className="diagnosis-primary-button" href="/#diagnosis-menu">30問診断をする</a>
        <a className="diagnosis-secondary-button" href="/#diagnosis-menu">100問診断をする</a>
        <a className="diagnosis-secondary-button" href="/#diagnosis-menu">リスナー向け 相性診断</a>
      </div>
    </section>
  );
}

function DiagnosisLinkCard({
  image,
  title,
  description,
  href,
  button,
}: {
  image: string;
  title: string;
  description: string;
  href: string;
  button: string;
}) {
  return (
    <section className="diagnosis-advanced-card">
      <img src={image} alt={title} />
      <div>
        <p>{description}</p>
        <h2>{title}</h2>
        <a className="diagnosis-secondary-button" href={href}>
          {button}
        </a>
      </div>
    </section>
  );
}

function VtuberMatchBanner() {
  return (
    <a className="diagnosis-vtubermatch-banner" href="https://vtubermatch.com">
      <span>VtuberMatch</span>
      <strong>配信者と視聴者をつなぐ VTuberマッチ</strong>
    </a>
  );
}

function getModeMeta(mode: DiagnosisMode) {
  if (mode === "advanced") {
    return {
      image: "/diagnosis/ui/100q.webp",
      imageAlt: "100問の詳細診断",
      kicker: "VTYPE詳細診断",
      title: "100問で深掘りする配信スタイル",
      description: "6軸の傾向をより細かく見て、16タイプから近いタイプを判定します。",
      startButton: "100問診断を始める",
      questionTitle: "100問診断",
      resultLabel: "100問診断結果",
    };
  }
  if (mode === "viewer") {
    return {
      image: "/diagnosis/ui/viewer-30q.webp",
      imageAlt: "リスナー向け相性診断",
      kicker: "リスナー向け VTYPE診断",
      title: "相性のいいVTuberタイプを診断",
      description: "30問で、あなたが好きになりやすい配信スタイルを16タイプから見つけます。",
      startButton: "リスナー向け 相性診断",
      questionTitle: "リスナー向け 相性診断",
      resultLabel: "リスナー向け診断結果",
    };
  }
  return {
    image: "/diagnosis/ui/30q.webp",
    imageAlt: "30問のVTYPE診断",
    kicker: "VTYPE診断",
    title: "30問でわかるあなたの配信スタイル",
    description: "回答傾向から6軸のスタイルを見て、16タイプの中から近いタイプを判定します。",
    startButton: "30問診断を始める",
    questionTitle: "30問診断",
    resultLabel: "30問診断結果",
  };
}

function createShareUrl(type: DiagnosisType, mode: DiagnosisMode) {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(createShareText(type, mode))}`;
}

function createShareText(type: DiagnosisType, mode: DiagnosisMode) {
  const version = mode === "advanced" ? "100問Ver" : mode === "viewer" ? "リスナーVer" : "30問Ver";
  const url = mode === "viewer"
    ? `https://vtubermatch.com/diagnosis/viewer?type=${type.id}`
    : `https://vtubermatch.com/diagnosis?type=${type.id}`;
  if (mode === "viewer") {
    return [
      "私と相性がいいVTuberは",
      `【${type.code}:${type.name}タイプ】でした。`,
      "",
      "他の人の結果も見たいので貼ってください🙏",
      "",
      url,
      "",
      "#vtuber16タイプ診断",
      "#vtubermatch",
    ].join("\n");
  }
  return [
    "診断結果は",
    `【${type.code}:${type.name}（${version}）】でした。`,
    "",
    "みんなはどんなタイプ？",
    "",
    url,
    "リスナー診断もあります",
    "",
    "#vtuber16タイプ診断",
    "#vtubermatch",
  ].join("\n");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function rememberDiagnosisProfile(
  mode: DiagnosisMode,
  type: DiagnosisType,
  scores: DiagnosisScores,
  resultId: string | null,
) {
  if (typeof window === "undefined") return;
  const fields = buildVtypeProfileFields({ type, scores, mode, resultId });
  const key = mode === "viewer" ? viewerVtypeStorageKey : creatorVtypeStorageKey;
  window.localStorage.setItem(key, JSON.stringify(fields));
  if (mode === "viewer") mergeLocalJson("vtuber-match-viewer-profile", fields);
  else mergeLocalJson("vtuber-match-creator-profile-draft", fields);
}

function mergeLocalJson(key: string, patch: VtypeProfileFields) {
  try {
    const current = JSON.parse(window.localStorage.getItem(key) || "{}") as Record<string, unknown>;
    window.localStorage.setItem(key, JSON.stringify({ ...current, ...patch }));
  } catch {
    window.localStorage.setItem(key, JSON.stringify(patch));
  }
}

function isProfileSaveTarget(value: unknown): value is ProfileSaveTarget {
  return value === "creator" || value === "viewer" || value === false;
}

async function createRadarImageBlob(type: DiagnosisType, scores: DiagnosisScores, mode: DiagnosisMode) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 1200;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  const template = await loadImage(
    mode === "viewer" ? "/diagnosis/ui/viewer-radar-template.webp" : "/diagnosis/ui/radar-template.webp"
  );
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(template, 0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#111827";
  ctx.font = "bold 46px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${type.code}: ${type.name}`, 600, 92);

  const center = 600;
  const radius = 360;
  ctx.strokeStyle = "#d8dee9";
  ctx.lineWidth = 3;
  for (const scale of [0.25, 0.5, 0.75, 1]) {
    drawPolygon(ctx, center, radius * scale, false);
  }
  ctx.strokeStyle = "#ec4899";
  ctx.fillStyle = "rgba(236, 72, 153, 0.2)";
  ctx.lineWidth = 6;
  const points = diagnosisAxes.map((axis, index) => {
    const angle = (Math.PI * 2 * index) / diagnosisAxes.length - Math.PI / 2;
    const value = Math.max(0, Math.min(100, scores[axis.key])) / 100;
    return { x: center + Math.cos(angle) * radius * value, y: center + Math.sin(angle) * radius * value };
  });
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("blob unavailable"))), "image/png");
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image unavailable"));
    image.src = src;
  });
}

function drawPolygon(ctx: CanvasRenderingContext2D, center: number, radius: number, fill: boolean) {
  ctx.beginPath();
  diagnosisAxes.forEach((_, index) => {
    const angle = (Math.PI * 2 * index) / diagnosisAxes.length - Math.PI / 2;
    const x = center + Math.cos(angle) * radius;
    const y = center + Math.sin(angle) * radius;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  if (fill) ctx.fill();
  ctx.stroke();
}
