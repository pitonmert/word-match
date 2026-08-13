using Microsoft.AspNetCore.Antiforgery;

namespace WordMatch.API.Features.Auth;

public sealed class AntiforgeryValidationFilter(IAntiforgery antiforgery) : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(
        EndpointFilterInvocationContext context,
        EndpointFilterDelegate next
    )
    {
        try
        {
            await antiforgery.ValidateRequestAsync(context.HttpContext);
        }
        catch (AntiforgeryValidationException)
        {
            return Results.BadRequest(
                new { message = "İstek doğrulama anahtarı eksik veya geçersiz." }
            );
        }

        return await next(context);
    }
}
