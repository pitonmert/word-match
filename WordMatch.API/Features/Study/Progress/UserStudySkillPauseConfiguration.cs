using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WordMatch.API.Data.Extensions;

namespace WordMatch.API.Features.Study;

public sealed class UserStudySkillPauseConfiguration : IEntityTypeConfiguration<UserStudySkillPause>
{
    public void Configure(EntityTypeBuilder<UserStudySkillPause> builder)
    {
        builder.HasKey(item => new { item.UserId, item.Dimension });
        builder.Property(item => item.Dimension).HasConversion<string>();
        builder.HasIndex(item => item.DeferredUntilUtc);
        builder
            .HasOne(item => item.User)
            .WithMany()
            .HasForeignKey(item => item.UserId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.ToTable(
            "UserStudySkillPauses",
            tableBuilder =>
                tableBuilder.HasEnumCheckConstraint<VocabularyMasteryDimension>(
                    nameof(UserStudySkillPause.Dimension)
                )
        );
    }
}
