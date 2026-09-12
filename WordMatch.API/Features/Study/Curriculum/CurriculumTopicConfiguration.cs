using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WordMatch.API.Data.Extensions;
using WordMatch.API.Features.Words;

namespace WordMatch.API.Features.Study;

public sealed class CurriculumTopicConfiguration : IEntityTypeConfiguration<CurriculumTopic>
{
    public void Configure(EntityTypeBuilder<CurriculumTopic> builder)
    {
        builder.Property(item => item.Level).HasConversion<string>();
        builder.Property(item => item.Topic).HasConversion<string>();
        builder.Property(item => item.Status).HasConversion<string>();

        builder.HasIndex(item => new { item.Level, item.Topic }).IsUnique();
        builder.HasIndex(item => new { item.Level, item.SortOrder }).IsUnique();

        builder.ToTable(
            "CurriculumTopics",
            tableBuilder =>
            {
                tableBuilder.HasEnumCheckConstraint<WordLevel>(nameof(CurriculumTopic.Level));
                tableBuilder.HasEnumCheckConstraint<WordTopic>(nameof(CurriculumTopic.Topic));
                tableBuilder.HasEnumCheckConstraint<CurriculumTopicStatus>(
                    nameof(CurriculumTopic.Status)
                );
                tableBuilder.HasCheckConstraint(
                    "CK_CurriculumTopics_SortOrder",
                    "\"SortOrder\" > 0"
                );
            }
        );
    }
}
