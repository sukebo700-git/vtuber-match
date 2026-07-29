// コラボお誘い機能のフィーチャーフラグ。
// tshirt/config.ts と同じ方式: 明示的に "true" のときだけ有効(未設定=非公開)。
export function isCollaborationEnabled(): boolean {
  return (process.env.COLLABORATION_ENABLED || "").toLowerCase() === "true";
}
