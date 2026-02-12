# MR/PR Quiz Bot - アーキテクチャ図

## 本番構成（Google Cloud）

```mermaid
flowchart TB
    subgraph Client["クライアント"]
        GH[("GitHub/GitLab")]
        WEBHOOK["Webhook\n(将来実装)"]
    end

    subgraph GCP["Google Cloud"]
        subgraph CloudRun["Cloud Run"]
            subgraph App["MR/PR Quiz Bot (Hono)"]
                subgraph Routes["Routes"]
                    HEALTH["/health"]
                    QUIZ_GEN["POST /api/quiz/generate"]
                    QUIZ_ANS["POST /api/quiz/:id/answer"]
                end

                subgraph Services["Services"]
                    GEMINI_SVC["Gemini Service"]
                    FS_SVC["Firestore Service"]
                end
            end
        end

        GEMINI["Gemini API"]

        subgraph Firestore["Firestore"]
            USERS[("users")]
            QUIZZES[("quizzes")]
            ANSWERS[("answers")]
            MRS[("mergeRequests")]
        end
    end

    GH -.->|"将来: Webhook"| WEBHOOK
    WEBHOOK -.->|"将来"| QUIZ_GEN

    QUIZ_GEN --> GEMINI_SVC
    QUIZ_GEN --> FS_SVC
    QUIZ_ANS --> FS_SVC

    GEMINI_SVC -->|"diff解析\nクイズ生成"| GEMINI
    FS_SVC --> USERS
    FS_SVC --> QUIZZES
    FS_SVC --> ANSWERS
    FS_SVC --> MRS

    style HEALTH fill:#90EE90,stroke:#228B22
    style QUIZ_GEN fill:#90EE90,stroke:#228B22
    style QUIZ_ANS fill:#90EE90,stroke:#228B22
    style GEMINI_SVC fill:#90EE90,stroke:#228B22
    style FS_SVC fill:#90EE90,stroke:#228B22
    style USERS fill:#90EE90,stroke:#228B22
    style QUIZZES fill:#90EE90,stroke:#228B22
    style ANSWERS fill:#90EE90,stroke:#228B22
    style MRS fill:#90EE90,stroke:#228B22
    style GEMINI fill:#90EE90,stroke:#228B22

    style WEBHOOK fill:#FFE4B5,stroke:#FFA500
    style GH fill:#E6E6FA,stroke:#9370DB
    style CloudRun fill:#FFE4B5,stroke:#FFA500
```

### 凡例

| 色 | 意味 |
|----|------|
| 🟢 緑 | 実装済み |
| 🟠 オレンジ | 将来実装予定 |
| 🟣 紫 | 外部システム（GitHub/GitLab） |

---

## ローカル開発構成

```mermaid
flowchart TB
    subgraph Local["ローカル環境"]
        CLI["curl / HTTPクライアント"]

        subgraph NodeJS["Node.js (tsx)"]
            subgraph App["MR/PR Quiz Bot (Hono)"]
                ROUTES["Routes"]
                SERVICES["Services"]
            end
        end

        subgraph Emulator["Firebase Emulator"]
            FS_EMU[("Firestore\nlocalhost:8080")]
            EMU_UI["Emulator UI\nlocalhost:4000"]
        end
    end

    subgraph External["外部"]
        GEMINI["Gemini API"]
    end

    CLI -->|"HTTP\nlocalhost:3000"| ROUTES
    ROUTES --> SERVICES
    SERVICES -->|"FIRESTORE_EMULATOR_HOST"| FS_EMU
    SERVICES -->|"GEMINI_API_KEY"| GEMINI
    EMU_UI -.->|"データ確認"| FS_EMU

    style CLI fill:#90EE90,stroke:#228B22
    style ROUTES fill:#90EE90,stroke:#228B22
    style SERVICES fill:#90EE90,stroke:#228B22
    style FS_EMU fill:#90EE90,stroke:#228B22
    style EMU_UI fill:#90EE90,stroke:#228B22
    style GEMINI fill:#E6E6FA,stroke:#9370DB
```

---

## データフロー図

### クイズ生成フロー

```mermaid
sequenceDiagram
    participant C as Client
    participant API as Cloud Run API
    participant GS as Gemini Service
    participant FS as Firestore Service
    participant GM as Gemini API
    participant DB as Firestore

    C->>API: POST /api/quiz/generate
    Note over API: Zodでバリデーション

    API->>FS: getOrCreateUser()
    FS->>DB: users/{accountId}
    DB-->>FS: User
    FS-->>API: User

    API->>FS: createMergeRequest()
    FS->>DB: mergeRequests/{mrId}
    DB-->>FS: MergeRequest
    FS-->>API: MergeRequest

    API->>GS: generateQuizFromDiff()
    GS->>GM: diff + プロンプト
    Note over GM: 構造化出力<br/>(JSON Schema)
    GM-->>GS: Quiz JSON
    GS-->>API: Quiz

    API->>FS: createQuiz()
    FS->>DB: quizzes/{quizId}
    DB-->>FS: Quiz
    FS-->>API: Quiz

    API-->>C: 200 OK (quizId, question, options...)
```

### クイズ回答フロー

```mermaid
sequenceDiagram
    participant C as Client
    participant API as Cloud Run API
    participant FS as Firestore Service
    participant DB as Firestore

    C->>API: POST /api/quiz/:quizId/answer
    Note over API: Zodでバリデーション

    API->>FS: getQuiz()
    FS->>DB: quizzes/{quizId}
    DB-->>FS: Quiz
    FS-->>API: Quiz

    Note over API: 正誤判定

    API->>FS: createAnswer()
    FS->>DB: answers/{answerId}

    API->>FS: updateQuizStatus("answered")
    FS->>DB: quizzes/{quizId}

    API->>FS: updateUserStats()
    FS->>DB: users/{accountId}
    Note over DB: totalQuizzes++<br/>correctCount++

    API-->>C: 200 OK (isCorrect, explanation...)
```

---

## コンポーネント構成

```mermaid
graph LR
    subgraph src["src/"]
        INDEX["index.ts<br/>エントリーポイント"]

        subgraph config["config/"]
            ENV["env.ts<br/>環境変数管理"]
        end

        subgraph routes["routes/"]
            QUIZ_ROUTE["quiz.ts<br/>APIエンドポイント"]
        end

        subgraph services["services/"]
            GEMINI_S["gemini.ts<br/>AI連携"]
            FIRESTORE_S["firestore.ts<br/>DB操作"]
        end

        subgraph middleware["middleware/"]
            ERROR_M["error.ts<br/>エラー処理"]
        end

        subgraph utils["utils/"]
            LOGGER_U["logger.ts<br/>ロギング"]
        end

        subgraph types["types/"]
            ENTITIES["entities/<br/>User, Quiz, Answer, MR"]
        end
    end

    INDEX --> ENV
    INDEX --> QUIZ_ROUTE
    INDEX --> ERROR_M
    QUIZ_ROUTE --> GEMINI_S
    QUIZ_ROUTE --> FIRESTORE_S
    QUIZ_ROUTE --> ENTITIES
    GEMINI_S --> ENV
    FIRESTORE_S --> ENV
    FIRESTORE_S --> ENTITIES
    ERROR_M --> LOGGER_U

    style INDEX fill:#90EE90
    style ENV fill:#90EE90
    style QUIZ_ROUTE fill:#90EE90
    style GEMINI_S fill:#90EE90
    style FIRESTORE_S fill:#90EE90
    style ERROR_M fill:#90EE90
    style LOGGER_U fill:#90EE90
    style ENTITIES fill:#90EE90
```

---

## Firestoreコレクション構成

```mermaid
erDiagram
    users {
        string accountId PK
        string platform
        number totalQuizzes
        number correctCount
        timestamp createdAt
        timestamp updatedAt
    }

    mergeRequests {
        string mergeRequestId PK
        string platform
        string owner
        string repo
        number number
        string authorAccountId FK
        string title
        string status
        timestamp createdAt
    }

    quizzes {
        string quizId PK
        string mergeRequestId FK
        string accountId FK
        string questionText
        string category
        string difficulty
        array options
        number correctAnswerIndex
        string explanation
        string status
        timestamp createdAt
    }

    answers {
        string answerId PK
        string quizId FK
        string accountId FK
        string mergeRequestId
        number selectedAnswerIndex
        boolean isCorrect
        string category
        string difficulty
        timestamp answeredAt
    }

    users ||--o{ quizzes : "receives"
    users ||--o{ answers : "submits"
    mergeRequests ||--o{ quizzes : "generates"
    quizzes ||--o| answers : "has"
```

---

## 実装状況サマリ

| フェーズ | 機能 | 状態 |
|---------|------|------|
| Phase 1 | プロジェクトセットアップ | ✅ 完了 |
| Phase 2 | コアインフラ（型定義、ロガー、エラーハンドリング） | ✅ 完了 |
| Phase 3 | US1: クイズ生成・回答（MVP） | ✅ 完了 |
| Phase 4 | US2: パーソナライズ出題 | 📋 予定 |
| Phase 5 | US3: データ可視化 | 📋 予定 |
| Phase 6 | US4: スキップ・リマインド | 📋 予定 |
| Phase 7 | 本番デプロイ（Cloud Run） | 📋 予定 |

---

## 設計メモ

### パーソナライズ機能の実装方針

クイズのパーソナライズ（苦手分野の重点出題）は、**プロンプトベース**で実装する。

```mermaid
flowchart LR
    A[回答履歴\nansewrs collection] --> B[苦手分野分析\nカテゴリ別正答率]
    B --> C[Geminiプロンプト拡張]
    C --> D[パーソナライズされたクイズ]
```

#### 検討した選択肢

| アプローチ | 採用 | 理由 |
|-----------|:----:|------|
| プロンプト調整 | ✅ | シンプル、低コスト、即実装可能 |
| Vertex AI Fine-tuning | ❌ | データ量不足、コスト高、ハッカソン期間に不適 |

#### 将来の検討事項

- ユーザーデータが数千〜数万件に達した場合、Fine-tuningを再検討
- より複雑なパーソナライズパターンが必要になった場合に移行を検討
