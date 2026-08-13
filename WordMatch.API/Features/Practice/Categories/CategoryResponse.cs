using WordMatch.API.Features.Practice;

namespace WordMatch.API.Features.Practice.Categories;

public sealed record CategoryModeResponse(
    PracticeMode Mode,
    int CompletedQuestionCount,
    int TotalQuestionCount,
    Guid? ActiveSessionId,
    int ActiveAnsweredCount,
    int ActiveTotalCount,
    bool IsReplay
);

public sealed record CategoryOptionResponse(
    string Value,
    string Label,
    int WordCount,
    int CompletedQuestionCount,
    int TotalQuestionCount,
    CategoryProgressStatus Status,
    IReadOnlyList<CategoryModeResponse> Modes
);

public sealed record LevelCategoryResponse(
    string Value,
    string Label,
    int WordCount,
    IReadOnlyList<CategoryOptionResponse> Topics
);

public sealed record CategoryResponse(IReadOnlyList<LevelCategoryResponse> Levels);
