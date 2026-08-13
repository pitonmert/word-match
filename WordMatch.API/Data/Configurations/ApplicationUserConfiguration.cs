using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WordMatch.API.Features.Auth;

namespace WordMatch.API.Data.Configurations;

public sealed class ApplicationUserConfiguration : IEntityTypeConfiguration<ApplicationUser>
{
    public void Configure(EntityTypeBuilder<ApplicationUser> builder)
    {
        builder.HasIndex(item => item.NormalizedEmail).HasDatabaseName("EmailIndex").IsUnique();
    }
}
