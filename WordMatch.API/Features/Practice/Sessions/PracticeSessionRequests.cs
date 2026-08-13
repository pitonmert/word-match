using System.Text.Json.Serialization;
using WordMatch.API.Features.Words;

namespace WordMatch.API.Features.Practice;

public sealed record StartPracticeRequest(
    [property: JsonRequired] WordLevel Level,
    [property: JsonRequired] WordTopic Topic,
    [property: JsonRequired] PracticeMode Mode,
    bool Replay = false
);

public sealed record AnswerPracticeRequest(
    int Position,
    int WordId,
    int? SelectedIndex,
    string? WrittenAnswer = null
);
