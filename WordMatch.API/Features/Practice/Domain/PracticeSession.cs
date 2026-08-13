using WordMatch.API.Features.Auth;
using WordMatch.API.Features.Words;

namespace WordMatch.API.Features.Practice;

public class PracticeSession
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public required string UserId { get; set; }

    public WordLevel Level { get; set; }

    public WordTopic Topic { get; set; }

    public PracticeMode Mode { get; set; }

    public bool IsReplay { get; set; }

    public PracticeSessionStatus Status { get; set; } = PracticeSessionStatus.Active;

    public DateTimeOffset StartedAtUtc { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset LastActivityAtUtc { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? CompletedAtUtc { get; set; }

    public ApplicationUser User { get; set; } = null!;

    public ICollection<PracticeSessionWord> Words { get; } = new List<PracticeSessionWord>();
}
