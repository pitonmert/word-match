namespace WordMatch.API.Features.Study;

public sealed class StudyDeviceIdentity(IWebHostEnvironment environment)
{
    private const string DevelopmentCookieName = "WordMatch.StudyDevice.Development";
    private const string ProductionCookieName = "__Host-WordMatch.StudyDevice";
    private const string ResolvedDeviceItemKey = "wordmatch.study-device-id";

    private readonly string _cookieName = environment.IsDevelopment()
        ? DevelopmentCookieName
        : ProductionCookieName;

    public string GetOrCreateDeviceId(HttpContext context)
    {
        if (
            context.Items.TryGetValue(ResolvedDeviceItemKey, out var cached)
            && cached is string value
        )
            return value;

        var deviceId =
            context.Request.Cookies.TryGetValue(_cookieName, out var existing)
            && Guid.TryParse(existing, out var parsed)
                ? parsed
                : IssueDeviceCookie(context);

        value = deviceId.ToString("N");
        context.Items[ResolvedDeviceItemKey] = value;
        return value;
    }

    private Guid IssueDeviceCookie(HttpContext context)
    {
        var deviceId = Guid.NewGuid();
        context.Response.Cookies.Append(
            _cookieName,
            deviceId.ToString("N"),
            new CookieOptions
            {
                HttpOnly = true,
                SameSite = SameSiteMode.Lax,
                Secure = !environment.IsDevelopment(),
                Path = "/",
                IsEssential = true,
                Expires = DateTimeOffset.UtcNow.AddYears(2),
            }
        );
        return deviceId;
    }
}
