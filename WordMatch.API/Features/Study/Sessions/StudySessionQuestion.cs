using WordMatch.API.Features.Words;

namespace WordMatch.API.Features.Study;

public class StudySessionQuestion
{
    public Guid StudySessionId { get; set; }

    public int Position { get; set; }

    public int WordId { get; set; }

    public VocabularyMasteryDimension Dimension { get; set; }

    public StudyQuestionKind Kind { get; set; }

    public required string EnglishSnapshot { get; set; }

    public required string PromptSnapshot { get; set; }

    public required string CorrectAnswerSnapshot { get; set; }

    public string[]? Options { get; set; }

    public int? CorrectIndex { get; set; }

    public string[]? AcceptedAnswersSnapshot { get; set; }

    public bool IsIntroduction { get; set; }

    public int? SelectedIndex { get; set; }

    public string? SelectedText { get; set; }

    public StudyOutcome? Outcome { get; set; }

    public DateTimeOffset? AnsweredAtUtc { get; set; }

    public StudySession StudySession { get; set; } = null!;

    public Word Word { get; set; } = null!;
}

public enum StudyQuestionKind
{
    MultipleChoice,
    Written,
}

public enum StudyOutcome
{
    Correct,
    Review,
    Wrong,
}
