using WordMatch.API.Features.Study;
using WordMatch.API.Features.Words;

namespace WordMatch.API.Tests.Features.Study.Questions;

public class QuestionFactoryTests
{
    private readonly QuestionFactory _factory = new();

    [Fact]
    public void CreateOptions_PrefersSameTopicThenSameLevelCandidates()
    {
        var target = CreateWord(1, "TARGET", "HEDEF");
        var sameTopic = CreateWord(2, "TOPIC", "KONU");
        var sameLevelOne = CreateWord(3, "LEVEL_ONE", "SEVİYE_BİR", WordTopic.Animals);
        var sameLevelTwo = CreateWord(4, "LEVEL_TWO", "SEVİYE_İKİ", WordTopic.Animals);
        var catalogCandidate = CreateWord(
            5,
            "CATALOG",
            ["KATALOG"],
            WordLevel.B2,
            WordTopic.Colors
        );
        var allWords = new[] { target, sameTopic, sameLevelOne, sameLevelTwo, catalogCandidate };

        var question = CreateOptionsForWord(target, QuestionDirection.EnglishToTurkish, allWords);

        var wrongOptions = question
            .Options.Where((_, index) => index != question.CorrectIndex)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        Assert.Equal(["KONU", "SEVİYE_BİR", "SEVİYE_İKİ"], wrongOptions);
    }

    [Fact]
    public void CreateOptions_FallsBackToCatalogWhenTopicAndLevelCandidatesAreInsufficient()
    {
        var target = CreateWord(1, "TARGET", "HEDEF");
        var sameTopic = CreateWord(2, "TOPIC", "KONU");
        var sameLevel = CreateWord(3, "LEVEL", "SEVİYE", WordTopic.Animals);
        var catalogCandidate = CreateWord(
            4,
            "CATALOG",
            ["KATALOG"],
            WordLevel.B2,
            WordTopic.Colors
        );
        var allWords = new[] { target, sameTopic, sameLevel, catalogCandidate };

        var question = CreateOptionsForWord(target, QuestionDirection.EnglishToTurkish, allWords);

        Assert.Contains("KONU", question.Options, StringComparer.OrdinalIgnoreCase);
        Assert.Contains("SEVİYE", question.Options, StringComparer.OrdinalIgnoreCase);
        Assert.Contains("KATALOG", question.Options, StringComparer.OrdinalIgnoreCase);
    }

    [Fact]
    public void CreateOptions_ForEveryCsvWordAndDirection_ProducesFourDistinctChoices()
    {
        var words = LoadWordsFromCsv();

        Assert.NotEmpty(words);

        foreach (var word in words)
        {
            foreach (var direction in Enum.GetValues<QuestionDirection>())
            {
                var snapshot = _factory.CreateSnapshot(
                    word,
                    direction,
                    QuestionFormat.MultipleChoice,
                    words
                );
                var question = _factory.CreateOptions(
                    word.English,
                    direction,
                    snapshot.CorrectAnswer,
                    words,
                    [
                        words.Where(candidate => candidate.Topic == word.Topic),
                        words.Where(candidate => candidate.Level == word.Level),
                        words,
                    ]
                );
                var comparer =
                    direction == QuestionDirection.EnglishToTurkish
                        ? StringComparer.Create(
                            System.Globalization.CultureInfo.GetCultureInfo("tr-TR"),
                            true
                        )
                        : StringComparer.OrdinalIgnoreCase;

                Assert.Equal(4, question.Options.Length);
                Assert.InRange(question.CorrectIndex, 0, question.Options.Length - 1);
                Assert.Equal(
                    snapshot.CorrectAnswer,
                    question.Options[question.CorrectIndex],
                    comparer
                );
                Assert.Equal(4, question.Options.Distinct(comparer).Count());
            }
        }
    }

    [Fact]
    public void CreateSnapshot_SelectsTheLeastAmbiguousTurkishPrompt()
    {
        var work = CreateWord(1, "WORK", "İŞ", "ÇALIŞMAK");
        var job = CreateWord(2, "JOB", "İŞ", "MESLEK");

        var snapshot = _factory.CreateSnapshot(
            work,
            QuestionDirection.TurkishToEnglish,
            QuestionFormat.MultipleChoice,
            [work, job]
        );

        Assert.Equal("ÇALIŞMAK", snapshot.Prompt);
        Assert.Equal("WORK", snapshot.CorrectAnswer);
    }

    [Fact]
    public void CreateSnapshot_ForWrittenQuestion_AcceptsSharedEnglishMeanings()
    {
        var work = CreateWord(1, "WORK", "İŞ");
        var job = CreateWord(2, "JOB", "İŞ");

        var snapshot = _factory.CreateSnapshot(
            work,
            QuestionDirection.TurkishToEnglish,
            QuestionFormat.Written,
            [work, job]
        );

        Assert.Equal("İŞ", snapshot.Prompt);
        var acceptedAnswers = Assert.IsType<string[]>(snapshot.AcceptedAnswers);
        Assert.Equal(["WORK", "JOB"], acceptedAnswers);
        Assert.True(
            _factory.IsWrittenAnswerCorrect(
                QuestionDirection.TurkishToEnglish,
                "  job  ",
                acceptedAnswers
            )
        );
    }

    [Fact]
    public void IsWrittenAnswerCorrect_NormalizesTurkishCaseWhitespaceAndUnicode()
    {
        Assert.True(
            _factory.IsWrittenAnswerCorrect(
                QuestionDirection.EnglishToTurkish,
                "  PAZAR  ",
                ["Pazar"]
            )
        );
        Assert.True(
            _factory.IsWrittenAnswerCorrect(
                QuestionDirection.EnglishToTurkish,
                "c\u0327ag\u0306r\u0131",
                ["çağrı"]
            )
        );
        Assert.False(
            _factory.IsWrittenAnswerCorrect(QuestionDirection.EnglishToTurkish, "cagri", ["çağrı"])
        );
    }

    [Fact]
    public void CreateOptions_DoesNotUseAnEnglishWordThatSharesTheTurkishMeaning()
    {
        var work = CreateWord(1, "WORK", "İŞ");
        var job = CreateWord(2, "JOB", "İŞ", "MESLEK");
        var cat = CreateWord(3, "CAT", "KEDİ");
        var book = CreateWord(4, "BOOK", "KİTAP");
        var red = CreateWord(5, "RED", "KIRMIZI");
        var allWords = new[] { work, job, cat, book, red };

        var question = _factory.CreateOptions(
            work.English,
            QuestionDirection.TurkishToEnglish,
            work.English,
            allWords,
            [allWords]
        );

        Assert.Equal(4, question.Options.Length);
        Assert.Equal("WORK", question.Options[question.CorrectIndex]);
        Assert.DoesNotContain(
            question.Options,
            option => string.Equals(option, "JOB", StringComparison.OrdinalIgnoreCase)
        );
    }

    [Fact]
    public void CreateOptions_WhenFourDistinctAnswersAreImpossible_Throws()
    {
        var work = CreateWord(1, "WORK", "İŞ");
        var job = CreateWord(2, "JOB", "İŞ");
        var allWords = new[] { work, job };

        Assert.Throws<QuestionValidationException>(() =>
            _factory.CreateOptions(
                work.English,
                QuestionDirection.EnglishToTurkish,
                "İŞ",
                allWords,
                [allWords]
            )
        );
    }

    private GeneratedQuestion CreateOptionsForWord(
        Word word,
        QuestionDirection direction,
        IReadOnlyCollection<Word> allWords
    )
    {
        var snapshot = _factory.CreateSnapshot(
            word,
            direction,
            QuestionFormat.MultipleChoice,
            allWords
        );

        return _factory.CreateOptions(
            word.English,
            direction,
            snapshot.CorrectAnswer,
            allWords,
            [
                allWords.Where(candidate => candidate.Topic == word.Topic),
                allWords.Where(candidate => candidate.Level == word.Level),
                allWords,
            ]
        );
    }

    private static Word CreateWord(int id, string english, params string[] turkishTranslations)
    {
        return CreateWord(id, english, turkishTranslations, WordLevel.A1, WordTopic.JobsAndWork);
    }

    private static Word CreateWord(
        int id,
        string english,
        string turkishTranslation,
        WordLevel level
    )
    {
        return CreateWord(id, english, [turkishTranslation], level, WordTopic.JobsAndWork);
    }

    private static Word CreateWord(
        int id,
        string english,
        string turkishTranslation,
        WordTopic topic
    )
    {
        return CreateWord(id, english, [turkishTranslation], WordLevel.A1, topic);
    }

    private static Word CreateWord(
        int id,
        string english,
        string[] turkishTranslations,
        WordLevel level,
        WordTopic topic
    )
    {
        return new Word
        {
            Id = id,
            English = english,
            TurkishTranslations = turkishTranslations,
            PartOfSpeech = WordPartOfSpeech.Noun,
            Level = level,
            Topic = topic,
        };
    }

    private static IReadOnlyList<Word> LoadWordsFromCsv()
    {
        var csvPath = FindRepositoryFile("WordMatch.API", "Content", "Words.csv");
        var rows = ParseCsv(File.ReadAllText(csvPath));

        Assert.Equal(
            [
                "ImportKey",
                "English",
                "TurkishTranslations",
                "PartOfSpeech",
                "PastSimple",
                "PastParticiple",
                "IsIrregular",
                "Level",
                "Topic",
                "TopicSortOrder",
                "WordSortOrder",
                "LearningGroupSortOrder",
            ],
            rows[0]
        );

        return rows.Skip(1)
            .Select(
                (row, index) =>
                    new Word
                    {
                        Id = index + 1,
                        ImportKey = row[0],
                        English = row[1],
                        TurkishTranslations = ParsePostgresTextArray(row[2]),
                        PartOfSpeech = Enum.Parse<WordPartOfSpeech>(row[3]),
                        PastSimple = string.IsNullOrEmpty(row[4]) ? null : row[4],
                        PastParticiple = string.IsNullOrEmpty(row[5]) ? null : row[5],
                        IsIrregular = bool.Parse(row[6]),
                        Level = Enum.Parse<WordLevel>(row[7]),
                        Topic = Enum.Parse<WordTopic>(row[8]),
                    }
            )
            .ToList();
    }

    private static string FindRepositoryFile(params string[] pathSegments)
    {
        for (
            var directory = new DirectoryInfo(AppContext.BaseDirectory);
            directory is not null;
            directory = directory.Parent
        )
        {
            var candidate = Path.Combine([directory.FullName, .. pathSegments]);
            if (File.Exists(candidate))
                return candidate;
        }

        throw new FileNotFoundException(
            "Repository file could not be located.",
            Path.Combine(pathSegments)
        );
    }

    private static List<string[]> ParseCsv(string csv)
    {
        var rows = new List<string[]>();
        var row = new List<string>();
        var field = new System.Text.StringBuilder();
        var inQuotedField = false;

        for (var index = 0; index < csv.Length; index++)
        {
            var character = csv[index];
            if (character == '"')
            {
                if (inQuotedField && index + 1 < csv.Length && csv[index + 1] == '"')
                {
                    field.Append(character);
                    index++;
                }
                else
                {
                    inQuotedField = !inQuotedField;
                }

                continue;
            }

            if (character == ',' && !inQuotedField)
            {
                row.Add(field.ToString());
                field.Clear();
                continue;
            }

            if (character == '\n' && !inQuotedField)
            {
                row.Add(field.ToString().TrimEnd('\r'));
                rows.Add([.. row]);
                row.Clear();
                field.Clear();
                continue;
            }

            field.Append(character);
        }

        if (field.Length > 0 || row.Count > 0)
        {
            row.Add(field.ToString());
            rows.Add([.. row]);
        }

        return rows;
    }

    private static string[] ParsePostgresTextArray(string value)
    {
        Assert.StartsWith("{", value);
        Assert.EndsWith("}", value);

        return ParseCsv(value[1..^1]).Single();
    }
}
