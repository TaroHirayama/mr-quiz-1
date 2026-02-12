import { CategorySchema } from "../types/index.js";
import type { Category } from "../types/index.js";
import { logger } from "./logger.js";

/**
 * コマンドパーサー
 * PRコメントから /profile や /answer コマンドを解析
 */

/**
 * プロファイルコマンドのパラメータ
 */
export interface ProfileCommand {
	experience?: "junior" | "mid" | "senior";
	years?: number;
	focus?: Category[];
	goal?: string;
}

/**
 * コマンドタイプ
 */
export type CommandType = "profile" | "answer" | null;

/**
 * コメントからコマンドタイプを判定
 */
export function detectCommandType(text: string): CommandType {
	const trimmed = text.trim().toLowerCase();

	if (trimmed.startsWith("/profile")) {
		return "profile";
	}

	if (trimmed.startsWith("/answer")) {
		return "answer";
	}

	return null;
}

/**
 * /profile コマンドを解析
 * 例: /profile experience=mid years=3 focus=security,performance goal="フルスタック目指してます"
 */
export function parseProfileCommand(text: string): ProfileCommand | null {
	try {
		const trimmed = text.trim();

		// /profile コマンドか確認
		if (!trimmed.toLowerCase().startsWith("/profile")) {
			return null;
		}

		// コマンド部分を削除
		const paramsText = trimmed.substring("/profile".length).trim();

		// パラメータがない場合は空オブジェクトを返す（ヘルプ表示用）
		if (!paramsText) {
			return {};
		}

		const command: ProfileCommand = {};

		// パラメータを解析（key=value 形式）
		// goal="..." のような引用符付き値に対応
		const paramRegex = /(\w+)=(?:"([^"]*)"|(\S+))/g;
		let match: RegExpExecArray | null;

		while ((match = paramRegex.exec(paramsText)) !== null) {
			const key = match[1];
			const quotedValue = match[2];
			const unquotedValue = match[3];
			const value = quotedValue !== undefined ? quotedValue : unquotedValue;

			switch (key.toLowerCase()) {
				case "experience":
				case "exp": {
					const exp = value.toLowerCase();
					if (exp === "junior" || exp === "mid" || exp === "senior") {
						command.experience = exp;
					} else {
						logger.warn("Invalid experience level", { value });
						return null;
					}
					break;
				}

				case "years":
				case "year": {
					const years = Number.parseInt(value, 10);
					if (Number.isNaN(years) || years < 0) {
						logger.warn("Invalid years", { value });
						return null;
					}
					command.years = years;
					break;
				}

				case "focus": {
					const categories = value
						.split(",")
						.map((c) => c.trim())
						.filter((c) => c.length > 0);

					// 最大5つまで
					if (categories.length > 5) {
						logger.warn("Too many focus areas (max 5)", { count: categories.length });
						return null;
					}

					// 各カテゴリをバリデーション
					const validCategories: Category[] = [];
					for (const cat of categories) {
						const result = CategorySchema.safeParse(cat);
						if (result.success) {
							validCategories.push(result.data);
						} else {
							logger.warn("Invalid category", { category: cat });
							return null;
						}
					}

					command.focus = validCategories;
					break;
				}

				case "goal": {
					if (value.length > 500) {
						logger.warn("Goal too long (max 500 chars)", { length: value.length });
						return null;
					}
					command.goal = value;
					break;
				}

				default:
					logger.warn("Unknown parameter", { key });
					// 未知のパラメータは無視（エラーにしない）
					break;
			}
		}

		logger.info("Parsed profile command", { command });
		return command;
	} catch (error) {
		logger.error("Failed to parse profile command", { error, text });
		return null;
	}
}

/**
 * /answer コマンドを解析
 * 例: /answer 2
 */
export function parseAnswerCommand(text: string): number | null {
	try {
		const trimmed = text.trim();

		// /answer コマンドか確認
		if (!trimmed.toLowerCase().startsWith("/answer")) {
			return null;
		}

		// コマンド部分を削除
		const answerText = trimmed.substring("/answer".length).trim();

		// 数値を抽出
		const answerIndex = Number.parseInt(answerText, 10);

		// 1-4の範囲か確認（ユーザー入力は1始まり、内部は0始まり）
		if (Number.isNaN(answerIndex) || answerIndex < 1 || answerIndex > 4) {
			logger.warn("Invalid answer index", { answerText });
			return null;
		}

		// 0始まりに変換
		const zeroBasedIndex = answerIndex - 1;

		logger.info("Parsed answer command", { answerIndex, zeroBasedIndex });
		return zeroBasedIndex;
	} catch (error) {
		logger.error("Failed to parse answer command", { error, text });
		return null;
	}
}

/**
 * プロファイルコマンドのヘルプメッセージを生成
 */
export function getProfileCommandHelp(): string {
	return `## 📝 プロファイルコマンドの使い方

プロファイルを設定すると、より最適なクイズが出題されるようになります。

### コマンド形式
\`\`\`
/profile experience=mid years=3 focus=security,performance goal="目標"
\`\`\`

### パラメータ

**experience** (または exp)
- \`junior\` - ジュニア（1-2年）
- \`mid\` - ミッドレベル（3-5年）
- \`senior\` - シニア（5年以上）

**years** (または year)
- 経験年数（数値）

**focus**
- 注力したい分野（最大5つ、カンマ区切り）
- 選択肢: \`bug_fix\`, \`performance\`, \`refactoring\`, \`security\`, \`logic\`

**goal**
- キャリア目標（任意、最大500文字）
- 引用符で囲む: \`goal="フルスタックエンジニアを目指しています"\`

### 例

**基本的な設定:**
\`\`\`
/profile experience=mid years=3
\`\`\`

**注力分野を指定:**
\`\`\`
/profile experience=senior focus=performance,security
\`\`\`

**すべて指定:**
\`\`\`
/profile experience=mid years=3 focus=security,performance goal="セキュリティエンジニアを目指してます"
\`\`\`

**部分的な更新も可能:**
\`\`\`
/profile focus=refactoring,logic
\`\`\`

---
*設定したプロファイルはいつでも更新できます*`;
}
