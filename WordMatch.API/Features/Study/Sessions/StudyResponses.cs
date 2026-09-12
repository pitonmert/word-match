using WordMatch.API.Features.Words;

namespace WordMatch.API.Features.Study;

public sealed record StudyTopicResponse(
    int Id,
    WordLevel Level,
    WordTopic Topic,
    int IntroducedWordCount,
    int RecognitionWordCount,
    int WordCount,
    bool IsCompleted
);

public sealed record StudyLevelResponse(WordLevel Level, IReadOnlyList<StudyTopicResponse> Topics);

public sealed record StudyNextActionResponse(
    StudyNextActionKind Kind,
    Guid? SessionId,
    StudyTopicResponse? Topic
);

public enum StudyNextActionKind
{
    Resume,
    StartTopic,
    Unavailable,
}

public sealed record StudyOverviewResponse(
    StudyTopicResponse? CurriculumTopic,
    bool CurriculumCompleted,
    int ReviewQuestionCount,
    StudyNextActionResponse? NextAction,
    IReadOnlyList<StudyLevelResponse> Levels
);

public sealed record StudyQuestionResponse(
    int Position,
    int WordId,
    VocabularyMasteryDimension Dimension,
    StudyQuestionKind Kind,
    string Prompt,
    IReadOnlyList<string> Options,
    bool IsIntroduction
);

public sealed record StudyProgressResponse(
    int AnsweredCount,
    int TotalCount,
    int CorrectCount,
    int ReviewCount,
    int WrongCount
);

public sealed record StudyResultItemResponse(
    int WordId,
    VocabularyMasteryDimension Dimension,
    string Prompt,
    string CorrectAnswer,
    string? SelectedAnswer,
    StudyOutcome Outcome,
    bool IsIntroduction
);

public sealed record StudySummaryResponse(
    int IntroducedWordCount,
    int StrengthenedWordCount,
    DateTimeOffset? NextReviewAtUtc,
    bool TopicCompleted,
    int ReviewQuestionCount,
    bool CanContinue,
    IReadOnlyList<StudyResultItemResponse> Results
);

public sealed record StudySessionResponse(
    Guid SessionId,
    StudySessionStatus Status,
    StudySessionMode Mode,
    StudyTopicResponse? Topic,
    StudyProgressResponse Progress,
    StudyQuestionResponse? Question,
    StudySummaryResponse Summary
);

public sealed record StudyAnswerResponse(
    StudyOutcome Outcome,
    int? CorrectIndex,
    int? SelectedIndex,
    string? WrittenAnswer,
    string CorrectAnswer,
    bool IsComplete,
    StudySessionResponse Session
);

public sealed record StartStudySessionResult(bool IsCreated, StudySessionResponse Session);
