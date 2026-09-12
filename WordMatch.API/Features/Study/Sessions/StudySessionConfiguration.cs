using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WordMatch.API.Data.Extensions;

namespace WordMatch.API.Features.Study;

public sealed class StudySessionConfiguration : IEntityTypeConfiguration<StudySession>
{
    public void Configure(EntityTypeBuilder<StudySession> builder)
    {
        builder.Property(item => item.Mode).HasConversion<string>();
        builder.Property(item => item.Status).HasConversion<string>();
        builder.Property(item => item.OwnerDeviceId).HasMaxLength(32);
        builder.HasIndex(item => item.UserId).IsUnique().HasFilter("\"Status\" = 'Active'");
        builder
            .HasIndex(item => new { item.UserId, item.ContinuationReservedAtUtc })
            .HasFilter("\"ContinuationReservedAtUtc\" IS NOT NULL");
        builder
            .HasOne(item => item.User)
            .WithMany()
            .HasForeignKey(item => item.UserId)
            .OnDelete(DeleteBehavior.Cascade);
        builder
            .HasOne(item => item.CurriculumTopic)
            .WithMany()
            .HasForeignKey(item => item.CurriculumTopicId)
            .OnDelete(DeleteBehavior.Restrict);
        builder
            .HasOne(item => item.ReturnToCurriculumTopic)
            .WithMany()
            .HasForeignKey(item => item.ReturnToCurriculumTopicId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.ToTable(
            "StudySessions",
            tableBuilder =>
            {
                tableBuilder.HasEnumCheckConstraint<StudySessionMode>(nameof(StudySession.Mode));
                tableBuilder.HasEnumCheckConstraint<StudySessionStatus>(
                    nameof(StudySession.Status)
                );
                tableBuilder.HasCheckConstraint(
                    "CK_StudySessions_ModeSelection",
                    "(\"Mode\" = 'Topic' AND \"CurriculumTopicId\" IS NOT NULL) "
                        + "OR (\"Mode\" = 'Review' AND \"CurriculumTopicId\" IS NULL)"
                );
            }
        );
    }
}
