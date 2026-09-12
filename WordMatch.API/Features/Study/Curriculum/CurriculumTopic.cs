using WordMatch.API.Features.Words;

namespace WordMatch.API.Features.Study;

public class CurriculumTopic
{
    public int Id { get; set; }

    public WordLevel Level { get; set; }

    public WordTopic Topic { get; set; }

    public int SortOrder { get; set; }

    public CurriculumTopicStatus Status { get; set; } = CurriculumTopicStatus.Active;

    public ICollection<CurriculumTopicWord> Words { get; } = new List<CurriculumTopicWord>();
}

public enum CurriculumTopicStatus
{
    Active,
    Retired,
}
