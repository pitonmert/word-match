using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WordMatch.API.Data.Extensions;

namespace WordMatch.API.Features.Study;

public sealed class StudySessionQuestionConfiguration
    : IEntityTypeConfiguration<StudySessionQuestion>
{
    public void Configure(EntityTypeBuilder<StudySessionQuestion> builder)
    {
        builder.HasKey(item => new { item.StudySessionId, item.Position });
        builder
            .HasIndex(item => new
            {
                item.StudySessionId,
                item.WordId,
                item.Dimension,
            })
            .IsUnique();
        builder.Property(item => item.Dimension).HasConversion<string>();
        builder.Property(item => item.Kind).HasConversion<string>();
        builder.Property(item => item.Options).HasColumnType("text[]");
        builder.Property(item => item.AcceptedAnswersSnapshot).HasColumnType("text[]");
        builder.Property(item => item.Outcome).HasConversion<string>();
        builder
            .HasOne(item => item.StudySession)
            .WithMany(item => item.Questions)
            .HasForeignKey(item => item.StudySessionId)
            .OnDelete(DeleteBehavior.Cascade);
        builder
            .HasOne(item => item.Word)
            .WithMany()
            .HasForeignKey(item => item.WordId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.ToTable(
            "StudySessionQuestions",
            tableBuilder =>
            {
                tableBuilder.HasCheckConstraint(
                    "CK_StudySessionQuestions_Position",
                    "\"Position\" >= 0"
                );
                tableBuilder.HasEnumCheckConstraint<VocabularyMasteryDimension>(
                    nameof(StudySessionQuestion.Dimension)
                );
                tableBuilder.HasEnumCheckConstraint<StudyQuestionKind>(
                    nameof(StudySessionQuestion.Kind)
                );
                tableBuilder.HasCheckConstraint(
                    "CK_StudySessionQuestions_QuestionData",
                    "(\"Kind\" = 'MultipleChoice' AND \"Options\" IS NOT NULL AND cardinality(\"Options\") = 4 AND \"CorrectIndex\" IS NOT NULL AND \"CorrectIndex\" >= 0 AND \"CorrectIndex\" < 4 AND \"AcceptedAnswersSnapshot\" IS NULL) OR (\"Kind\" = 'Written' AND \"Options\" IS NULL AND \"CorrectIndex\" IS NULL AND \"AcceptedAnswersSnapshot\" IS NOT NULL AND cardinality(\"AcceptedAnswersSnapshot\") > 0)"
                );
                tableBuilder.HasCheckConstraint(
                    "CK_StudySessionQuestions_Answer",
                    "(\"Outcome\" IS NULL AND \"SelectedIndex\" IS NULL AND \"SelectedText\" IS NULL AND \"AnsweredAtUtc\" IS NULL) OR (\"Outcome\" = 'Review' AND \"SelectedIndex\" IS NULL AND \"SelectedText\" IS NULL AND \"AnsweredAtUtc\" IS NOT NULL) OR (\"Kind\" = 'MultipleChoice' AND \"Outcome\" IN ('Correct', 'Wrong') AND \"SelectedIndex\" IS NOT NULL AND \"SelectedText\" IS NULL AND \"AnsweredAtUtc\" IS NOT NULL) OR (\"Kind\" = 'Written' AND \"Outcome\" IN ('Correct', 'Wrong') AND \"SelectedIndex\" IS NULL AND \"SelectedText\" IS NOT NULL AND length(trim(\"SelectedText\")) > 0 AND \"AnsweredAtUtc\" IS NOT NULL)"
                );
            }
        );
    }
}
