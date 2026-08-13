using WordMatch.API.Features.Words;

namespace WordMatch.API.Features.Practice;

public sealed record PracticeQuestionResponse(
    int Position,
    int WordId,
    QuestionDirection Direction,
    QuestionFormat Format,
    string Prompt,
    IReadOnlyList<string> Options,
    int? CorrectIndex,
    IReadOnlyList<string> AcceptedAnswers
);

public sealed record PracticeProgressResponse(
    int AnsweredCount,
    int TotalCount,
    int CorrectCount,
    int ReviewCount,
    int WrongCount
);

public sealed record PracticeResultWordResponse(
    int WordId,
    QuestionDirection Direction,
    QuestionFormat Format,
    string Prompt,
    string CorrectAnswer,
    string? SelectedAnswer
);

public sealed record PracticeResultsResponse(
    IReadOnlyList<PracticeResultWordResponse> Correct,
    IReadOnlyList<PracticeResultWordResponse> Review,
    IReadOnlyList<PracticeResultWordResponse> Wrong
);

public sealed record PracticeResultViewResponse(
    WordLevel Level,
    WordTopic Topic,
    PracticeMode Mode,
    PracticeProgressResponse Progress,
    PracticeResultsResponse Results
);

public sealed record PracticeSessionResponse(
    Guid SessionId,
    PracticeSessionStatus Status,
    WordLevel Level,
    WordTopic Topic,
    PracticeMode Mode,
    PracticeProgressResponse Progress,
    PracticeQuestionResponse? Question,
    IReadOnlyList<PracticeQuestionResponse> UpcomingQuestions,
    PracticeResultsResponse Results
);

public sealed record PracticeAnswerResponse(
    PracticeOutcome Outcome,
    int? CorrectIndex,
    int? SelectedIndex,
    string? WrittenAnswer,
    string CorrectAnswer,
    PracticeProgressResponse Progress,
    bool IsComplete,
    PracticeSessionResponse Session
);
