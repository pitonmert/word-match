using System.Security.Claims;
using WordMatch.API.Security;

namespace WordMatch.API.Features.Study;

public static class StudyEndpoints
{
    public static IEndpointRouteBuilder MapStudyEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet(
                "/api/study",
                async (
                    ClaimsPrincipal principal,
                    StudyService service,
                    CancellationToken cancellationToken
                ) =>
                    await ExecuteAsync(() =>
                        service.GetOverviewAsync(GetUserId(principal), cancellationToken)
                    )
            )
            .RequireAuthorization();

        var sessions = app.MapGroup("/api/study-sessions").RequireAuthorization();
        sessions
            .MapPost(
                "/continue",
                async (
                    ClaimsPrincipal principal,
                    StudyService service,
                    CancellationToken cancellationToken
                ) =>
                    await ExecuteResultAsync(async () =>
                    {
                        var result = await service.ContinueAsync(
                            GetUserId(principal),
                            cancellationToken
                        );
                        return result.IsCreated
                            ? Results.Created(
                                $"/api/study-sessions/{result.Session.SessionId}",
                                result.Session
                            )
                            : Results.Ok(result.Session);
                    })
            )
            .AddEndpointFilter<AntiforgeryValidationFilter>();

        sessions
            .MapPost(
                "/takeover",
                async (
                    ClaimsPrincipal principal,
                    StudyService service,
                    CancellationToken cancellationToken
                ) =>
                    await ExecuteAsync(() =>
                        service.TakeOverAsync(GetUserId(principal), cancellationToken)
                    )
            )
            .AddEndpointFilter<AntiforgeryValidationFilter>();

        sessions
            .MapPost(
                "/{sessionId:guid}/continue",
                async (
                    Guid sessionId,
                    ClaimsPrincipal principal,
                    StudyService service,
                    CancellationToken cancellationToken
                ) =>
                    await ExecuteResultAsync(async () =>
                    {
                        var result = await service.ContinueAfterCompletionAsync(
                            GetUserId(principal),
                            sessionId,
                            cancellationToken
                        );
                        return Results.Created(
                            $"/api/study-sessions/{result.Session.SessionId}",
                            result.Session
                        );
                    })
            )
            .AddEndpointFilter<AntiforgeryValidationFilter>();

        sessions
            .MapPost(
                "/",
                async (
                    StartStudySessionRequest request,
                    ClaimsPrincipal principal,
                    StudyService service,
                    CancellationToken cancellationToken
                ) =>
                    await ExecuteResultAsync(async () =>
                    {
                        var result = await service.StartOrResumeAsync(
                            GetUserId(principal),
                            request,
                            cancellationToken
                        );
                        return result.IsCreated
                            ? Results.Created(
                                $"/api/study-sessions/{result.Session.SessionId}",
                                result.Session
                            )
                            : Results.Ok(result.Session);
                    })
            )
            .AddEndpointFilter<AntiforgeryValidationFilter>();

        sessions.MapGet(
            "/{sessionId:guid}",
            async (
                Guid sessionId,
                ClaimsPrincipal principal,
                StudyService service,
                CancellationToken cancellationToken
            ) =>
                await ExecuteAsync(() =>
                    service.GetAsync(GetUserId(principal), sessionId, cancellationToken)
                )
        );

        sessions
            .MapPost(
                "/{sessionId:guid}/answers",
                async (
                    Guid sessionId,
                    AnswerStudyQuestionRequest request,
                    ClaimsPrincipal principal,
                    StudyService service,
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
            .AddEndpointFilter<AntiforgeryValidationFilter>();

        sessions
            .MapPost(
                "/{sessionId:guid}/deferrals",
                async (
                    Guid sessionId,
                    DeferStudySkillRequest request,
                    ClaimsPrincipal principal,
                    StudyService service,
                    CancellationToken cancellationToken
                ) =>
                    await ExecuteAsync(() =>
                        service.DeferSkillAsync(
                            GetUserId(principal),
                            sessionId,
                            request,
                            cancellationToken
                        )
                    )
            )
            .AddEndpointFilter<AntiforgeryValidationFilter>();

        sessions
            .MapDelete(
                "/{sessionId:guid}",
                async (
                    Guid sessionId,
                    ClaimsPrincipal principal,
                    StudyService service,
                    CancellationToken cancellationToken
                ) =>
                    await ExecuteResultAsync(async () =>
                    {
                        await service.AbandonAsync(
                            GetUserId(principal),
                            sessionId,
                            cancellationToken
                        );
                        return Results.NoContent();
                    })
            )
            .AddEndpointFilter<AntiforgeryValidationFilter>();

        return app;
    }

    private static string GetUserId(ClaimsPrincipal principal) =>
        principal.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new InvalidOperationException("Authenticated user has no identifier.");

    private static Task<IResult> ExecuteAsync<T>(Func<Task<T>> action) =>
        ExecuteResultAsync(async () => Results.Ok(await action()));

    private static async Task<IResult> ExecuteResultAsync(Func<Task<IResult>> action)
    {
        try
        {
            return await action();
        }
        catch (StudyValidationException exception)
        {
            return Results.BadRequest(new { message = exception.Message });
        }
        catch (StudyNotFoundException)
        {
            return Results.NotFound();
        }
        catch (StudyConflictException exception)
        {
            return Results.Conflict(new { message = exception.Message, code = exception.Code });
        }
    }
}
