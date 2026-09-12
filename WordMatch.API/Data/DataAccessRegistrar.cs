using Microsoft.EntityFrameworkCore;

namespace WordMatch.API.Data;

public static class DataAccessRegistrar
{
    public static IHostApplicationBuilder AddDataAccess(this IHostApplicationBuilder builder)
    {
        builder.Services.AddDbContext<ApplicationDbContext>(options =>
            ConfigureNpgsql(options, builder.Configuration)
        );

        return builder;
    }

    internal static void ConfigureNpgsql(
        DbContextOptionsBuilder options,
        IConfiguration configuration
    ) => options.UseNpgsql(ResolveConnectionString(configuration));

    private static string ResolveConnectionString(IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection");
        if (string.IsNullOrWhiteSpace(connectionString))
            throw new InvalidOperationException(
                $"Connection string 'DefaultConnection' is missing or empty. "
                    + "Configure it with User Secrets or environment variables."
            );

        return connectionString;
    }
}
