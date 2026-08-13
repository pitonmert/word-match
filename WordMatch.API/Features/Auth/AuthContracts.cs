namespace WordMatch.API.Features.Auth;

public sealed record RegisterRequest(string Email, string Username, string Password);

public sealed record LoginRequest(string Identifier, string Password);

public sealed record AuthSessionResponse(string UserId, string Email, string Username);
