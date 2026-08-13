using System.Security.Claims;
using WordMatch.API.Features.Words;

namespace WordMatch.API.Features.Practice.Categories;

public static class CategoryEndpoints
{
    public static RouteGroupBuilder MapCategoryEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/categories").RequireAuthorization();

        group.MapGet(
            "/",
            async (
                ClaimsPrincipal principal,
                ICategoryService categoryService,
                CancellationToken cancellationToken
            ) =>
                Results.Ok(
                    await categoryService.GetCategoriesAsync(
                        principal.FindFirstValue(ClaimTypes.NameIdentifier)!,
                        cancellationToken
                    )
                )
        );

        group
            .MapDelete(
                "/{level}/{topic}/progress",
                async (
                    WordLevel level,
                    WordTopic topic,
                    ClaimsPrincipal principal,
                    ICategoryService categoryService,
                    CancellationToken cancellationToken
                ) =>
                    await categoryService.ResetProgressAsync(
                        GetUserId(principal),
                        level,
                        topic,
                        cancellationToken
                    )
                        ? Results.NoContent()
                        : Results.NotFound()
            )
            .AddEndpointFilter<Auth.AntiforgeryValidationFilter>();

        return group;
    }

    private static string GetUserId(ClaimsPrincipal principal)
    {
        return principal.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("Authenticated user has no identifier.");
    }
}
