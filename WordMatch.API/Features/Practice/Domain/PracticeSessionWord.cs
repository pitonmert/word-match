using WordMatch.API.Features.Words;

namespace WordMatch.API.Features.Practice;

public class PracticeSessionWord
{
    public Guid PracticeSessionId { get; set; }

    public int WordId { get; set; }

    public int Position { get; set; }

    public QuestionDirection Direction { get; set; }

    public QuestionFormat Format { get; set; }

    public required string EnglishSnapshot { get; set; }

    public required string PromptSnapshot { get; set; }

    public required string CorrectAnswerSnapshot { get; set; }

    public string[]? Options { get; set; }

    public int? CorrectIndex { get; set; }

    public string[]? AcceptedAnswersSnapshot { get; set; }

    public int? SelectedIndex { get; set; }

    public string? SelectedText { get; set; }

    public PracticeOutcome? Outcome { get; set; }

    public DateTimeOffset? AnsweredAtUtc { get; set; }

    public PracticeSession PracticeSession { get; set; } = null!;

    public Word Word { get; set; } = null!;
}
