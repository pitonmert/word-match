using WordMatch.API.Features.Auth;
using WordMatch.API.Features.Words;

namespace WordMatch.API.Features.Study;

public class UserWordIntroduction
{
    public required string UserId { get; set; }

    public int WordId { get; set; }

    public DateTimeOffset IntroducedAtUtc { get; set; }

    public ApplicationUser User { get; set; } = null!;

    public Word Word { get; set; } = null!;
}
