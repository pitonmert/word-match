using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WordMatch.API.Features.Practice;

namespace WordMatch.API.Data.Configurations;

public sealed class PracticeSessionWordConfiguration : IEntityTypeConfiguration<PracticeSessionWord>
{
    public void Configure(EntityTypeBuilder<PracticeSessionWord> builder)
    {
        builder.HasKey(item => new { item.PracticeSessionId, item.Position });
        builder
            .HasIndex(item => new
            {
                item.PracticeSessionId,
                item.WordId,
                item.Direction,
                item.Format,
            })
            .IsUnique();
        builder.Property(item => item.Direction).HasConversion<string>();
        builder.Property(item => item.Format).HasConversion<string>();
        builder.Property(item => item.Options).HasColumnType("text[]");
        builder.Property(item => item.AcceptedAnswersSnapshot).HasColumnType("text[]");
        builder.Property(item => item.Outcome).HasConversion<string>();

        builder
            .HasOne(item => item.PracticeSession)
            .WithMany(item => item.Words)
            .HasForeignKey(item => item.PracticeSessionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder
            .HasOne(item => item.Word)
            .WithMany()
            .HasForeignKey(item => item.WordId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.ToTable(
            "PracticeSessionWords",
            tableBuilder =>
            {
                tableBuilder.HasCheckConstraint(
                    "CK_PracticeSessionWords_Answer",
                    "(\"Outcome\" IS NULL AND \"SelectedIndex\" IS NULL AND \"SelectedText\" IS NULL AND \"AnsweredAtUtc\" IS NULL) "
                        + "OR (\"Outcome\" = 'Review' AND \"SelectedIndex\" IS NULL AND \"SelectedText\" IS NULL AND \"AnsweredAtUtc\" IS NOT NULL) "
                        + "OR (\"Format\" = 'MultipleChoice' AND \"Outcome\" IN ('Correct', 'Wrong') AND \"SelectedIndex\" IS NOT NULL AND \"SelectedText\" IS NULL AND \"AnsweredAtUtc\" IS NOT NULL) "
                        + "OR (\"Format\" = 'Written' AND \"Outcome\" IN ('Correct', 'Wrong') AND \"SelectedIndex\" IS NULL AND \"SelectedText\" IS NOT NULL AND length(trim(\"SelectedText\")) > 0 AND \"AnsweredAtUtc\" IS NOT NULL)"
                );
                tableBuilder.HasCheckConstraint(
                    "CK_PracticeSessionWords_Direction",
                    "\"Direction\" IN ('EnglishToTurkish', 'TurkishToEnglish')"
                );
                tableBuilder.HasCheckConstraint(
                    "CK_PracticeSessionWords_Format",
                    "\"Format\" IN ('MultipleChoice', 'Written')"
                );
                tableBuilder.HasCheckConstraint(
                    "CK_PracticeSessionWords_QuestionData",
                    "(\"Format\" = 'MultipleChoice' AND \"AcceptedAnswersSnapshot\" IS NULL "
                        + "AND ((\"Options\" IS NULL AND \"CorrectIndex\" IS NULL) "
                        + "OR (\"Options\" IS NOT NULL AND \"CorrectIndex\" IS NOT NULL "
                        + "AND cardinality(\"Options\") = 4 AND \"CorrectIndex\" >= 0 "
                        + "AND \"CorrectIndex\" < cardinality(\"Options\")))) "
                        + "OR (\"Format\" = 'Written' AND \"Options\" IS NULL AND \"CorrectIndex\" IS NULL "
                        + "AND \"AcceptedAnswersSnapshot\" IS NOT NULL "
                        + "AND cardinality(\"AcceptedAnswersSnapshot\") > 0)"
                );
                tableBuilder.HasCheckConstraint(
                    "CK_PracticeSessionWords_Prompt",
                    "length(trim(\"PromptSnapshot\")) > 0"
                );
            }
        );
    }
}
