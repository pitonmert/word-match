using System.Text.Json.Serialization;

namespace WordMatch.API.Features.Study;

public sealed record StartStudySessionRequest(
    [property: JsonRequired] StudySessionMode Mode,
    int? CurriculumTopicId = null,
    bool ReplaceActiveSession = false
);

public sealed record AnswerStudyQuestionRequest(
    int Position,
    int WordId,
    int? SelectedIndex,
    string? WrittenAnswer = null
);

public sealed record DeferStudySkillRequest(
    [property: JsonRequired] VocabularyMasteryDimension Dimension
);
