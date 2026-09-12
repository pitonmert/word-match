using WordMatch.API.Features.Auth;
using WordMatch.API.Features.Words;

namespace WordMatch.API.Features.Study;

public class UserWordMastery
{
    public required string UserId { get; set; }

    public int WordId { get; set; }

    public VocabularyMasteryDimension Dimension { get; set; }

    public int Stage { get; set; }

    public int ConsecutiveCorrectCount { get; set; }

    public int CorrectCount { get; set; }

    public int ReviewCount { get; set; }

    public int WrongCount { get; set; }

    public StudyOutcome LastOutcome { get; set; }

    public DateTimeOffset LastStudiedAtUtc { get; set; }

    public DateTimeOffset NextReviewAtUtc { get; set; }

    public ApplicationUser User { get; set; } = null!;

    public Word Word { get; set; } = null!;
}

public enum VocabularyMasteryDimension
{
    WrittenRecognition,
    WrittenRecall,
    AuralRecognition,
    SpokenRecall,
}
