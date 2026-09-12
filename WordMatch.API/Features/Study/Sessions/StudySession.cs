using WordMatch.API.Features.Auth;

namespace WordMatch.API.Features.Study;

public class StudySession
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public required string UserId { get; set; }

    public string? OwnerDeviceId { get; set; }

    public StudySessionMode Mode { get; set; }

    public int? CurriculumTopicId { get; set; }

    public int? ReturnToCurriculumTopicId { get; set; }

    public StudySessionStatus Status { get; set; } = StudySessionStatus.Active;

    public DateTimeOffset StartedAtUtc { get; set; }

    public DateTimeOffset LastActivityAtUtc { get; set; }

    public DateTimeOffset? CompletedAtUtc { get; set; }

    public DateTimeOffset? ContinuationReservedAtUtc { get; set; }

    public ApplicationUser User { get; set; } = null!;

    public CurriculumTopic? CurriculumTopic { get; set; }

    public CurriculumTopic? ReturnToCurriculumTopic { get; set; }

    public ICollection<StudySessionQuestion> Questions { get; } = new List<StudySessionQuestion>();
}

public enum StudySessionMode
{
    Topic,
    Review,
}

public enum StudySessionStatus
{
    Active,
    Completed,
    Abandoned,
}
