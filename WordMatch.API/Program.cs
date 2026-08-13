using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using WordMatch.API.Data;
using WordMatch.API.Features.Auth;
using WordMatch.API.Features.Practice;
using WordMatch.API.Features.Practice.Categories;
using WordMatch.API.Features.Words;
using WordMatch.API.Features.Words.Catalog;

var builder = WebApplication.CreateBuilder(args);

// The API requires a configured PostgreSQL connection before it can start.
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(connectionString))
    throw new InvalidOperationException(
        "Connection string 'DefaultConnection' is missing or empty."
    );

// Register application services in the dependency injection container.
builder.Services.AddDbContext<ApplicationDbContext>(options => options.UseNpgsql(connectionString));
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter())
);

builder
    .Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
    {
        options.User.RequireUniqueEmail = true;
        options.Password.RequiredLength = 8;
        options.Password.RequireUppercase = true;
        options.Password.RequireLowercase = true;
        options.Password.RequireDigit = true;
        options.Password.RequireNonAlphanumeric = false;
        options.Lockout.AllowedForNewUsers = true;
        options.Lockout.MaxFailedAccessAttempts = 5;
        options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
    })
    .AddErrorDescriber<TurkishIdentityErrorDescriber>()
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddDefaultTokenProviders();

builder.Services.ConfigureApplicationCookie(options =>
{
    options.Cookie.Name = builder.Environment.IsDevelopment()
        ? "WordMatch.Auth.Development"
        : "__Host-WordMatch.Auth";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
        ? CookieSecurePolicy.SameAsRequest
        : CookieSecurePolicy.Always;
    options.Cookie.Path = "/";
    options.ExpireTimeSpan = TimeSpan.FromDays(30);
    options.SlidingExpiration = true;
    options.Events.OnRedirectToLogin = context =>
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return Task.CompletedTask;
    };
    options.Events.OnRedirectToAccessDenied = context =>
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        return Task.CompletedTask;
    };
});

builder.Services.AddAuthorization();
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-XSRF-TOKEN";
    options.Cookie.Name = builder.Environment.IsDevelopment()
        ? "WordMatch.XSRF.Development"
        : "__Host-WordMatch.XSRF";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
        ? CookieSecurePolicy.SameAsRequest
        : CookieSecurePolicy.Always;
    options.Cookie.Path = "/";
});
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy(
        "auth",
        context =>
            RateLimitPartition.GetFixedWindowLimiter(
                context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 10,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                }
            )
    );
});

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.ForwardLimit = 1;
    options.KnownIPNetworks.Add(System.Net.IPNetwork.Parse("172.16.0.0/12"));
});

if (!builder.Environment.IsDevelopment())
{
    var keyPath = builder.Configuration["DataProtection:KeyPath"];
    if (string.IsNullOrWhiteSpace(keyPath))
        throw new InvalidOperationException(
            "Data Protection key path is missing. Set DataProtection__KeyPath."
        );

    builder
        .Services.AddDataProtection()
        .SetApplicationName("WordMatch.API.Production")
        .PersistKeysToFileSystem(new DirectoryInfo(keyPath));
}

builder.Services.AddScoped<ICategoryService, CategoryService>();
builder.Services.AddSingleton<PracticeQuestionFactory>();
builder.Services.AddScoped<IPracticeSessionService, PracticeSessionService>();
builder.Services.AddScoped<IWordCatalogService, WordCatalogService>();

// Swagger is used to inspect and test the API during development.
builder.Services.AddEndpointsApiExplorer();

var app = builder.Build();

app.UseForwardedHeaders();

if (app.Configuration.GetValue("Database:AutoMigrate", false))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    await db.Database.MigrateAsync();
}

if (app.Configuration.GetValue("Https:Redirect", false))
{
    app.UseHttpsRedirection();
}

app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();

app.MapAuthEndpoints();
app.MapCategoryEndpoints();
app.MapPracticeSessionEndpoints();
app.MapWordCatalogEndpoints();

app.MapGet(
    "/health",
    async (
        ApplicationDbContext db,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken
    ) =>
    {
        try
        {
            var canConnect = await db.Database.CanConnectAsync(cancellationToken);
            if (canConnect)
                return Results.Ok(new { status = "healthy", database = "healthy" });
        }
        catch (Exception exception)
        {
            loggerFactory
                .CreateLogger("HealthCheck")
                .LogWarning(exception, "Database health check failed.");
        }

        return Results.Json(
            new { status = "unhealthy", database = "unhealthy" },
            statusCode: StatusCodes.Status503ServiceUnavailable
        );
    }
);

app.Run();

public partial class Program;
