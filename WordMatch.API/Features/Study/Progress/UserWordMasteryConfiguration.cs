using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WordMatch.API.Data.Extensions;

namespace WordMatch.API.Features.Study;

public sealed class UserWordMasteryConfiguration : IEntityTypeConfiguration<UserWordMastery>
{
    public void Configure(EntityTypeBuilder<UserWordMastery> builder)
    {
        builder.HasKey(item => new
        {
            item.UserId,
            item.WordId,
            item.Dimension,
        });
        builder.Property(item => item.Dimension).HasConversion<string>();
        builder.Property(item => item.LastOutcome).HasConversion<string>();
        builder.HasIndex(item => new { item.UserId, item.NextReviewAtUtc });
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
            "UserWordMastery",
            tableBuilder =>
            {
                tableBuilder.HasCheckConstraint(
                    "CK_UserWordMastery_Counts",
                    "\"CorrectCount\" >= 0 AND \"ReviewCount\" >= 0 AND \"WrongCount\" >= 0 AND \"ConsecutiveCorrectCount\" >= 0"
                );
                tableBuilder.HasCheckConstraint(
                    "CK_UserWordMastery_Stage",
                    "\"Stage\" >= 0 AND \"Stage\" <= 5"
                );
                tableBuilder.HasEnumCheckConstraint<VocabularyMasteryDimension>(
                    nameof(UserWordMastery.Dimension)
                );
                tableBuilder.HasEnumCheckConstraint<StudyOutcome>(
                    nameof(UserWordMastery.LastOutcome),
                    "CK_UserWordMastery_Outcome"
                );
            }
        );
    }
}
