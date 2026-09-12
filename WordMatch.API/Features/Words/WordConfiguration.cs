using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WordMatch.API.Data.Extensions;

namespace WordMatch.API.Features.Words;

public sealed class WordConfiguration : IEntityTypeConfiguration<Word>
{
    public void Configure(EntityTypeBuilder<Word> builder)
    {
        builder.Property(item => item.ImportKey).HasMaxLength(64);
        builder.Property(item => item.TurkishTranslations).HasColumnType("text[]");
        builder.Property(item => item.PartOfSpeech).HasConversion<string>();
        builder.Property(item => item.Level).HasConversion<string>();
        builder.Property(item => item.Topic).HasConversion<string>();

        builder.HasIndex(item => item.ImportKey).IsUnique();
        builder.HasIndex(item => new { item.English, item.PartOfSpeech }).IsUnique();

        builder.ToTable(
            "Words",
            tableBuilder =>
            {
                tableBuilder.HasCheckConstraint(
                    "CK_Words_ImportKey",
                    "length(trim(\"ImportKey\")) > 0"
                );
                tableBuilder.HasEnumCheckConstraint<WordPartOfSpeech>(nameof(Word.PartOfSpeech));
                tableBuilder.HasEnumCheckConstraint<WordLevel>(nameof(Word.Level));
                tableBuilder.HasEnumCheckConstraint<WordTopic>(nameof(Word.Topic));
                tableBuilder.HasCheckConstraint(
                    "CK_Words_VerbMetadata",
                    "(\"PartOfSpeech\" = 'Verb' AND \"PastSimple\" IS NOT NULL AND \"PastParticiple\" IS NOT NULL) "
                        + "OR (\"PartOfSpeech\" <> 'Verb' AND \"PastSimple\" IS NULL AND \"PastParticiple\" IS NULL AND NOT \"IsIrregular\")"
                );
                tableBuilder.HasCheckConstraint(
                    "CK_Words_TurkishTranslations",
                    "cardinality(\"TurkishTranslations\") > 0 "
                        + "AND array_position(\"TurkishTranslations\", NULL) IS NULL "
                        + "AND array_position(\"TurkishTranslations\", '') IS NULL"
                );
            }
        );
    }
}
