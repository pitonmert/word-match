using Microsoft.AspNetCore.Identity;

namespace WordMatch.API.Features.Auth;

public class ApplicationUser : IdentityUser
{
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}
