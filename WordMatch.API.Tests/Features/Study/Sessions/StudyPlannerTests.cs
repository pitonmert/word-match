using WordMatch.API.Features.Study;
using WordMatch.API.Features.Words;

namespace WordMatch.API.Tests.Features.Study.Sessions;

public class StudyPlannerTests
{
    private static readonly DateTimeOffset Now = new(2026, 8, 14, 12, 0, 0, TimeSpan.Zero);
    private static readonly HashSet<VocabularyMasteryDimension> NoDeferrals = [];
    private static readonly HashSet<StudyQuestionKey> NoQuestionExclusions = [];

    [Fact]
    public void TopicSessionPlansBothRoundsForTheFirstIncompleteLearningGroup()
    {
        var words = CreateCandidates(10, groupSize: 5);

        var plan = new StudyPlanner().CreateTopicPlan(
            words.OrderByDescending(item => item.WordSortOrder).ToList(),
            NoQuestionExclusions,
            NoDeferrals,
            NoQuestionExclusions
        );

        Assert.Equal(10, plan.Count);
        Assert.All(plan, item => Assert.True(item.IsIntroduction));
        Assert.Equal(Enumerable.Range(1, 5), plan.Take(5).Select(item => item.Word.Id));
        Assert.All(
            plan.Take(5),
            item => Assert.Equal(VocabularyMasteryDimension.WrittenRecognition, item.Dimension)
        );
        Assert.All(
            plan.Skip(5),
            item => Assert.Equal(VocabularyMasteryDimension.WrittenRecall, item.Dimension)
        );
        Assert.Equal(Enumerable.Range(1, 5), plan.Skip(5).Select(item => item.Word.Id).Order());
        Assert.DoesNotContain(plan, item => item.Word.Id > 5);
    }

    [Fact]
    public void SevenWordLearningGroupIsNotCutToTheReviewSessionLimit()
    {
        var plan = new StudyPlanner().CreateTopicPlan(
            CreateCandidates(7, groupSize: 7),
            NoQuestionExclusions,
            NoDeferrals,
            NoQuestionExclusions
        );

        Assert.Equal(14, plan.Count);
        Assert.Equal(
            7,
            plan.Count(item => item.Dimension == VocabularyMasteryDimension.WrittenRecognition)
        );
        Assert.Equal(
            7,
            plan.Count(item => item.Dimension == VocabularyMasteryDimension.WrittenRecall)
        );
    }

    [Fact]
    public void CompletedFirstGroupAdvancesToTheNextExplicitGroup()
    {
        var words = CreateCandidates(10, groupSize: 5);
        var answered = words
            .Where(item => item.LearningGroupSortOrder == 1)
            .SelectMany(item =>
                StudyPlanner.SupportedDimensions.Select(dimension => new StudyQuestionKey(
                    item.Word.Id,
                    dimension
                ))
            )
            .ToHashSet();

        var plan = new StudyPlanner().CreateTopicPlan(
            words,
            answered,
            NoDeferrals,
            NoQuestionExclusions
        );

        Assert.Equal(10, plan.Count);
        Assert.All(plan, item => Assert.InRange(item.Word.Id, 6, 10));
    }

    [Fact]
    public void DeferredRecallLeavesOnlyRecognitionQuestions()
    {
        var plan = new StudyPlanner().CreateTopicPlan(
            CreateCandidates(4, groupSize: 4),
            NoQuestionExclusions,
            new HashSet<VocabularyMasteryDimension> { VocabularyMasteryDimension.WrittenRecall },
            NoQuestionExclusions
        );

        Assert.Equal(4, plan.Count);
        Assert.All(
            plan,
            item => Assert.Equal(VocabularyMasteryDimension.WrittenRecognition, item.Dimension)
        );
    }

    [Fact]
    public void PausedRecallAdvancesToTheNextGroupWhenTheCurrentGroupOnlyNeedsRecall()
    {
        var words = CreateCandidates(10, groupSize: 5);
        var answered = words
            .Where(item => item.LearningGroupSortOrder == 1)
            .Select(item => new StudyQuestionKey(
                item.Word.Id,
                VocabularyMasteryDimension.WrittenRecognition
            ))
            .ToHashSet();

        var plan = new StudyPlanner().CreateTopicPlan(
            words,
            answered,
            new HashSet<VocabularyMasteryDimension> { VocabularyMasteryDimension.WrittenRecall },
            NoQuestionExclusions
        );

        Assert.Equal(5, plan.Count);
        Assert.All(plan, item => Assert.InRange(item.Word.Id, 6, 10));
        Assert.All(
            plan,
            item => Assert.Equal(VocabularyMasteryDimension.WrittenRecognition, item.Dimension)
        );
    }

    [Fact]
    public void ReviewUsesOnlyDueAnsweredDimensions()
    {
        var words = CreateCandidates(3, groupSize: 3);
        var masteries = new[]
        {
            CreateMastery(
                words[0].Word,
                VocabularyMasteryDimension.WrittenRecognition,
                Now.AddMinutes(-2)
            ),
            CreateMastery(words[0].Word, VocabularyMasteryDimension.WrittenRecall, Now.AddDays(1)),
            CreateMastery(
                words[1].Word,
                VocabularyMasteryDimension.WrittenRecognition,
                Now.AddMinutes(-1)
            ),
        };

        var plan = new StudyPlanner().CreateReviewPlan(
            masteries,
            NoDeferrals,
            NoQuestionExclusions,
            Now
        );

        Assert.Equal(2, plan.Count);
        Assert.All(plan, item => Assert.False(item.IsIntroduction));
        Assert.Equal(
            [
                new StudyQuestionKey(
                    words[0].Word.Id,
                    VocabularyMasteryDimension.WrittenRecognition
                ),
                new StudyQuestionKey(
                    words[1].Word.Id,
                    VocabularyMasteryDimension.WrittenRecognition
                ),
            ],
            plan.Select(item => new StudyQuestionKey(item.Word.Id, item.Dimension))
        );
    }

    [Fact]
    public void ReviewCanIncludeBothPreviouslyAnsweredDimensionsOfTheSameWord()
    {
        var word = CreateCandidates(1)[0].Word;
        var plan = new StudyPlanner().CreateReviewPlan(
            [
                CreateMastery(
                    word,
                    VocabularyMasteryDimension.WrittenRecognition,
                    Now.AddMinutes(-2)
                ),
                CreateMastery(word, VocabularyMasteryDimension.WrittenRecall, Now.AddMinutes(-1)),
            ],
            NoDeferrals,
            NoQuestionExclusions,
            Now
        );

        Assert.Equal(2, plan.Count);
        Assert.Equal(StudyPlanner.SupportedDimensions, plan.Select(item => item.Dimension));
    }

    [Fact]
    public void ReviewCapsOnlyDueQuestionsAtTen()
    {
        var masteries = CreateCandidates(12)
            .Select(
                (item, index) =>
                    CreateMastery(
                        item.Word,
                        VocabularyMasteryDimension.WrittenRecall,
                        Now.AddMinutes(-index - 1)
                    )
            )
            .ToList();

        var plan = new StudyPlanner().CreateReviewPlan(
            masteries,
            NoDeferrals,
            NoQuestionExclusions,
            Now
        );

        Assert.Equal(StudyPlanner.ReviewSessionSize, plan.Count);
        Assert.Equal(12, plan[0].Word.Id);
    }

    [Fact]
    public void DeferringEverySupportedDimensionIsRejected()
    {
        Assert.Throws<StudyConflictException>(() =>
            StudyPlanner.ResolveAllowedDimensions(StudyPlanner.SupportedDimensions.ToHashSet())
        );
    }

    [Theory]
    [InlineData(0, 1)]
    [InlineData(1, 3)]
    [InlineData(2, 7)]
    [InlineData(3, 14)]
    [InlineData(4, 30)]
    public void CorrectAnswerUsesFixedReviewIntervals(int initialStage, int expectedDays)
    {
        var mastery = CreateMastery(
            CreateCandidates(1)[0].Word,
            VocabularyMasteryDimension.WrittenRecall,
            Now
        );
        mastery.Stage = initialStage;

        MasteryScheduler.Apply(mastery, StudyOutcome.Correct, Now);

        Assert.Equal(initialStage + 1, mastery.Stage);
        Assert.Equal(Now.AddDays(expectedDays), mastery.NextReviewAtUtc);
    }

    [Theory]
    [InlineData(StudyOutcome.Wrong)]
    [InlineData(StudyOutcome.Review)]
    public void WrongOrReviewResetsMasteryForTenMinutes(StudyOutcome outcome)
    {
        var mastery = CreateMastery(
            CreateCandidates(1)[0].Word,
            VocabularyMasteryDimension.WrittenRecognition,
            Now
        );
        mastery.Stage = 4;

        MasteryScheduler.Apply(mastery, outcome, Now);

        Assert.Equal(0, mastery.Stage);
        Assert.Equal(Now.AddMinutes(10), mastery.NextReviewAtUtc);
    }

    private static List<CurriculumWordCandidate> CreateCandidates(
        int count,
        int groupSize = 5,
        WordTopic topic = WordTopic.General
    ) =>
        Enumerable
            .Range(1, count)
            .Select(index => new CurriculumWordCandidate(
                new Word
                {
                    Id = index,
                    English = $"word-{index}",
                    TurkishTranslations = [$"anlam-{index}"],
                    PartOfSpeech = WordPartOfSpeech.Noun,
                    Level = WordLevel.A1,
                    Topic = topic,
                },
                1,
                (index - 1) / groupSize + 1,
                index
            ))
            .ToList();

    private static UserWordMastery CreateMastery(
        Word word,
        VocabularyMasteryDimension dimension,
        DateTimeOffset nextReview
    ) =>
        new()
        {
            UserId = "user",
            WordId = word.Id,
            Word = word,
            Dimension = dimension,
            NextReviewAtUtc = nextReview,
            LastStudiedAtUtc = Now.AddDays(-1),
        };
}
