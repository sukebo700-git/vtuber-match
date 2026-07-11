const voicevoxBaseUrl = process.env.VOICEVOX_BASE_URL || "http://127.0.0.1:50021";

export async function synthesizeNarration(text: string): Promise<Buffer> {
  const speaker = Number(process.env.VOICEVOX_SPEAKER || 1);
  const queryResponse = await fetch(
    `${voicevoxBaseUrl}/audio_query?speaker=${speaker}&text=${encodeURIComponent(text)}`,
    { method: "POST" }
  );
  if (!queryResponse.ok) {
    throw new Error(`VOICEVOX audio_query failed: ${queryResponse.status}. VOICEVOXアプリが起動しているか確認してください。`);
  }
  const audioQuery = await queryResponse.json();

  const synthesisResponse = await fetch(`${voicevoxBaseUrl}/synthesis?speaker=${speaker}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(audioQuery),
  });
  if (!synthesisResponse.ok) {
    throw new Error(`VOICEVOX synthesis failed: ${synthesisResponse.status}`);
  }
  return Buffer.from(await synthesisResponse.arrayBuffer());
}
