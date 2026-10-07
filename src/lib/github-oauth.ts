import { randomBytes } from "crypto";

const GITHUB_AUTHORIZE = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN = "https://github.com/login/oauth/access_token";
const GITHUB_API = "https://api.github.com";

export const GITHUB_OAUTH_SCOPES = "repo read:user user:email";

export function getGithubOauthConfig() {
  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
  const base =
    process.env.APP_BASE_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    "http://localhost:3000";

  if (!clientId || !clientSecret) {
    throw new Error(
      "GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are required for GitHub OAuth",
    );
  }

  return {
    clientId,
    clientSecret,
    callbackUrl: `${base.replace(/\/$/, "")}/api/auth/github/callback`,
    baseUrl: base.replace(/\/$/, ""),
  };
}

export function createOauthStateValue() {
  return randomBytes(24).toString("base64url");
}

export function buildGithubAuthorizeUrl(state: string) {
  const { clientId, callbackUrl } = getGithubOauthConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    scope: GITHUB_OAUTH_SCOPES,
    state,
    allow_signup: "true",
  });
  return `${GITHUB_AUTHORIZE}?${params.toString()}`;
}

export async function exchangeGithubCode(code: string) {
  const { clientId, clientSecret, callbackUrl } = getGithubOauthConfig();
  const res = await fetch(GITHUB_TOKEN, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: callbackUrl,
    }),
  });

  if (!res.ok) {
    throw new Error(`GitHub token exchange failed (${res.status})`);
  }

  const data = (await res.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
    scope?: string;
  };

  if (!data.access_token) {
    throw new Error(
      data.error_description || data.error || "GitHub did not return an access token",
    );
  }

  return {
    accessToken: data.access_token,
    scope: data.scope ?? "",
  };
}

export type GithubProfile = {
  id: number;
  login: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
};

export async function fetchGithubProfile(
  accessToken: string,
): Promise<GithubProfile> {
  const userRes = await fetch(`${GITHUB_API}/user`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "gitwork",
    },
  });
  if (!userRes.ok) {
    throw new Error(`Failed to load GitHub profile (${userRes.status})`);
  }
  const user = (await userRes.json()) as {
    id: number;
    login: string;
    name: string | null;
    email: string | null;
    avatar_url: string | null;
  };

  let email = user.email?.trim() || null;
  if (!email) {
    const emailsRes = await fetch(`${GITHUB_API}/user/emails`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "gitwork",
      },
    });
    if (emailsRes.ok) {
      const emails = (await emailsRes.json()) as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>;
      const primary =
        emails.find((e) => e.primary && e.verified) ||
        emails.find((e) => e.verified) ||
        emails[0];
      email = primary?.email?.trim() || null;
    }
  }

  if (!email) {
    throw new Error(
      "GitHub account has no usable email. Make an email public or grant user:email.",
    );
  }

  const resolvedEmail: string = email;

  return {
    id: user.id,
    login: user.login,
    name: user.name,
    email: resolvedEmail,
    avatarUrl: user.avatar_url,
  };
}
