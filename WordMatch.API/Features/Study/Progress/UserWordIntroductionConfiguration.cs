using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace WordMatch.API.Features.Study;

public sealed class UserWordIntroductionConfiguration
    : IEntityTypeConfiguration<UserWordIntroduction>
{
    public void Configure(EntityTypeBuilder<UserWordIntroduction> builder)
    {
        builder.HasKey(item => new { item.UserId, item.WordId });
        builder.HasIndex(item => new { item.UserId, item.IntroducedAtUtc });
        builder
            .HasOne(item => item.User)
            .WithMany()
            .HasForeignKey(item => item.UserId)
            .OnDelete(DeleteBehavior.Cascade);
        builder
            .HasOne(item => item.Word)
            .WithMany()
            .HasForeignKey(item => item.WordId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.ToTable("UserWordIntroductions");
    }
}
