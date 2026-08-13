using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WordMatch.API.Features.Words;

namespace WordMatch.API.Data.Configurations;

public sealed class WordConfiguration : IEntityTypeConfiguration<Word>
{
    public void Configure(EntityTypeBuilder<Word> builder)
    {
        builder.Property(item => item.TurkishTranslations).HasColumnType("text[]");
        builder.Property(item => item.PartOfSpeech).HasConversion<string>();
        builder.Property(item => item.Level).HasConversion<string>();
        builder.Property(item => item.Topic).HasConversion<string>();

        builder.HasIndex(item => new { item.English, item.PartOfSpeech }).IsUnique();

        builder.ToTable(
            "Words",
            tableBuilder =>
            {
                tableBuilder.HasCheckConstraint(
                    "CK_Words_PartOfSpeech",
                    "\"PartOfSpeech\" IN ('Verb', 'Noun', 'Adjective', 'ProperNoun', 'Number', 'Pronoun')"
                );
                tableBuilder.HasCheckConstraint(
                    "CK_Words_Level",
                    "\"Level\" IN ('A1', 'A2', 'B1', 'B2')"
                );
                tableBuilder.HasCheckConstraint(
                    "CK_Words_Topic",
                    "\"Topic\" IN ('Actions', 'Animals', 'ArtsAndEntertainment', 'BodyAndHealth', 'CalendarAndTime', 'Clothing', 'Colors', 'Countries', 'Days', 'Descriptions', 'Education', 'EmotionsAndPersonality', 'FamilyAndPeople', 'FoodAndDrink', 'General', 'HomeAndObjects', 'JobsAndWork', 'Months', 'NatureAndWeather', 'Numbers', 'Places', 'ShoppingAndMoney', 'SocietyAndPolitics', 'SportsAndLeisure', 'TechnologyAndMedia', 'Transportation', 'TravelAndHolidays')"
                );
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
