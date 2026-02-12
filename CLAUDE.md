# [プロジェクト名] 開発ガイドライン

すべての機能計画から自動生成。最終更新: [日付]

## 使用中の技術

[すべてのPLAN.MDファイルから抽出]

## プロジェクト構造

```text
[計画からの実際の構造]
```

## コマンド

[使用中の技術に対するコマンドのみ]

## コードスタイル

[使用中の言語に固有、使用言語のみ]

## 最近の変更

[直近3つの機能と追加内容]

<!-- 手動追加開始 -->

## Branch Policy

**NEVER commit directly to `main` or `production` branches.**

### Workflow
1. Create feature branch: `git checkout -b feature/description` or `fix/description`
2. Make changes and commit
3. Push branch: `git push -u origin branch-name`
4. Create PR to `main`
5. After merge to `main`, create PR from `main` to `production`
6. Delete merged branch

### Pre-commit Checks

Run before committing:

```bash
npm run format    # Format code
npm run lint      # Lint (Biome)
npm run typecheck # Type check (TypeScript)
```

**Do not commit if checks fail.**

<!-- 手動追加終了 -->
