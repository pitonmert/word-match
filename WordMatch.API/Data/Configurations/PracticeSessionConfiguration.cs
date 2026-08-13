using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WordMatch.API.Features.Practice;

namespace WordMatch.API.Data.Configurations;

public sealed class PracticeSessionConfiguration : IEntityTypeConfiguration<PracticeSession>
{
    public void Configure(EntityTypeBuilder<PracticeSession> builder)
    {
        builder.Property(item => item.Level).HasConversion<string>();
        builder.Property(item => item.Topic).HasConversion<string>();
        builder.Property(item => item.Mode).HasConversion<string>();
        builder.Property(item => item.Status).HasConversion<string>();
        builder
            .HasIndex(item => new
            {
                item.UserId,
                item.Level,
                item.Topic,
            })
            .IsUnique()
            .HasFilter("\"Status\" = 'Active'");

        builder
            .HasOne(item => item.User)
            .WithMany()
            .HasForeignKey(item => item.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.ToTable(
            "PracticeSessions",
            tableBuilder =>
            {
                tableBuilder.HasCheckConstraint(
                    "CK_PracticeSessions_Mode",
                    "\"Mode\" IN ('EnglishToTurkish', 'TurkishToEnglish', 'Mixed')"
                );
                tableBuilder.HasCheckConstraint(
                    "CK_PracticeSessions_Status",
                    "\"Status\" IN ('Active', 'Completed', 'Abandoned')"
                );
            }
        );
    }
}
