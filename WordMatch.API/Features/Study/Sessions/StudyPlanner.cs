using WordMatch.API.Features.Words;

namespace WordMatch.API.Features.Study;

public sealed class StudyPlanner
{
    public const int ReviewSessionSize = 10;

    public static readonly IReadOnlyList<VocabularyMasteryDimension> SupportedDimensions =
    [
        VocabularyMasteryDimension.WrittenRecognition,
        VocabularyMasteryDimension.WrittenRecall,
    ];

    public IReadOnlyList<PlannedStudyQuestion> CreateTopicPlan(
        IReadOnlyList<CurriculumWordCandidate> topicWords,
        IReadOnlySet<StudyQuestionKey> answeredDimensions,
        IReadOnlySet<VocabularyMasteryDimension> deferredDimensions,
        IReadOnlySet<StudyQuestionKey> excludedQuestions
    )
    {
        var allowedDimensions = ResolveAllowedDimensions(deferredDimensions);
        var nextGroup = topicWords
            .GroupBy(item => item.LearningGroupSortOrder)
            .OrderBy(group => group.Key)
            .FirstOrDefault(group =>
                group.Any(candidate =>
                    allowedDimensions.Any(dimension =>
                        !answeredDimensions.Contains(
                            new StudyQuestionKey(candidate.Word.Id, dimension)
                        )
                        && !excludedQuestions.Contains(
                            new StudyQuestionKey(candidate.Word.Id, dimension)
                        )
                    )
                )
            );
        if (nextGroup is null)
            return [];

        var selected = new List<PlannedStudyQuestion>();
        var groupWords = nextGroup.OrderBy(item => item.WordSortOrder).ToList();
        var recognition = VocabularyMasteryDimension.WrittenRecognition;
        var recall = VocabularyMasteryDimension.WrittenRecall;
        if (allowedDimensions.Contains(recognition))
        {
            foreach (var candidate in groupWords)
                Add(candidate.Word, recognition);
        }

        if (allowedDimensions.Contains(recall))
        {
            var shuffledRecallWords = groupWords
                .Where(candidate =>
                    !answeredDimensions.Contains(new StudyQuestionKey(candidate.Word.Id, recall))
                )
                .ToList();
            Shuffle(shuffledRecallWords);
            foreach (var candidate in shuffledRecallWords)
                Add(candidate.Word, recall);
        }

        return selected;

        void Add(Word word, VocabularyMasteryDimension dimension)
        {
            var key = new StudyQuestionKey(word.Id, dimension);
            if (answeredDimensions.Contains(key) || excludedQuestions.Contains(key))
                return;

            selected.Add(new PlannedStudyQuestion(word, dimension, true));
        }
    }

    public IReadOnlyList<PlannedStudyQuestion> CreateReviewPlan(
        IReadOnlyList<UserWordMastery> masteries,
        IReadOnlySet<VocabularyMasteryDimension> deferredDimensions,
        IReadOnlySet<StudyQuestionKey> excludedQuestions,
        DateTimeOffset now
    )
    {
        var allowedDimensions = ResolveAllowedDimensions(deferredDimensions);
        return masteries
            .Where(item =>
                allowedDimensions.Contains(item.Dimension)
                && item.NextReviewAtUtc <= now
                && !excludedQuestions.Contains(new StudyQuestionKey(item.WordId, item.Dimension))
            )
            .OrderBy(item => item.NextReviewAtUtc)
            .ThenBy(item => item.Stage)
            .ThenBy(item => item.WordId)
            .ThenBy(item => item.Dimension)
            .Take(ReviewSessionSize)
            .Select(item => new PlannedStudyQuestion(item.Word, item.Dimension, false))
            .ToList();
    }

    public static IReadOnlyList<VocabularyMasteryDimension> ResolveAllowedDimensions(
        IReadOnlySet<VocabularyMasteryDimension> deferredDimensions
    )
    {
        var allowed = SupportedDimensions
            .Where(dimension => !deferredDimensions.Contains(dimension))
            .ToList();
        if (allowed.Count == 0)
            throw new StudyConflictException("Bu oturumda en az bir soru türü açık kalmalıdır.");

        return allowed;
    }

    private static void Shuffle<T>(IList<T> values)
    {
        for (var index = values.Count - 1; index > 0; index--)
        {
            var swapIndex = Random.Shared.Next(index + 1);
            (values[index], values[swapIndex]) = (values[swapIndex], values[index]);
        }
    }
}

public readonly record struct StudyQuestionKey(int WordId, VocabularyMasteryDimension Dimension);

public sealed record CurriculumWordCandidate(
    Word Word,
    int TopicSortOrder,
    int LearningGroupSortOrder,
    int WordSortOrder
);

public sealed record PlannedStudyQuestion(
    Word Word,
    VocabularyMasteryDimension Dimension,
    bool IsIntroduction
);
