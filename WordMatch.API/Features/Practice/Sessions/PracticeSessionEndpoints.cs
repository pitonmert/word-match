using System.Security.Claims;

namespace WordMatch.API.Features.Practice;

public static class PracticeSessionEndpoints
{
    public static RouteGroupBuilder MapPracticeSessionEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/practice-sessions").RequireAuthorization();

        group
            .MapPost(
                "/",
                async (
                    StartPracticeRequest request,
                    ClaimsPrincipal principal,
                    IPracticeSessionService service,
                    CancellationToken cancellationToken
                ) =>
                    await ExecuteAsync(() =>
                        service.StartOrResumeAsync(GetUserId(principal), request, cancellationToken)
                    )
            )
            .AddEndpointFilter<Auth.AntiforgeryValidationFilter>();

        group.MapGet(
            "/{sessionId:guid}",
            async (
                Guid sessionId,
                ClaimsPrincipal principal,
                IPracticeSessionService service,
                CancellationToken cancellationToken
            ) =>
                await ExecuteAsync(() =>
                    service.GetAsync(GetUserId(principal), sessionId, cancellationToken)
                )
        );

        group.MapGet(
            "/results",
            async (
                WordMatch.API.Features.Words.WordLevel level,
                WordMatch.API.Features.Words.WordTopic topic,
                PracticeMode mode,
                ClaimsPrincipal principal,
                IPracticeSessionService service,
                CancellationToken cancellationToken
            ) =>
                await ExecuteAsync(() =>
                    service.GetResultsAsync(
                        GetUserId(principal),
                        level,
                        topic,
                        mode,
                        cancellationToken
                    )
                )
        );

        group
            .MapPost(
                "/{sessionId:guid}/answers",
                async (
                    Guid sessionId,
                    AnswerPracticeRequest request,
                    ClaimsPrincipal principal,
                    IPracticeSessionService service,
                    CancellationToken cancellationToken
                ) =>
                    await ExecuteAsync(() =>
                        service.AnswerAsync(
                            GetUserId(principal),
                            sessionId,
                            request,
                            cancellationToken
                        )
                    )
            )
            .AddEndpointFilter<Auth.AntiforgeryValidationFilter>();

        return group;
    }

    private static string GetUserId(ClaimsPrincipal principal)
    {
        return principal.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("Authenticated user has no identifier.");
    }

    private static async Task<IResult> ExecuteAsync<T>(Func<Task<T>> action)
    {
        return await ExecuteWithErrorsAsync(async () => Results.Ok(await action()));
    }

    private static async Task<IResult> ExecuteWithErrorsAsync(Func<Task<IResult>> action)
    {
        try
        {
            return await action();
        }
        catch (PracticeValidationException exception)
        {
            return Results.BadRequest(new { message = exception.Message });
        }
        catch (PracticeNotFoundException)
        {
            return Results.NotFound();
        }
        catch (PracticeConflictException exception)
        {
            return Results.Conflict(new { message = exception.Message });
        }
    }
}
