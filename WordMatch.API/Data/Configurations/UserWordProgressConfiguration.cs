using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WordMatch.API.Features.Practice;

namespace WordMatch.API.Data.Configurations;

public sealed class UserWordProgressConfiguration : IEntityTypeConfiguration<UserWordProgress>
{
    public void Configure(EntityTypeBuilder<UserWordProgress> builder)
    {
        builder.HasKey(item => new
        {
            item.UserId,
            item.WordId,
            item.Direction,
            item.Format,
        });
        builder.Property(item => item.Direction).HasConversion<string>();
        builder.Property(item => item.Format).HasConversion<string>();
        builder.Property(item => item.LastOutcome).HasConversion<string>();

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

        builder.ToTable(
            "UserWordProgress",
            tableBuilder =>
            {
                tableBuilder.HasCheckConstraint(
                    "CK_UserWordProgress_Counts",
                    "\"CorrectCount\" >= 0 AND \"ReviewCount\" >= 0 AND \"WrongCount\" >= 0"
                );
                tableBuilder.HasCheckConstraint(
                    "CK_UserWordProgress_Direction",
                    "\"Direction\" IN ('EnglishToTurkish', 'TurkishToEnglish')"
                );
                tableBuilder.HasCheckConstraint(
                    "CK_UserWordProgress_Format",
                    "\"Format\" IN ('MultipleChoice', 'Written')"
                );
                tableBuilder.HasCheckConstraint(
                    "CK_UserWordProgress_LastOutcome",
                    "\"LastOutcome\" IN ('Correct', 'Review', 'Wrong')"
                );
            }
        );
    }
}
