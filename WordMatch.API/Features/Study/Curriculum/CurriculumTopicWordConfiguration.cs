using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace WordMatch.API.Features.Study;

public sealed class CurriculumTopicWordConfiguration : IEntityTypeConfiguration<CurriculumTopicWord>
{
    public void Configure(EntityTypeBuilder<CurriculumTopicWord> builder)
    {
        builder.HasKey(item => new { item.CurriculumTopicId, item.WordId });
        builder.Property(item => item.LearningGroupSortOrder).HasDefaultValue(1);

        builder.HasIndex(item => item.WordId).IsUnique();
        builder.HasIndex(item => new { item.CurriculumTopicId, item.SortOrder }).IsUnique();
        builder.HasIndex(item => new { item.CurriculumTopicId, item.LearningGroupSortOrder });

        builder
            .HasOne(item => item.CurriculumTopic)
            .WithMany(item => item.Words)
            .HasForeignKey(item => item.CurriculumTopicId)
            .OnDelete(DeleteBehavior.Cascade);
        builder
            .HasOne(item => item.Word)
            .WithMany()
            .HasForeignKey(item => item.WordId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.ToTable(
            "CurriculumTopicWords",
            tableBuilder =>
            {
                tableBuilder.HasCheckConstraint(
                    "CK_CurriculumTopicWords_SortOrder",
                    "\"SortOrder\" > 0"
                );
                tableBuilder.HasCheckConstraint(
                    "CK_CurriculumTopicWords_LearningGroupSortOrder",
                    "\"LearningGroupSortOrder\" > 0"
                );
            }
        );
    }
}
