using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Identity;

namespace WordMatch.API.Features.Auth;

public static partial class AuthEndpoints
{
    private const int MinimumUsernameLength = 3;
    private const int MaximumUsernameLength = 30;

    [GeneratedRegex("^[A-Za-z0-9._-]+$")]
    private static partial Regex UsernamePattern();

    public static RouteGroupBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth");

        group.MapGet(
            "/antiforgery",
            (IAntiforgery antiforgery, HttpContext context) =>
            {
                var tokens = antiforgery.GetAndStoreTokens(context);
                return Results.Ok(new { token = tokens.RequestToken });
            }
        );

        group
            .MapGet(
                "/session",
                async (ClaimsPrincipal principal, UserManager<ApplicationUser> userManager) =>
                {
                    var user = await userManager.GetUserAsync(principal);
                    return user is null ? Results.Unauthorized() : Results.Ok(ToResponse(user));
                }
            )
            .RequireAuthorization();

        group
            .MapPost(
                "/register",
                async (
                    RegisterRequest request,
                    UserManager<ApplicationUser> userManager,
                    SignInManager<ApplicationUser> signInManager
                ) =>
                {
                    var validationErrors = ValidateRegistration(request);
                    if (validationErrors.Count > 0)
                        return Results.ValidationProblem(validationErrors);

                    var user = new ApplicationUser
                    {
                        Email = request.Email?.Trim(),
                        UserName = request.Username?.Trim(),
                    };

                    var result = await userManager.CreateAsync(user, request.Password);
                    if (!result.Succeeded)
                        return Results.ValidationProblem(ToValidationErrors(result.Errors));

                    await signInManager.SignInAsync(user, isPersistent: true);
                    return Results.Ok(ToResponse(user));
                }
            )
            .RequireRateLimiting("auth")
            .AddEndpointFilter<AntiforgeryValidationFilter>();

        group
            .MapPost(
                "/login",
                async (
                    LoginRequest request,
                    UserManager<ApplicationUser> userManager,
                    SignInManager<ApplicationUser> signInManager
                ) =>
                {
                    if (
                        string.IsNullOrWhiteSpace(request.Identifier)
                        || string.IsNullOrWhiteSpace(request.Password)
                    )
                    {
                        return Results.ValidationProblem(
                            new Dictionary<string, string[]>
                            {
                                ["credentials"] =
                                [
                                    "E-posta veya kullanıcı adı ile parola gereklidir.",
                                ],
                            }
                        );
                    }

                    var identifier = request.Identifier.Trim();
                    var user = identifier.Contains('@')
                        ? await userManager.FindByEmailAsync(identifier)
                        : await userManager.FindByNameAsync(identifier);

                    if (user is null)
                        return Results.Unauthorized();

                    var result = await signInManager.PasswordSignInAsync(
                        user,
                        request.Password,
                        isPersistent: true,
                        lockoutOnFailure: true
                    );

                    return result.Succeeded ? Results.Ok(ToResponse(user)) : Results.Unauthorized();
                }
            )
            .RequireRateLimiting("auth")
            .AddEndpointFilter<AntiforgeryValidationFilter>();

        group
            .MapPost(
                "/logout",
                async (SignInManager<ApplicationUser> signInManager) =>
                {
                    await signInManager.SignOutAsync();
                    return Results.NoContent();
                }
            )
            .RequireAuthorization()
            .AddEndpointFilter<AntiforgeryValidationFilter>();

        return group;
    }

    private static Dictionary<string, string[]> ValidateRegistration(RegisterRequest request)
    {
        var errors = new Dictionary<string, string[]>();
        var email = request.Email?.Trim() ?? string.Empty;
        var username = request.Username?.Trim() ?? string.Empty;

        if (string.IsNullOrWhiteSpace(email) || !new EmailAddressAttribute().IsValid(email))
            errors["email"] = ["Geçerli bir e-posta adresi girin."];

        if (
            username.Length < MinimumUsernameLength
            || username.Length > MaximumUsernameLength
            || !UsernamePattern().IsMatch(username)
        )
        {
            errors["username"] =
            [
                "Kullanıcı adı 3-30 karakter olmalı ve yalnızca harf, rakam, nokta, alt çizgi veya kısa çizgi içermelidir.",
            ];
        }

        if (string.IsNullOrWhiteSpace(request.Password))
            errors["password"] = ["Parola gereklidir."];

        return errors;
    }

    private static Dictionary<string, string[]> ToValidationErrors(
        IEnumerable<IdentityError> errors
    )
    {
        return errors
            .GroupBy(error => error.Code)
            .ToDictionary(
                group => group.Key,
                group => group.Select(error => error.Description).ToArray()
            );
    }

    private static AuthSessionResponse ToResponse(ApplicationUser user)
    {
        return new AuthSessionResponse(user.Id, user.Email ?? string.Empty, user.UserName ?? "");
    }
}
