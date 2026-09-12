<!--
BELGE KAPSAMI

AMAÇ:
Projenin sürümler arasındaki önemli ve kullanıcı açısından anlamlı
değişikliklerini kronolojik olarak belgelemek.

DAHİL:
- Unreleased ve yayımlanmış sürümlerdeki kayda değer değişiklikler
- Added / Changed / Deprecated / Removed / Fixed / Security kategorileri
- Breaking değişiklikler ve gerektiğinde kısa upgrade etkisi
- Sürüm numarası ve yayın tarihi

DAHİL DEĞİL:
- Ham git commit geçmişi
- Her küçük refactor veya dahili bakım işi
- Gelecek planları → ROADMAP.md
- Mimari açıklamalar → ARCHITECTURE.md
- Uzun kullanım veya migration rehberleri

KURAL:
Changelog bir commit dökümü değildir. Yalnızca okuyucunun bilmesi gereken
kayda değer değişiklikleri, Keep a Changelog yapısına uygun şekilde belgeleyin.
-->

# Changelog

Bu projedeki tüm önemli değişiklikler bu dosyada belgelenir.

Biçim [Keep a Changelog](https://keepachangelog.com/en/2.0.0/) standardına
dayanır ve proje [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
kullanır.

## [Unreleased]

## [v0.2.0](https://github.com/pitonmert/word-match/releases/tag/v0.2.0) - 2026-09-12

### Added

- Added an idempotent content bootstrap command backed by stable CSV
  `ImportKey` values, preserving existing word relationships during
  legacy-data adoption. Establishes an explicit 700-word curriculum across 66
  ordered topics.
- Added an authenticated Study API with server-authoritative question
  snapshots, two active written mastery dimensions and a fixed review schedule.
- Added explicit `LearningGroupSortOrder` data to curriculum word links.

### Changed

- Changed topic Study sessions to complete the selected topic's first
  unfinished learning group without a fixed question cap: all words are first
  asked with written recognition, then the same words are asked in shuffled
  written recall order. A word and its topic progress only complete after both
  directions have been answered. Separate review sessions remain capped at ten
  and contain only due, previously answered word–dimension pairs.
- Added a two-layer topic progress bar: completed words use the primary fill,
  while words answered only through written recognition appear as a muted
  leading fill.
- Changed the start screen into a plain page outside the fixed question card,
  showing the next action, its topic progress, `Konu değiştir` and
  `Devam et`. The long level/topic list opens in its own dialog. The
  question screen keeps the fixed question-card design.
- Changed `/` from a category-selection hub into the Study home; the active
  session now lives at `/session/{sessionId}`.
- Changed curriculum progress to derive from the two written mastery records
  of each word. A word completed in an early selected topic is shared with the
  ordered curriculum and is not introduced again later.
- Moved the theme control into the account menu with icon-only light and dark
  choices.
- Changed the word catalog into a user-independent read-only list. The
  per-word "last result" column and its filter are gone until the mastery view
  replaces them.
- Changed API container validation to require `Content/Words.csv` in publish
  output.
- Merged the separate word-content and curriculum-membership bootstrap
  sources into a single `Words.csv`; each row now carries a word and its
  package placement together, so a word can no longer exist outside a
  package. The `bootstrap words` and `bootstrap curriculum` commands became
  one `bootstrap words` command.
- Removed the bootstrap-time locks that froze a package's order, level, and
  word membership once user progress existed. Progress is tracked entirely
  per word (`UserWordMastery`, `UserWordIntroduction` carry no
  `CurriculumUnitId`), so re-curating package structure never affects a
  user's existing standing — content, including package placement, is now
  always freely editable.

- Added `POST /api/study-sessions/{id}/deferrals`, which pauses one skill for
  10 minutes. It finishes the current session without recording unanswered
  questions; the next session is planned without that skill and no mastery or
  review-date change is made.
- Added `POST /api/study-sessions/continue`. It resumes an active session
  before starting new work, while explicit topic changes require confirmation
  before replacing that active session.
- Added an explicit `Retired` state for curriculum topics dropped from the
  content source. Retired topics disappear from planning and topic selection
  while their word links, user progress and answered session snapshots are
  preserved.

### Fixed

- Fixed starting a Study session on two devices at the same time returning a
  server error. The unique index that keeps a user to one active session is now
  honoured; only the device that started the session can continue it.
- Fixed a cross-device race after completion: the device viewing results keeps
  its `Devam et` right until it continues or returns home, so another device
  cannot start a competing Study session in between.
- Added an explicit `Bu cihazdan devam et` action for an authenticated second
  device to take over active work or an open result continuation immediately.

### Removed

- **Breaking.** Replaced the package curriculum with a `Level → ordered Topic
→ ordered word` spine. `CurriculumUnit`/`CurriculumUnitWord` and the
  `UnitTitle` concept are gone; a topic's identity is its `(Level, Topic)`
  pair and headings such as `A1 · Hayvanlar` are derived rather than stored.
  Topic order is now explicit data in `Words.csv` (`TopicSortOrder`,
  `WordSortOrder`, `LearningGroupSortOrder`) instead of being derived at runtime from the `WordTopic`
  enum's declaration order. The 700 words now sit in 66 topics.
- **Breaking.** Removed the study-type and skill selection from the start
  screen along with `StudyPath` (`Guided`/`Discovery`) and `StudyFocus`. There
  is one Study flow: the system opens the learner's current curriculum topic
  and `Konu değiştir` picks another one without creating a separate mode or
  path. Skill dimensions remain in the backend and the mastery model; only the
  selection layer is gone.
- **Breaking.** Collapsed the migrations into a new `InitialCreate` for the
  topic curriculum. `CurriculumUnits`, `CurriculumUnitWords`,
  `StudySessions.Path`, `StudySessions.Focus` and `UserWordIntroductions.Path`
  no longer exist; databases must be rebuilt and repopulated with the
  bootstrap command.
- **Breaking.** Removed the category-based Practice flow: the `/api/categories`
  and `/api/practice-sessions` endpoints, the `/practice` routes, and the
  `PracticeSessions`, `PracticeSessionWords` and `UserWordProgress` tables.
  Study is now the only learning flow and `UserWordMastery` the only progress
  ledger.
- **Breaking.** Collapsed the twenty incremental EF Core migrations into a
  new `InitialCreate` for the common introduction model. The clean test
  database was dropped and rebuilt in place; it must be repopulated with the
  bootstrap command.

## [v0.1.0](https://github.com/pitonmert/word-match/releases/tag/v0.1.0) - 2026-08-13

### Added

- Published the initial public baseline for WordMatch.
- See [README.md](README.md) for project overview, architecture, setup, and usage details.
