export async function dispatchProduceWorkflow(inputs: Record<string, string>): Promise<void> {
  const token = process.env.GITHUB_PAT;
  const repo = process.env.GITHUB_REPO || "kayirmurat/remumedia-ai";
  if (!token) {
    throw new Error("GITHUB_PAT tanımlı değil.");
  }

  const res = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/produce-video.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ ref: "main", inputs }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub Actions tetiklenemedi (${res.status}): ${text}`);
  }
}
