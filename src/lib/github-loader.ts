import { GithubRepoLoader } from "@langchain/community/document_loaders/web/github";
import dotenv from "dotenv";

dotenv.config(); // <-- Load .env variables

export const loadGithubRepo = async (githubUrl: string, githubToken?: string) => {
    const token = githubToken || process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GitHub token is required");

    const loader = new GithubRepoLoader(githubUrl, {
        accessToken: token,
        branch: 'master',
        ignoreFiles: ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb'],
        recursive: true,
        unknown: 'warn',
        maxConcurrency: 5
    });

    const docs = await loader.load();
    return docs;
};

console.log(await loadGithubRepo('https://github.com/maxzovert/thryve'));
