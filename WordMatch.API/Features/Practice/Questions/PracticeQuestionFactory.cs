using System.Globalization;
using System.Text;
using WordMatch.API.Features.Words;

namespace WordMatch.API.Features.Practice;

public sealed class PracticeQuestionFactory
{
    private static readonly StringComparer TurkishComparer = StringComparer.Create(
        CultureInfo.GetCultureInfo("tr-TR"),
        true
    );

    public IReadOnlyList<PracticeQuestionPlanItem> CreateQuestionPlan(
        PracticeMode mode,
        IReadOnlyCollection<Word> words
    )
    {
        var directions = mode switch
        {
            PracticeMode.EnglishToTurkish => [QuestionDirection.EnglishToTurkish],
            PracticeMode.TurkishToEnglish => [QuestionDirection.TurkishToEnglish],
            PracticeMode.Mixed => Enum.GetValues<QuestionDirection>(),
            _ => throw new ArgumentOutOfRangeException(nameof(mode)),
        };

        return CreateQuestionPlan(words, directions);
    }

    public QuestionSnapshot CreateSnapshot(
        Word sourceWord,
        QuestionDirection direction,
        QuestionFormat format,
        IReadOnlyCollection<Word> allWords
    )
    {
        if (direction == QuestionDirection.EnglishToTurkish)
        {
            var acceptedAnswers = GetDistinctTurkishTranslations(sourceWord);
            return new QuestionSnapshot(
                sourceWord.English,
                FormatTranslations(acceptedAnswers),
                format == QuestionFormat.Written ? acceptedAnswers : null
            );
        }

        if (direction != QuestionDirection.TurkishToEnglish)
            throw new ArgumentOutOfRangeException(nameof(direction));

        var prompt = SelectTurkishPrompt(sourceWord, allWords);
        var acceptedEnglishAnswers = GetAcceptedEnglishAnswers(prompt, allWords);
        var correctAnswer =
            format == QuestionFormat.Written
                ? string.Join(", ", acceptedEnglishAnswers)
                : sourceWord.English;

        return new QuestionSnapshot(
            prompt,
            correctAnswer,
            format == QuestionFormat.Written ? acceptedEnglishAnswers : null
        );
    }

    public bool IsWrittenAnswerCorrect(
        QuestionDirection direction,
        string answer,
        IReadOnlyCollection<string> acceptedAnswers
    )
    {
        var normalizedAnswer = NormalizeAnswer(answer);
        if (normalizedAnswer.Length == 0)
            return false;

        var comparer =
            direction == QuestionDirection.EnglishToTurkish
                ? TurkishComparer
                : StringComparer.OrdinalIgnoreCase;

        return acceptedAnswers.Any(accepted =>
            comparer.Equals(NormalizeAnswer(accepted), normalizedAnswer)
        );
    }

    public static string NormalizeAnswer(string value)
    {
        return string.Join(
                ' ',
                value.Trim().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)
            )
            .Normalize(NormalizationForm.FormC);
    }

    public GeneratedPracticeQuestion CreateOptions(
        PracticeSession session,
        PracticeSessionWord currentWord,
        IReadOnlyCollection<Word> allWords
    )
    {
        var scopedWordIds = session.Words.Select(item => item.WordId).ToHashSet();
        var translationsByEnglish = CreateTranslationsByEnglish(allWords);
        var usedTranslations = new HashSet<string>(
            translationsByEnglish[currentWord.EnglishSnapshot],
            TurkishComparer
        );
        var wrongOptions = new List<string>(3);

        AddWrongOptions(
            allWords.Where(word => scopedWordIds.Contains(word.Id)),
            currentWord,
            translationsByEnglish,
            wrongOptions,
            usedTranslations
        );

        if (wrongOptions.Count < 3)
        {
            AddWrongOptions(
                allWords.Where(word => word.Level == session.Level),
                currentWord,
                translationsByEnglish,
                wrongOptions,
                usedTranslations
            );
        }

        if (wrongOptions.Count < 3)
        {
            AddWrongOptions(
                allWords,
                currentWord,
                translationsByEnglish,
                wrongOptions,
                usedTranslations
            );
        }

        if (wrongOptions.Count < 3)
        {
            throw new PracticeValidationException(
                "Bir soru oluşturmak için dört farklı cevap gereklidir."
            );
        }

        var options = wrongOptions.Append(currentWord.CorrectAnswerSnapshot).ToList();
        Shuffle(options);
        var comparer =
            currentWord.Direction == QuestionDirection.EnglishToTurkish
                ? TurkishComparer
                : StringComparer.OrdinalIgnoreCase;
        var correctIndex = options.FindIndex(option =>
            comparer.Equals(option, currentWord.CorrectAnswerSnapshot)
        );

        return new GeneratedPracticeQuestion(options.ToArray(), correctIndex);
    }

    private static IReadOnlyList<PracticeQuestionPlanItem> CreateQuestionPlan(
        IReadOnlyCollection<Word> words,
        IReadOnlyCollection<QuestionDirection> directions
    )
    {
        if (words.Count == 0)
            return [];

        var questionsByWord = words.ToDictionary(
            word => word.Id,
            word =>
            {
                var questions = directions
                    .SelectMany(direction =>
                        Enum.GetValues<QuestionFormat>()
                            .Select(format => new PracticeQuestionPlanItem(word, direction, format))
                    )
                    .ToList();
                Shuffle(questions);
                return questions;
            }
        );
        var plan = new List<PracticeQuestionPlanItem>(words.Count * 4);
        int? previousWordId = null;

        while (questionsByWord.Count > 0)
        {
            var availableGroups = questionsByWord
                .Where(group => group.Key != previousWordId)
                .ToList();

            if (availableGroups.Count == 0)
                availableGroups = questionsByWord.ToList();

            var largestGroupSize = availableGroups.Max(group => group.Value.Count);
            var candidateGroups = availableGroups
                .Where(group => group.Value.Count == largestGroupSize)
                .ToList();
            var selectedGroup = candidateGroups[Random.Shared.Next(candidateGroups.Count)];
            var selectedQuestion = selectedGroup.Value[^1];

            selectedGroup.Value.RemoveAt(selectedGroup.Value.Count - 1);
            plan.Add(selectedQuestion);
            previousWordId = selectedGroup.Key;

            if (selectedGroup.Value.Count == 0)
                questionsByWord.Remove(selectedGroup.Key);
        }

        return plan;
    }

    private static string[] GetDistinctTurkishTranslations(Word sourceWord)
    {
        return sourceWord
            .TurkishTranslations.Select(translation => translation.Trim())
            .Where(translation => translation.Length > 0)
            .Distinct(TurkishComparer)
            .ToArray();
    }

    private static string[] GetAcceptedEnglishAnswers(
        string turkishPrompt,
        IReadOnlyCollection<Word> allWords
    )
    {
        var normalizedPrompt = NormalizeTurkish(turkishPrompt);

        return allWords
            .Where(word =>
                word.TurkishTranslations.Any(translation =>
                    TurkishComparer.Equals(NormalizeTurkish(translation), normalizedPrompt)
                )
            )
            .Select(word => word.English.Trim())
            .Where(english => english.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    private static string SelectTurkishPrompt(Word sourceWord, IReadOnlyCollection<Word> allWords)
    {
        var candidates = sourceWord
            .TurkishTranslations.Select(
                (translation, index) =>
                    new
                    {
                        DisplayValue = translation.Trim(),
                        NormalizedValue = NormalizeTurkish(translation),
                        Index = index,
                    }
            )
            .Where(item => item.NormalizedValue.Length > 0)
            .GroupBy(item => item.NormalizedValue, TurkishComparer)
            .Select(group => group.First())
            .ToList();

        return candidates
                .OrderBy(candidate =>
                    allWords
                        .Where(word =>
                            word.TurkishTranslations.Any(translation =>
                                TurkishComparer.Equals(
                                    NormalizeTurkish(translation),
                                    candidate.NormalizedValue
                                )
                            )
                        )
                        .Select(word => word.English)
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .Count()
                )
                .ThenBy(candidate => candidate.Index)
                .Select(candidate => candidate.DisplayValue)
                .FirstOrDefault()
            ?? throw new PracticeValidationException("Soru kelimesinin çevirisi bulunmuyor.");
    }

    private static Dictionary<string, HashSet<string>> CreateTranslationsByEnglish(
        IEnumerable<Word> words
    )
    {
        return words
            .GroupBy(word => word.English, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                group => group.Key,
                group => new HashSet<string>(
                    group
                        .SelectMany(word => word.TurkishTranslations)
                        .Select(NormalizeTurkish)
                        .Where(translation => translation.Length > 0),
                    TurkishComparer
                ),
                StringComparer.OrdinalIgnoreCase
            );
    }

    private static void AddWrongOptions(
        IEnumerable<Word> candidates,
        PracticeSessionWord currentWord,
        IReadOnlyDictionary<string, HashSet<string>> translationsByEnglish,
        ICollection<string> wrongOptions,
        ISet<string> usedTranslations
    )
    {
        var shuffledCandidates = candidates.ToList();
        Shuffle(shuffledCandidates);
        var optionComparer =
            currentWord.Direction == QuestionDirection.EnglishToTurkish
                ? TurkishComparer
                : StringComparer.OrdinalIgnoreCase;

        foreach (var candidate in shuffledCandidates)
        {
            if (wrongOptions.Count == 3)
                return;

            if (
                string.Equals(
                    candidate.English,
                    currentWord.EnglishSnapshot,
                    StringComparison.OrdinalIgnoreCase
                )
            )
            {
                continue;
            }

            var candidateTranslations = translationsByEnglish[candidate.English];
            if (
                candidateTranslations.Count == 0
                || candidateTranslations.Any(usedTranslations.Contains)
            )
            {
                continue;
            }

            var option =
                currentWord.Direction == QuestionDirection.EnglishToTurkish
                    ? FormatTranslations(candidate.TurkishTranslations)
                    : candidate.English.Trim();

            if (
                option.Length == 0
                || wrongOptions.Any(existing => optionComparer.Equals(existing, option))
            )
            {
                continue;
            }

            wrongOptions.Add(option);
            usedTranslations.UnionWith(candidateTranslations);
        }
    }

    private static string FormatTranslations(IEnumerable<string> translations)
    {
        return string.Join(
            ", ",
            translations
                .Select(translation => translation.Trim())
                .Where(translation => translation.Length > 0)
        );
    }

    private static string NormalizeTurkish(string value)
    {
        return NormalizeAnswer(value);
    }

    private static void Shuffle<T>(IList<T> items)
    {
        for (var index = items.Count - 1; index > 0; index--)
        {
            var swapIndex = Random.Shared.Next(index + 1);
            (items[index], items[swapIndex]) = (items[swapIndex], items[index]);
        }
    }
}

public sealed record QuestionSnapshot(
    string Prompt,
    string CorrectAnswer,
    string[]? AcceptedAnswers
);

public sealed record GeneratedPracticeQuestion(string[] Options, int CorrectIndex);

public sealed record PracticeQuestionPlanItem(
    Word Word,
    QuestionDirection Direction,
    QuestionFormat Format
);
