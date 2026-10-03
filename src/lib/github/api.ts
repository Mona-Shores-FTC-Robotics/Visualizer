/**
 * Just enough of GitHub's REST API for "Save to GitHub": read biobuzz's files,
 * commit several files as one commit, watch the Action that commit starts,
 * and read what it published. api.github.com allows calls from a web page, so
 * the hosted site needs no server: it acts with a fine-grained token the
 * person pastes in once, kept only in this browser.
 */
import { GIT_REPO } from "../../utils/gitLink";

const API = "https://api.github.com";
const TOKEN_KEY = "githubToken";

export function savedToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Private windows can refuse storage; the token then lasts only this page.
  }
}

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function call(
  token: string | null,
  path: string,
  init: RequestInit & { accept?: string } = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: init.accept ?? "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init.body) headers["Content-Type"] = "application/json";
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    let message = `GitHub answered ${response.status}`;
    try {
      const data = await response.json();
      if (data.message) message = `${message}: ${data.message}`;
    } catch {
      // The status says enough.
    }
    if (response.status === 401)
      message =
        "GitHub refused the token: it may have expired. Paste a new one.";
    if (response.status === 403 && token) {
      message = `${message}. Check the token has Contents: read and write, and Actions: read, on biobuzz.`;
    }
    throw new GitHubError(message, response.status);
  }
  return response;
}

async function json<T>(
  token: string | null,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  return (await call(token, path, init)).json() as Promise<T>;
}

const repo = (path: string) => `/repos/${GIT_REPO}${path}`;
const encodePath = (path: string) =>
  path.split("/").map(encodeURIComponent).join("/");

/** Who the token belongs to; throws if GitHub refuses it. */
export async function whoAmI(token: string): Promise<string> {
  return (await json<{ login: string }>(token, "/user")).login;
}

/** The commit a branch points at. */
export async function branchHead(
  token: string | null,
  branch: string,
): Promise<string> {
  const ref = await json<{ object: { sha: string } }>(
    token,
    repo(`/git/ref/heads/${encodePath(branch)}`),
  );
  return ref.object.sha;
}

/** Every file path in a commit. */
export async function listFiles(
  token: string | null,
  commit: string,
): Promise<string[]> {
  const commitData = await json<{ tree: { sha: string } }>(
    token,
    repo(`/git/commits/${commit}`),
  );
  const tree = await json<{
    tree: { path: string; type: string }[];
    truncated: boolean;
  }>(token, repo(`/git/trees/${commitData.tree.sha}?recursive=1`));
  return tree.tree
    .filter((entry) => entry.type === "blob")
    .map((entry) => entry.path);
}

/** A file's text at a ref ("": the default branch), or null if it is not there. */
export async function readText(
  token: string | null,
  path: string,
  ref: string,
): Promise<string | null> {
  try {
    const response = await call(
      token,
      repo(`/contents/${encodePath(path)}${ref ? `?ref=${encodeURIComponent(ref)}` : ""}`),
      {
        accept: "application/vnd.github.raw+json",
      },
    );
    return await response.text();
  } catch (error) {
    if (error instanceof GitHubError && error.status === 404) return null;
    throw error;
  }
}

/** A file's bytes at a ref (up to 100 MB), for a download. */
export async function readBytes(
  token: string | null,
  path: string,
  ref: string,
): Promise<Blob> {
  const response = await call(
    token,
    repo(`/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`),
    {
      accept: "application/vnd.github.raw+json",
    },
  );
  return response.blob();
}

/**
 * Commits `files` (path → text) on top of `branch` as one commit, and moves
 * the branch to it. Fails, changing nothing, if the branch moved since
 * `parent` was read; the caller reads it again and retries.
 */
export async function commitFiles(
  token: string,
  branch: string,
  parent: string,
  files: Record<string, string>,
  message: string,
): Promise<string> {
  const parentData = await json<{ tree: { sha: string } }>(
    token,
    repo(`/git/commits/${parent}`),
  );
  const tree = await json<{ sha: string }>(token, repo("/git/trees"), {
    method: "POST",
    body: JSON.stringify({
      base_tree: parentData.tree.sha,
      tree: Object.entries(files).map(([path, content]) => ({
        path,
        mode: "100644",
        type: "blob",
        content,
      })),
    }),
  });
  const commit = await json<{ sha: string }>(token, repo("/git/commits"), {
    method: "POST",
    body: JSON.stringify({ message, tree: tree.sha, parents: [parent] }),
  });
  await json(token, repo(`/git/refs/heads/${encodePath(branch)}`), {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });
  return commit.sha;
}

export interface WorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
}

/** The runs a commit started (empty until GitHub has queued them). */
export async function runsFor(
  token: string | null,
  commit: string,
): Promise<WorkflowRun[]> {
  const data = await json<{ workflow_runs: WorkflowRun[] }>(
    token,
    repo(`/actions/runs?head_sha=${commit}`),
  );
  return data.workflow_runs;
}

export function commitUrl(commit: string): string {
  return `https://github.com/${GIT_REPO}/commit/${commit}`;
}

/**
 * A file's text as GitHub has it right now: the API, not raw.githubusercontent.com,
 * which can serve a branch's file up to 5 minutes stale (so a draft would look
 * older than GitHub just after its own save). Null if there is no such file;
 * throws if the API refuses (a rate limit), so the caller can fall back.
 */
export async function currentText(path: string, ref: string | null): Promise<string | null> {
  return readText(savedToken(), path, ref ?? "");
}
