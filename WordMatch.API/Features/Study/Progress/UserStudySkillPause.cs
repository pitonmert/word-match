using WordMatch.API.Features.Auth;

namespace WordMatch.API.Features.Study;

public class UserStudySkillPause
{
    public required string UserId { get; set; }

    public VocabularyMasteryDimension Dimension { get; set; }

    public DateTimeOffset DeferredUntilUtc { get; set; }

    public ApplicationUser User { get; set; } = null!;
}
