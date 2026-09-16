import { createGithubClient } from "@/lib/github-auth";
import { getAppUrl, parseGithubUrl } from "@/lib/github-url";

export async function createGithubIssueFromChapter(params: {
  token: string;
  githubUrl: string;
  title: string;
  body: string;
}) {
  const { owner, repo } = parseGithubUrl(params.githubUrl);
  const octokit = createGithubClient(params.token);

  const { data } = await octokit.rest.issues.create({
    owner,
    repo,
    title: params.title,
    body: params.body,
  });

  return {
    number: data.number,
    url: data.html_url,
  };
}

export function buildMeetingIssueBody(params: {
  summary: string;
  start: string;
  end: string;
  meetingName: string;
  meetingId: string;
  headline?: string;
}) {
  const appUrl = getAppUrl();
  const lines = [
    params.summary.trim(),
    "",
    `**Meeting:** ${params.meetingName}`,
    `**Timestamp:** ${params.start} – ${params.end}`,
  ];

  if (params.headline?.trim()) {
    lines.push(`**Headline:** ${params.headline.trim()}`);
  }

  lines.push("", `---`, `Created from [Gitwork meeting](${appUrl}/meetings/${params.meetingId}).`);

  return lines.join("\n");
}
