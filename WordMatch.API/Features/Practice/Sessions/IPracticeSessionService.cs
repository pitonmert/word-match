using WordMatch.API.Features.Words;

namespace WordMatch.API.Features.Practice;

public interface IPracticeSessionService
{
    Task<PracticeSessionResponse> StartOrResumeAsync(
        string userId,
        StartPracticeRequest request,
        CancellationToken cancellationToken = default
    );

    Task<PracticeSessionResponse> GetAsync(
        string userId,
        Guid sessionId,
        CancellationToken cancellationToken = default
    );

    Task<PracticeResultViewResponse> GetResultsAsync(
        string userId,
        WordLevel level,
        WordTopic topic,
        PracticeMode mode,
        CancellationToken cancellationToken = default
    );

    Task<PracticeAnswerResponse> AnswerAsync(
        string userId,
        Guid sessionId,
        AnswerPracticeRequest request,
        CancellationToken cancellationToken = default
    );
}
