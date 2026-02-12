// Webhook型定義
// GitHub/GitLabからのWebhookペイロード構造

/**
 * GitHub Pull Request Webhook Event
 * @see https://docs.github.com/en/webhooks/webhook-events-and-payloads#pull_request
 */
export interface GitHubPullRequestEvent {
	action:
		| "opened"
		| "edited"
		| "closed"
		| "reopened"
		| "synchronize"
		| "assigned"
		| "unassigned"
		| "review_requested"
		| "review_request_removed"
		| "labeled"
		| "unlabeled"
		| "ready_for_review";
	number: number;
	pull_request: {
		id: number;
		number: number;
		state: "open" | "closed";
		title: string;
		body: string | null;
		user: {
			login: string;
			id: number;
		};
		head: {
			ref: string;
			sha: string;
			repo: {
				name: string;
				full_name: string;
			};
		};
		base: {
			ref: string;
			sha: string;
			repo: {
				name: string;
				full_name: string;
			};
		};
		draft: boolean;
		merged: boolean;
		diff_url: string;
		html_url: string;
	};
	repository: {
		id: number;
		name: string;
		full_name: string;
		owner: {
			login: string;
			id: number;
		};
		private: boolean;
	};
	sender: {
		login: string;
		id: number;
	};
}

/**
 * GitLab Merge Request Webhook Event
 * @see https://docs.gitlab.com/ee/user/project/integrations/webhooks.html#merge-request-events
 */
export interface GitLabMergeRequestEvent {
	object_kind: "merge_request";
	event_type: "merge_request";
	user: {
		id: number;
		name: string;
		username: string;
		email: string;
	};
	project: {
		id: number;
		name: string;
		path_with_namespace: string;
		web_url: string;
	};
	object_attributes: {
		id: number;
		iid: number;
		title: string;
		description: string | null;
		state: "opened" | "closed" | "merged" | "locked";
		source_branch: string;
		target_branch: string;
		source_project_id: number;
		target_project_id: number;
		author_id: number;
		action: "open" | "close" | "reopen" | "update" | "approved" | "unapproved" | "merge";
		merge_status: string;
		url: string;
		work_in_progress: boolean;
	};
	repository: {
		name: string;
		url: string;
		description: string;
		homepage: string;
	};
}

/**
 * Webhookイベントの種類を判定
 */
export function isGitHubPullRequestEvent(payload: unknown): payload is GitHubPullRequestEvent {
	const data = payload as Record<string, unknown>;
	return (
		typeof data === "object" &&
		data !== null &&
		"pull_request" in data &&
		"repository" in data &&
		"action" in data
	);
}

export function isGitLabMergeRequestEvent(payload: unknown): payload is GitLabMergeRequestEvent {
	const data = payload as Record<string, unknown>;
	return (
		typeof data === "object" &&
		data !== null &&
		"object_kind" in data &&
		data.object_kind === "merge_request"
	);
}

/**
 * PR/MR作成またはコード更新イベントかを判定
 */
export function shouldGenerateQuiz(payload: GitHubPullRequestEvent | GitLabMergeRequestEvent): boolean {
	if (isGitHubPullRequestEvent(payload)) {
		// GitHub: PR作成時、またはコード更新時（synchronize）
		return payload.action === "opened" || payload.action === "synchronize";
	}

	if (isGitLabMergeRequestEvent(payload)) {
		// GitLab: MR作成時、または更新時
		return payload.object_attributes.action === "open" || payload.object_attributes.action === "update";
	}

	return false;
}

/**
 * GitHub Issue Comment Webhook Event
 * @see https://docs.github.com/en/webhooks/webhook-events-and-payloads#issue_comment
 */
export interface GitHubIssueCommentEvent {
	action: "created" | "edited" | "deleted";
	issue: {
		number: number;
		pull_request?: {
			url: string;
			html_url: string;
		}; // PRの場合のみ存在
		user: {
			login: string;
		};
	};
	comment: {
		id: number;
		body: string;
		user: {
			login: string;
			id: number;
		};
		created_at: string;
		updated_at: string;
	};
	repository: {
		name: string;
		full_name: string;
		owner: {
			login: string;
		};
	};
}

/**
 * GitHubのissue_commentイベントか判定
 */
export function isGitHubIssueCommentEvent(
	payload: unknown,
): payload is GitHubIssueCommentEvent {
	if (!payload || typeof payload !== "object") {
		return false;
	}

	const p = payload as Record<string, unknown>;

	return (
		typeof p.action === "string" &&
		["created", "edited", "deleted"].includes(p.action) &&
		p.issue !== null &&
		typeof p.issue === "object" &&
		p.comment !== null &&
		typeof p.comment === "object" &&
		p.repository !== null &&
		typeof p.repository === "object"
	);
}

/**
 * issue_commentイベントがPRのコメントか判定
 */
export function isPullRequestComment(
	payload: GitHubIssueCommentEvent,
): boolean {
	return payload.issue.pull_request !== undefined;
}

/**
 * WebhookペイロードからPR/MR情報を抽出
 */
export interface ExtractedPRInfo {
	platform: "github" | "gitlab";
	owner: string;
	repo: string;
	number: number;
	accountId: string;
	title: string;
	branch: string;
	url: string;
}

export function extractPRInfo(payload: GitHubPullRequestEvent | GitLabMergeRequestEvent): ExtractedPRInfo {
	if (isGitHubPullRequestEvent(payload)) {
		const [owner, repo] = payload.repository.full_name.split("/");
		return {
			platform: "github",
			owner,
			repo,
			number: payload.pull_request.number,
			accountId: payload.pull_request.user.login,
			title: payload.pull_request.title,
			branch: payload.pull_request.head.ref,
			url: payload.pull_request.html_url,
		};
	}

	// GitLab
	const payload_ = payload as GitLabMergeRequestEvent;
	const [owner, repo] = payload_.project.path_with_namespace.split("/");
	return {
		platform: "gitlab",
		owner,
		repo,
		number: payload_.object_attributes.iid,
		accountId: payload_.user.username,
		title: payload_.object_attributes.title,
		branch: payload_.object_attributes.source_branch,
		url: payload_.object_attributes.url,
	};
}
