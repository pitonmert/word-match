using WordMatch.API.Features.Practice;
using WordMatch.API.Features.Words;

namespace WordMatch.API.Tests.Features.Practice.Questions;

public class PracticeQuestionFactoryTests
{
    private readonly PracticeQuestionFactory _factory = new();

    [Fact]
    public void CreateQuestionPlan_ForMixedMode_ContainsEveryDirectionAndFormat()
    {
        var words = Enumerable
            .Range(1, 10)
            .Select(index => CreateWord(index, $"WORD_{index}", $"ANLAM_{index}"))
            .ToList();
        var observedWrittenQuestionBeforeChoice = false;

        for (var attempt = 0; attempt < 50; attempt++)
        {
            var plan = _factory.CreateQuestionPlan(PracticeMode.Mixed, words);

            Assert.Equal(words.Count * 4, plan.Count);
            Assert.All(
                words,
                word =>
                {
                    foreach (var direction in Enum.GetValues<QuestionDirection>())
                    {
                        foreach (var format in Enum.GetValues<QuestionFormat>())
                        {
                            Assert.Single(
                                plan,
                                item =>
                                    item.Word.Id == word.Id
                                    && item.Direction == direction
                                    && item.Format == format
                            );
                        }

                        var choicePosition = plan.Select(
                                (item, index) => new { Item = item, Index = index }
                            )
                            .Single(item =>
                                item.Item.Word.Id == word.Id
                                && item.Item.Direction == direction
                                && item.Item.Format == QuestionFormat.MultipleChoice
                            )
                            .Index;
                        var writtenPosition = plan.Select(
                                (item, index) => new { Item = item, Index = index }
                            )
                            .Single(item =>
                                item.Item.Word.Id == word.Id
                                && item.Item.Direction == direction
                                && item.Item.Format == QuestionFormat.Written
                            )
                            .Index;

                        observedWrittenQuestionBeforeChoice |= writtenPosition < choicePosition;
                    }
                }
            );
            Assert.DoesNotContain(
                plan.Zip(plan.Skip(1)),
                pair => pair.First.Word.Id == pair.Second.Word.Id
            );
        }

        Assert.True(observedWrittenQuestionBeforeChoice);
    }

    [Theory]
    [InlineData(PracticeMode.EnglishToTurkish, QuestionDirection.EnglishToTurkish)]
    [InlineData(PracticeMode.TurkishToEnglish, QuestionDirection.TurkishToEnglish)]
    public void CreateQuestionPlan_ForDirectionalMode_ContainsEachWordInBothFormats(
        PracticeMode mode,
        QuestionDirection direction
    )
    {
        var words = Enumerable
            .Range(1, 10)
            .Select(index => CreateWord(index, $"WORD_{index}", $"ANLAM_{index}"))
            .ToList();

        var plan = _factory.CreateQuestionPlan(mode, words);

        Assert.Equal(words.Count * 2, plan.Count);
        Assert.All(plan, item => Assert.Equal(direction, item.Direction));
        Assert.All(
            words,
            word =>
            {
                Assert.Single(
                    plan,
                    item => item.Word.Id == word.Id && item.Format == QuestionFormat.MultipleChoice
                );
                Assert.Single(
                    plan,
                    item => item.Word.Id == word.Id && item.Format == QuestionFormat.Written
                );
            }
        );
        Assert.DoesNotContain(
            plan.Zip(plan.Skip(1)),
            pair => pair.First.Word.Id == pair.Second.Word.Id
        );
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
                "c\u0327ag\u0306rı",
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
        var sessionWord = CreateSessionWord(work, QuestionDirection.TurkishToEnglish, "İŞ");
        var session = new PracticeSession
        {
            UserId = "user",
            Level = WordLevel.A1,
            Topic = WordTopic.JobsAndWork,
            Mode = PracticeMode.TurkishToEnglish,
        };
        session.Words.Add(sessionWord);
        session.Words.Add(CreateSessionWord(job, QuestionDirection.TurkishToEnglish, "MESLEK"));

        var question = _factory.CreateOptions(session, sessionWord, [work, job, cat, book, red]);

        Assert.Equal(4, question.Options.Length);
        Assert.Equal("WORK", question.Options[question.CorrectIndex]);
        Assert.DoesNotContain(
            question.Options,
            option => string.Equals(option, "JOB", StringComparison.OrdinalIgnoreCase)
        );
    }

    private static Word CreateWord(int id, string english, params string[] turkishTranslations)
    {
        return new Word
        {
            Id = id,
            English = english,
            TurkishTranslations = turkishTranslations,
            PartOfSpeech = WordPartOfSpeech.Noun,
            Level = WordLevel.A1,
            Topic = WordTopic.JobsAndWork,
        };
    }

    private static PracticeSessionWord CreateSessionWord(
        Word word,
        QuestionDirection direction,
        string prompt
    )
    {
        return new PracticeSessionWord
        {
            WordId = word.Id,
            Direction = direction,
            EnglishSnapshot = word.English,
            PromptSnapshot = prompt,
            CorrectAnswerSnapshot =
                direction == QuestionDirection.EnglishToTurkish
                    ? string.Join(", ", word.TurkishTranslations)
                    : word.English,
        };
    }
}
