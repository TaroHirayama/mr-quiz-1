import {
	getUserProfile,
	upsertUserProfile,
} from "./firestore.js";
import type {
	CreateUserProfileInput,
	UserProfile,
} from "../types/entities/userProfile.js";
import type { ProfileCommand } from "../utils/commandParser.js";
import type { Category } from "../types/index.js";
import { logger } from "../utils/logger.js";

/**
 * プロファイルコマンドハンドラー
 * /profile コマンドの処理とメッセージ生成
 */

/**
 * プロファイルコマンド処理結果
 */
export interface ProfileCommandResult {
	success: boolean;
	profile?: UserProfile;
	message: string;
	isNew?: boolean;
}

/**
 * /profile コマンドを処理
 */
export async function handleProfileCommand(
	accountId: string,
	command: ProfileCommand,
): Promise<ProfileCommandResult> {
	try {
		logger.info("Handling profile command", { accountId, command });

		// 既存プロファイル取得
		const existing = await getUserProfile(accountId);
		const isNew = !existing;

		// プロファイル入力を構築（指定されたフィールドのみ更新）
		const input: CreateUserProfileInput = {
			accountId,
			experienceLevel:
				command.experience ?? existing?.experienceLevel ?? "mid",
			yearsOfExperience:
				command.years ?? existing?.yearsOfExperience ?? 0,
			focusAreas: command.focus ?? existing?.focusAreas ?? [],
			careerGoal: command.goal ?? existing?.careerGoal,
		};

		// プロファイル作成/更新
		const profile = await upsertUserProfile(input);

		// 成功メッセージ生成
		const message = formatProfileUpdateMessage(profile, isNew);

		logger.info("Profile command completed", {
			accountId,
			isNew,
			profile,
		});

		return {
			success: true,
			profile,
			message,
			isNew,
		};
	} catch (error) {
		logger.error("Failed to handle profile command", {
			error,
			accountId,
			command,
		});

		return {
			success: false,
			message: formatProfileErrorMessage(
				"プロファイルの更新に失敗しました",
				"しばらく時間をおいて再度お試しください",
			),
		};
	}
}

/**
 * プロファイル更新の確認メッセージを生成
 */
export function formatProfileUpdateMessage(
	profile: UserProfile,
	isNew: boolean,
): string {
	const action = isNew ? "作成" : "更新";
	const emoji = isNew ? "🎉" : "✅";

	// 経験レベルの日本語表記
	const experienceLevelMap = {
		junior: "ジュニア (1-2年)",
		mid: "ミッドレベル (3-5年)",
		senior: "シニア (5年以上)",
	};

	// カテゴリの日本語表記
	const categoryMap = {
		bug_fix: "バグ修正",
		performance: "パフォーマンス",
		refactoring: "リファクタリング",
		security: "セキュリティ",
		logic: "ロジック",
	};

	// 注力分野を整形
	const focusAreasText =
		profile.focusAreas && profile.focusAreas.length > 0
			? profile.focusAreas.map((cat: Category) => categoryMap[cat] || cat).join(", ")
			: "未設定";

	return `## ${emoji} プロファイルを${action}しました

**設定内容:**
- 経験レベル: ${experienceLevelMap[profile.experienceLevel] || profile.experienceLevel}
- 経験年数: ${profile.yearsOfExperience}年
- 注力分野: ${focusAreasText}${profile.careerGoal ? `\n- キャリア目標: ${profile.careerGoal}` : ""}

今後のクイズはこの情報を考慮して出題されます。
プロファイルはいつでも同じコマンドで変更できます。

**更新例:**
\`\`\`
/profile focus=performance,security
\`\`\`

---
*プロファイル設定により、苦手分野を重点的に、得意分野はより高難易度で出題されます*`;
}

/**
 * プロファイルコマンドのエラーメッセージを生成
 */
export function formatProfileErrorMessage(
	error: string,
	hint?: string,
): string {
	return `## ❌ プロファイル設定エラー

${error}

${hint ? `**ヒント:** ${hint}\n\n` : ""}**使い方:**
\`\`\`
/profile experience=mid years=3 focus=security,performance goal="目標"
\`\`\`

**パラメータ:**
- \`experience\`: junior / mid / senior
- \`years\`: 経験年数（数値）
- \`focus\`: bug_fix, performance, refactoring, security, logic（最大5つ）
- \`goal\`: キャリア目標（最大500文字、省略可）

**例:**
\`\`\`
/profile experience=senior years=5 focus=performance,security
\`\`\`

詳細は \`/profile help\` でご確認ください。`;
}

/**
 * プロファイルコマンドが空の場合のヘルプメッセージ
 */
export function shouldShowProfileHelp(command: ProfileCommand): boolean {
	return Object.keys(command).length === 0;
}
