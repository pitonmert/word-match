namespace WordMatch.API.Features.Study;

public class CurriculumTopicWord
{
    public int CurriculumTopicId { get; set; }

    public int WordId { get; set; }

    public int SortOrder { get; set; }

    public int LearningGroupSortOrder { get; set; }

    public CurriculumTopic CurriculumTopic { get; set; } = null!;

    public Words.Word Word { get; set; } = null!;
}
