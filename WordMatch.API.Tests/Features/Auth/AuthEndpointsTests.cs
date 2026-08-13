using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using WordMatch.API.Tests.Infrastructure;

namespace WordMatch.API.Tests.Features.Auth;

public class AuthEndpointsTests(WordMatchApiFactory factory) : IClassFixture<WordMatchApiFactory>
{
    private static int _clientNumber;

    [Fact]
    public async Task ProtectedEndpoints_ReturnUnauthorizedWithoutLogin()
    {
        using var client = CreateIsolatedClient();

        var categories = await client.GetAsync("/api/categories");
        var words = await client.GetAsync("/api/words");

        Assert.Equal(HttpStatusCode.Unauthorized, categories.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, words.StatusCode);
    }

    [Fact]
    public async Task Register_CreatesPersistentAuthenticatedSession()
    {
        using var client = CreateIsolatedClient();
        var suffix = Guid.NewGuid().ToString("N");

        var response = await PostWithAntiforgeryAsync(
            client,
            "/api/auth/register",
            new
            {
                email = $"user-{suffix}@example.com",
                username = $"user-{suffix[..12]}",
                password = "Password1",
            }
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var session = await client.GetAsync("/api/auth/session");
        Assert.Equal(HttpStatusCode.OK, session.StatusCode);
        var recoveredSession = await session.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(recoveredSession.TryGetProperty("automaticallyLoadNextQuestion", out _));
        Assert.False(recoveredSession.TryGetProperty("defaultPracticeMode", out _));
    }

    [Fact]
    public async Task Register_WithoutAntiforgeryToken_ReturnsBadRequest()
    {
        using var client = CreateIsolatedClient();
        var credentials = CreateCredentials();

        var response = await client.PostAsJsonAsync(
            "/api/auth/register",
            new
            {
                credentials.Email,
                credentials.Username,
                credentials.Password,
            }
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Register_RejectsCaseInsensitiveDuplicateEmail()
    {
        var credentials = CreateCredentials();
        using var firstClient = CreateIsolatedClient();
        using var secondClient = CreateIsolatedClient();
        await RegisterAsync(firstClient, credentials);

        var response = await PostWithAntiforgeryAsync(
            secondClient,
            "/api/auth/register",
            new
            {
                email = credentials.Email.ToUpperInvariant(),
                username = $"other-{Guid.NewGuid():N}"[..18],
                credentials.Password,
            }
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>();
        var duplicateEmailErrors = problem
            .GetProperty("errors")
            .GetProperty("DuplicateEmail")
            .EnumerateArray()
            .Select(error => error.GetString())
            .ToArray();
        Assert.Contains(
            duplicateEmailErrors,
            error => error?.Contains("e-posta adresi zaten kullanılıyor.") == true
        );
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Login_AcceptsEmailOrUsername(bool useEmail)
    {
        var credentials = CreateCredentials();
        using var registrationClient = CreateIsolatedClient();
        using var loginClient = CreateIsolatedClient();
        await RegisterAsync(registrationClient, credentials);

        var response = await PostWithAntiforgeryAsync(
            loginClient,
            "/api/auth/login",
            new
            {
                identifier = useEmail ? credentials.Email : credentials.Username,
                credentials.Password,
            }
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(
            HttpStatusCode.OK,
            (await loginClient.GetAsync("/api/auth/session")).StatusCode
        );
    }

    [Fact]
    public async Task Logout_InvalidatesAuthenticatedSession()
    {
        using var client = CreateIsolatedClient();
        await RegisterAsync(client, CreateCredentials());

        var logoutResponse = await PostWithAntiforgeryAsync(client, "/api/auth/logout", new { });
        var sessionResponse = await client.GetAsync("/api/auth/session");

        Assert.Equal(HttpStatusCode.NoContent, logoutResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, sessionResponse.StatusCode);
    }

    [Fact]
    public async Task Login_LocksAccountAfterFiveFailedAttempts()
    {
        var credentials = CreateCredentials();
        using var registrationClient = CreateIsolatedClient();
        using var loginClient = CreateIsolatedClient();
        await RegisterAsync(registrationClient, credentials);

        for (var attempt = 0; attempt < 5; attempt++)
        {
            var failure = await PostWithAntiforgeryAsync(
                loginClient,
                "/api/auth/login",
                new { identifier = credentials.Username, password = "WrongPassword1" }
            );
            Assert.Equal(HttpStatusCode.Unauthorized, failure.StatusCode);
        }

        var lockedResponse = await PostWithAntiforgeryAsync(
            loginClient,
            "/api/auth/login",
            new { identifier = credentials.Username, credentials.Password }
        );

        Assert.Equal(HttpStatusCode.Unauthorized, lockedResponse.StatusCode);
    }

    [Fact]
    public async Task AuthRateLimit_ReturnsTooManyRequestsAfterPermitLimit()
    {
        using var client = CreateIsolatedClient();

        HttpResponseMessage? lastResponse = null;
        for (var attempt = 0; attempt < 11; attempt++)
        {
            lastResponse = await PostWithAntiforgeryAsync(
                client,
                "/api/auth/login",
                new { identifier = $"missing-{Guid.NewGuid():N}", password = "Password1" }
            );
        }

        Assert.NotNull(lastResponse);
        Assert.Equal(HttpStatusCode.TooManyRequests, lastResponse.StatusCode);
    }

    [Fact]
    public async Task AuthRateLimit_IsIsolatedByForwardedClientIp()
    {
        using var limitedClient = CreateIsolatedClient();
        using var otherClient = CreateIsolatedClient();

        for (var attempt = 0; attempt < 10; attempt++)
        {
            var response = await PostWithAntiforgeryAsync(
                limitedClient,
                "/api/auth/login",
                new { identifier = $"missing-{Guid.NewGuid():N}", password = "Password1" }
            );
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        var limitedResponse = await PostWithAntiforgeryAsync(
            limitedClient,
            "/api/auth/login",
            new { identifier = "still-missing", password = "Password1" }
        );
        var otherResponse = await PostWithAntiforgeryAsync(
            otherClient,
            "/api/auth/login",
            new { identifier = "also-missing", password = "Password1" }
        );

        Assert.Equal(HttpStatusCode.TooManyRequests, limitedResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, otherResponse.StatusCode);
    }

    private async Task RegisterAsync(HttpClient client, TestCredentials credentials)
    {
        var response = await PostWithAntiforgeryAsync(
            client,
            "/api/auth/register",
            new
            {
                credentials.Email,
                credentials.Username,
                credentials.Password,
            }
        );
        response.EnsureSuccessStatusCode();
    }

    private static async Task<HttpResponseMessage> PostWithAntiforgeryAsync<T>(
        HttpClient client,
        string path,
        T body
    )
    {
        var tokenResponse = await client.GetFromJsonAsync<JsonElement>("/api/auth/antiforgery");
        var request = new HttpRequestMessage(HttpMethod.Post, path)
        {
            Content = JsonContent.Create(body),
        };
        request.Headers.Add("X-XSRF-TOKEN", tokenResponse.GetProperty("token").GetString());
        return await client.SendAsync(request);
    }

    private static TestCredentials CreateCredentials()
    {
        var suffix = Guid.NewGuid().ToString("N");
        return new TestCredentials(
            $"user-{suffix}@example.com",
            $"user-{suffix[..12]}",
            "Password1"
        );
    }

    private HttpClient CreateIsolatedClient()
    {
        var client = factory.CreateClient();
        var clientNumber = Interlocked.Increment(ref _clientNumber);
        client.DefaultRequestHeaders.Add(
            "X-Forwarded-For",
            $"10.{clientNumber / 65536 % 256}.{clientNumber / 256 % 256}.{clientNumber % 256}"
        );
        return client;
    }

    private sealed record TestCredentials(string Email, string Username, string Password);
}
