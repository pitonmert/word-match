using WordMatch.API.Features.Auth;
using WordMatch.API.Features.Words;

namespace WordMatch.API.Features.Practice;

public class UserWordProgress
{
    public required string UserId { get; set; }

    public int WordId { get; set; }

    public QuestionDirection Direction { get; set; }

    public QuestionFormat Format { get; set; }

    public int CorrectCount { get; set; }

    public int ReviewCount { get; set; }

    public int WrongCount { get; set; }

    public PracticeOutcome LastOutcome { get; set; }

    public DateTimeOffset LastAnsweredAtUtc { get; set; }

    public ApplicationUser User { get; set; } = null!;

    public Word Word { get; set; } = null!;
}
